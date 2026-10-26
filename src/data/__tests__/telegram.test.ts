import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { describe, test } from 'node:test';

import { holdFile, sweepUnusedFiles } from '../fileHelpers';
import {
  backupToTelegram,
  CHUNK,
  findChat,
  NeedsStartError,
  NoBackupFoundError,
  partName,
  restoreFromTelegram,
  TelegramError,
  type Deps,
  type SentDocument,
  type TelegramTransport,
} from '../telegram';
import type { FileStore, FileWriter } from '../types';
import { BACKUP_VERSION } from '../repo';

import { setup } from './helpers';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const sha256Bytes = async (b: Uint8Array) => sha(b);

/** Files in memory, behind the same interface as the phone's folder. */
class MemoryStore implements FileStore {
  files = new Map<string, Uint8Array>();
  async uri(name: string) {
    return this.files.has(name) ? `mem://${name}` : null;
  }
  async exists(name: string) {
    return this.files.has(name);
  }
  async size(name: string) {
    return this.files.get(name)?.length ?? 0;
  }
  async sha256(name: string) {
    const f = this.files.get(name);
    if (!f) throw new Error('missing');
    return sha(f);
  }
  async read(name: string, offset: number, length: number) {
    return this.files.get(name)!.slice(offset, offset + length);
  }
  async importUri(src: string, name: string) {
    this.files.set(name, new Uint8Array(Buffer.from(src)));
    return src.length;
  }
  async writer(name: string): Promise<FileWriter> {
    const parts: Uint8Array[] = [];
    return {
      append: async (b) => {
        parts.push(b);
      },
      commit: async () => {
        this.files.set(name, new Uint8Array(Buffer.concat(parts)));
      },
      abort: async () => {
        parts.length = 0;
      },
    };
  }
  async remove(name: string) {
    this.files.delete(name);
  }
  async list() {
    return [...this.files.keys()];
  }
}

/** A Telegram chat with the real limits: 50 MB per upload, 20 MB per bot download. */
class FakeTelegram implements TelegramTransport {
  docs = new Map<string, { bytes: Uint8Array; name: string }>();
  messages: { id: number; fileId?: string; name?: string; text?: string }[] = [];
  pinned: number | null = null;
  uploads = 0;
  updates: unknown[] = [{ message: { chat: { id: 42, type: 'private', first_name: 'Paulo' } } }];
  /** Fail the next N uploads with "429 Too Many Requests". */
  throttle = 0;
  /** Fail the next N uploads with a network error (code 0), then succeed. */
  netBlips = 0;
  corrupt: string | null = null;
  private n = 0;

  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    switch (method) {
      case 'getMe':
        return { username: 'my_notes_bot', first_name: 'Notes' } as T;
      case 'getUpdates':
        return this.updates as T;
      case 'sendMessage':
        this.messages.push({ id: ++this.n, text: String(params.text) });
        return { message_id: this.n } as T;
      case 'pinChatMessage':
        this.pinned = Number(params.message_id);
        return true as T;
      case 'unpinAllChatMessages':
        this.pinned = null;
        return true as T;
      case 'getChat': {
        const m = this.messages.find((x) => x.id === this.pinned);
        return { id: 42, pinned_message: m?.fileId ? { document: { file_id: m.fileId, file_name: m.name } } : undefined } as T;
      }
      default:
        throw new TelegramError(400, `unknown method ${method}`);
    }
  }

  async sendDocument(_chat: string, bytes: Uint8Array, fileName: string): Promise<SentDocument> {
    if (this.throttle > 0) {
      this.throttle--;
      throw new TelegramError(429, 'Too Many Requests', 1);
    }
    if (this.netBlips > 0) {
      this.netBlips--;
      throw new TelegramError(0, 'network error');
    }
    if (bytes.length > 50 * 1024 * 1024) throw new TelegramError(413, 'Request Entity Too Large');
    const fileId = `f${++this.n}`;
    this.docs.set(fileId, { bytes: bytes.slice(), name: fileName });
    this.messages.push({ id: this.n, fileId, name: fileName });
    this.uploads++;
    return { messageId: this.n, fileId, size: bytes.length };
  }

  async download(fileId: string): Promise<Uint8Array> {
    const d = this.docs.get(fileId);
    if (!d) throw new TelegramError(400, 'file not found');
    if (d.bytes.length > 20 * 1000 * 1000) throw new TelegramError(400, 'file is too big');
    const out = d.bytes.slice();
    if (this.corrupt === fileId) out[0] ^= 0xff;
    return out;
  }
}

async function phone(tg: FakeTelegram) {
  const env = await setup();
  const store = new MemoryStore();
  const deps: Deps = { repo: env.repo, store, tx: tg, chatId: '42', sha256Bytes, sleep: async () => undefined };
  return { ...env, store, deps };
}

async function addFile(p: Awaited<ReturnType<typeof phone>>, noteId: string, bytes: Uint8Array, kind: 'image' | 'video' = 'image') {
  const fileName = `${randomBytes(6).toString('hex')}.${kind === 'image' ? 'jpg' : 'mp4'}`;
  p.store.files.set(fileName, bytes);
  const [a] = await p.repo.addAttachments(noteId, [
    { kind, fileName, mime: kind === 'image' ? 'image/jpeg' : 'video/mp4', size: bytes.length },
  ]);
  return a;
}

describe('attachments', () => {
  test('add, card cover and count, a note with only a photo is kept', async () => {
    const p = await phone(new FakeTelegram());
    const n = await p.repo.createNote({ type: 'text' });
    await addFile(p, n, new Uint8Array([1, 2, 3]));
    await addFile(p, n, new Uint8Array([4]), 'video');
    const [card] = await p.repo.listNotes();
    assert.equal(card.attachmentCount, 2);
    assert.equal(card.cover?.kind, 'image');
    assert.equal(await p.repo.discardIfEmpty(n), false);
    assert.deepEqual((await p.repo.getNote(n))!.attachments.map((a) => a.position), [0, 1]);
  });

  test('a duplicate shares the file; it is swept only when no note uses it', async () => {
    const p = await phone(new FakeTelegram());
    const n = await p.repo.createNote({ type: 'text' });
    const a = await addFile(p, n, new Uint8Array([9, 9]));
    const copy = (await p.repo.duplicateNote(n))!;
    await p.repo.deleteForever(n);
    assert.equal(await sweepUnusedFiles(p.repo, p.store), 0);
    assert.ok(p.store.files.has(a.fileName));
    await p.repo.trashNote(copy);
    assert.equal(await sweepUnusedFiles(p.repo, p.store), 0, 'still in the trash');
    await p.repo.emptyTrash();
    assert.equal(await sweepUnusedFiles(p.repo, p.store), 1);
    assert.equal(p.store.files.size, 0);
  });

  test('a file still being copied in is not swept', async () => {
    const p = await phone(new FakeTelegram());
    p.store.files.set('incoming.jpg', new Uint8Array([1]));
    const release = holdFile('incoming.jpg');
    assert.equal(await sweepUnusedFiles(p.repo, p.store), 0);
    release();
    assert.equal(await sweepUnusedFiles(p.repo, p.store), 1);
  });

  test('unsafe file names are refused', async () => {
    const p = await phone(new FakeTelegram());
    const n = await p.repo.createNote({ type: 'text' });
    await assert.rejects(p.repo.addAttachments(n, [{ kind: 'image', fileName: '../db.sqlite', mime: 'image/jpeg', size: 1 }]));
  });

  test('file backup carries attachment rows; a v1 backup still imports', async () => {
    const a = await phone(new FakeTelegram());
    const n = await a.repo.createNote({ type: 'text' });
    await a.repo.updateNote(n, { title: 'Trip' });
    await addFile(a, n, new Uint8Array([7]));
    const data = await a.repo.exportBackup();
    assert.equal(data.schema_version, BACKUP_VERSION);
    const b = await phone(new FakeTelegram());
    await b.repo.importBackup(data);
    assert.equal((await b.repo.getNote(n))!.attachments.length, 1);
    const v1 = { ...data, schema_version: 1 } as Record<string, unknown>;
    delete v1.attachments;
    const c = await phone(new FakeTelegram());
    assert.equal((await c.repo.importBackup(v1)).added, 1);
  });
});

describe('telegram backup', () => {
  test('connect finds your private chat and says hello; without /start it asks for it', async () => {
    const tg = new FakeTelegram();
    assert.deepEqual(await findChat(tg), { chatId: '42', chatName: 'Paulo', botName: 'my_notes_bot' });
    assert.match(tg.messages.at(-1)!.text!, /connected/);
    tg.updates = [];
    await assert.rejects(findChat(tg), NeedsStartError);
  });

  test('part names', () => {
    assert.equal(partName('a.mp4', 0, 1), 'a.mp4');
    assert.equal(partName('a.mp4', 1, 3), 'a.mp4.part02of03');
  });

  test('a 45 MB video goes up in parts under 20 MB and comes back byte for byte on a new phone', async () => {
    const tg = new FakeTelegram();
    const a = await phone(tg);
    const n = await a.repo.createNote({ type: 'text' });
    await a.repo.updateNote(n, { title: 'Holiday', body: 'beach' });
    const big = randomBytes(45 * 1024 * 1024);
    const small = randomBytes(3000);
    const v = await addFile(a, n, big, 'video');
    const ph = await addFile(a, n, small);

    const r = await backupToTelegram(a.deps);
    assert.deepEqual({ ...r, bytesSent: 0 }, { notes: 1, filesSent: 2, filesReused: 0, filesMissing: 0, bytesSent: 0 });
    const parts = [...tg.docs.values()].filter((d) => d.name.startsWith(v.fileName));
    assert.equal(parts.length, 3);
    assert.ok(parts.every((d) => d.bytes.length <= CHUNK && d.bytes.length < 20 * 1000 * 1000));
    assert.ok(tg.pinned);
    assert.ok((await a.repo.getSettings()).lastTelegramAt);

    // New phone: only the chat.
    const b = await phone(tg);
    const res = await restoreFromTelegram(b.deps);
    assert.equal(res.added, 1);
    assert.equal(res.filesRestored, 2);
    assert.equal(sha(b.store.files.get(v.fileName)!), sha(big));
    assert.equal(sha(b.store.files.get(ph.fileName)!), sha(small));
    assert.equal((await b.repo.getNote(n))!.title, 'Holiday');

    // Its next backup sends no file again.
    const before = tg.uploads;
    const again = await backupToTelegram(b.deps);
    assert.equal(again.filesSent, 0);
    assert.equal(again.filesReused, 2);
    assert.equal(tg.uploads - before, 2, 'only the notes and the manifest');
  });

  test('second backup reuses files and only the newest manifest is pinned', async () => {
    const tg = new FakeTelegram();
    const a = await phone(tg);
    const n = await a.repo.createNote({ type: 'text' });
    await addFile(a, n, randomBytes(100));
    await backupToTelegram(a.deps);
    const first = tg.pinned;
    await addFile(a, n, randomBytes(100));
    const r = await backupToTelegram(a.deps);
    assert.equal(r.filesSent, 1);
    assert.equal(r.filesReused, 1);
    assert.notEqual(tg.pinned, first);
  });

  test('waits and retries when Telegram says slow down', async () => {
    const tg = new FakeTelegram();
    const a = await phone(tg);
    const waits: number[] = [];
    a.deps.sleep = async (ms) => {
      waits.push(ms);
    };
    const n = await a.repo.createNote({ type: 'text' });
    await addFile(a, n, randomBytes(10));
    tg.throttle = 2;
    await backupToTelegram(a.deps);
    assert.deepEqual(waits, [2000, 2000]);
  });

  test('a network blip mid-upload is retried, not fatal (the big-file bug)', async () => {
    const tg = new FakeTelegram();
    const a = await phone(tg);
    const n = await a.repo.createNote({ type: 'text' });
    const big = randomBytes(45 * 1024 * 1024);
    const v = await addFile(a, n, big, 'video');
    // The connection drops twice while a part is going up.
    tg.netBlips = 2;
    const r = await backupToTelegram(a.deps);
    assert.equal(r.filesSent, 1);
    const b = await phone(tg);
    await restoreFromTelegram(b.deps);
    assert.equal(sha(b.store.files.get(v.fileName)!), sha(big));
  });

  test('a damaged part is caught by the hash; the bad file is not kept', async () => {
    const tg = new FakeTelegram();
    const a = await phone(tg);
    const n = await a.repo.createNote({ type: 'text' });
    const f = await addFile(a, n, randomBytes(500));
    await backupToTelegram(a.deps);
    tg.corrupt = [...tg.docs.entries()].find(([, d]) => d.name === f.fileName)![0];
    const b = await phone(tg);
    const r = await restoreFromTelegram(b.deps);
    assert.equal(r.filesFailed, 1);
    assert.equal(b.store.files.has(f.fileName), false);
    assert.equal(r.added, 1, 'the note itself still comes back');
  });

  test('a file missing on the phone is reported, not fatal', async () => {
    const tg = new FakeTelegram();
    const a = await phone(tg);
    const n = await a.repo.createNote({ type: 'text' });
    const f = await addFile(a, n, randomBytes(10));
    a.store.files.delete(f.fileName);
    assert.equal((await backupToTelegram(a.deps)).filesMissing, 1);
  });

  test('no pinned backup: a clear error', async () => {
    const tg = new FakeTelegram();
    const b = await phone(tg);
    await assert.rejects(restoreFromTelegram(b.deps), NoBackupFoundError);
  });
});
