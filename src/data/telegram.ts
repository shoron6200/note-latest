/**
 * Backup to your own Telegram bot, and restore from it.
 *
 * What goes to the chat:
 *  - every photo and video, once (by content hash), cut into parts of at most
 *    CHUNK bytes, because a bot may upload 50 MB per file but download only 20 MB;
 *  - the notes as JSON (the same format as "Back up now");
 *  - a small manifest that lists where every part is. The app pins it, so a
 *    restore on a new phone only needs the bot token: it reads the pinned
 *    message, downloads the parts and joins them back into the exact files,
 *    checked against their SHA-256.
 *
 * This file has no Expo imports: the Telegram connection and the file store
 * are passed in, so the tests run it against a fake Telegram.
 */
import type { Repo } from './repo';
import { hashOf } from './fileHelpers';
import type { FileStore, TelegramPart } from './types';


/** 19 MiB: under both Telegram limits (50 MB upload, 20 MB bot download). */
export const CHUNK = 19 * 1024 * 1024;
export const MANIFEST_FORMAT = 'pocketleaf-telegram';
export const MANIFEST_VERSION = 1;

export type SentDocument = { messageId: number; fileId: string; size: number };

/** The Bot API as this app uses it. telegramApi.ts talks to the real one. */
export interface TelegramTransport {
  call<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  sendDocument(chatId: string, bytes: Uint8Array, fileName: string, caption?: string): Promise<SentDocument>;
  download(fileId: string): Promise<Uint8Array>;
}

export class TelegramError extends Error {
  constructor(
    readonly code: number,
    description: string,
    readonly retryAfter?: number,
  ) {
    super(description);
    this.name = 'TelegramError';
  }
}

/** No pinned Pocketleaf backup in the chat. */
export class NoBackupFoundError extends Error {
  constructor() {
    super('no backup found');
    this.name = 'NoBackupFoundError';
  }
}

/** The bot has no messages from you yet: send it /start first. */
export class NeedsStartError extends Error {
  constructor() {
    super('send /start to the bot first');
    this.name = 'NeedsStartError';
  }
}

export type Manifest = {
  format: typeof MANIFEST_FORMAT;
  version: number;
  created_at: string;
  notes: { size: number; sha256: string; parts: TelegramPart[] };
  files: Record<string, { size: number; parts: TelegramPart[] }>;
};

export type Progress = {
  phase: 'files' | 'notes' | 'finish';
  done: number;
  total: number;
};

export type Deps = {
  repo: Repo;
  store: FileStore;
  tx: TelegramTransport;
  chatId: string;
  sha256Bytes: (b: Uint8Array) => Promise<string>;
  now?: () => number;
  /** Waits for Telegram's "retry after"; replaced in tests. */
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (p: Progress) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry when Telegram asks to slow down (429) or a network blip happens. */
async function retry<T>(deps: Deps, fn: () => Promise<T>, attempts = 5): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const te = e instanceof TelegramError ? e : null;
      // code 0 is a network blip (scrub() in telegramApi.ts). Big files take
      // longer to upload, so they hit one far more often than small ones — it
      // must be retried, or a single blip fails the whole backup.
      const transient = te ? te.code === 0 || te.code === 429 || te.code >= 500 : true;
      if (!transient || i >= attempts) throw e;
      await sleep(te?.retryAfter ? (te.retryAfter + 1) * 1000 : 1500 * i);
    }
  }
}

export const partCount = (size: number) => Math.max(1, Math.ceil(size / CHUNK));

/** "photo.jpg" stays as is when it fits; "photo.jpg.part02of05" otherwise. */
export function partName(base: string, i: number, n: number) {
  if (n === 1) return base;
  const w = String(n).length < 2 ? 2 : String(n).length;
  return `${base}.part${String(i + 1).padStart(w, '0')}of${String(n).padStart(w, '0')}`;
}

async function uploadParts(
  deps: Deps,
  size: number,
  read: (offset: number, length: number) => Promise<Uint8Array>,
  baseName: string,
  caption?: string,
): Promise<TelegramPart[]> {
  const n = partCount(size);
  const parts: TelegramPart[] = [];
  for (let i = 0; i < n; i++) {
    const offset = i * CHUNK;
    const bytes = await read(offset, Math.min(CHUNK, size - offset));
    const sent = await retry(deps, () =>
      deps.tx.sendDocument(deps.chatId, bytes, partName(baseName, i, n), i === 0 ? caption : undefined),
    );
    parts.push({ fileId: sent.fileId, size: bytes.length });
  }
  return parts;
}

async function downloadParts(deps: Deps, parts: TelegramPart[], sink: (b: Uint8Array) => Promise<void>) {
  for (const p of parts) {
    const bytes = await retry(deps, () => deps.tx.download(p.fileId));
    if (bytes.length !== p.size) throw new Error('a part came back the wrong size');
    await sink(bytes);
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const stamp = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', '-').replace(':', '');

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export type BackupResult = {
  notes: number;
  filesSent: number;
  filesReused: number;
  filesMissing: number;
  bytesSent: number;
};

/**
 * Send everything new to the chat and pin a fresh manifest. Files sent by an
 * earlier backup are reused (Telegram keeps them), so after the first run only
 * new photos and videos travel.
 */
export async function backupToTelegram(deps: Deps): Promise<BackupResult> {
  const { repo, store } = deps;
  const now = deps.now ?? Date.now;
  const report = deps.onProgress ?? (() => undefined);

  // 1. Files, one per distinct stored file.
  const all = await repo.listAllAttachments();
  const byName = new Map(all.map((a) => [a.fileName, a]));
  const files: Manifest['files'] = {};
  let filesSent = 0;
  let filesReused = 0;
  let filesMissing = 0;
  let bytesSent = 0;
  let done = 0;
  report({ phase: 'files', done, total: byName.size });
  for (const a of byName.values()) {
    if (!(await store.exists(a.fileName))) {
      filesMissing++;
    } else {
      const sha = await hashOf(repo, store, a);
      const known = await repo.getTelegramFile(sha);
      if (known) {
        files[sha] = known;
        filesReused++;
      } else {
        const size = await store.size(a.fileName);
        const parts = await uploadParts(deps, size, (o, l) => store.read(a.fileName, o, l), a.fileName);
        await repo.saveTelegramFile(sha, size, parts);
        files[sha] = { size, parts };
        filesSent++;
        bytesSent += size;
      }
    }
    report({ phase: 'files', done: ++done, total: byName.size });
  }

  // 2. The notes. Exported after hashing, so every row carries its file's hash.
  report({ phase: 'notes', done: 0, total: 1 });
  const data = await repo.exportBackup();
  const json = enc.encode(JSON.stringify(data));
  const jsonSha = await deps.sha256Bytes(json);
  const t = now();
  const notesParts = await uploadParts(
    deps,
    json.length,
    async (o, l) => json.subarray(o, o + l),
    `pocketleaf-notes-${stamp(t)}.json`,
  );
  bytesSent += json.length;
  report({ phase: 'notes', done: 1, total: 1 });

  // 3. The manifest, pinned so a restore can find it.
  report({ phase: 'finish', done: 0, total: 1 });
  const manifest: Manifest = {
    format: MANIFEST_FORMAT,
    version: MANIFEST_VERSION,
    created_at: new Date(t).toISOString(),
    notes: { size: json.length, sha256: jsonSha, parts: notesParts },
    files,
  };
  const noteCount = data.notes.filter((n) => n.deleted_at === null).length;
  const fileCount = Object.keys(files).length;
  const caption =
    `📒 Pocketleaf backup · ${noteCount} note${noteCount === 1 ? '' : 's'} · ${fileCount} photo/video file${fileCount === 1 ? '' : 's'}\n` +
    'Keep this message pinned: restoring reads it.';
  const m = enc.encode(JSON.stringify(manifest));
  const sent = await retry(deps, () => deps.tx.sendDocument(deps.chatId, m, `pocketleaf-manifest-${stamp(t)}.json`, caption));
  // Only the newest backup stays pinned (this chat is just for the app).
  await deps.tx.call('unpinAllChatMessages', { chat_id: deps.chatId }).catch(() => undefined);
  await retry(deps, () =>
    deps.tx.call('pinChatMessage', { chat_id: deps.chatId, message_id: sent.messageId, disable_notification: true }),
  );
  await repo.setSetting('lastTelegramAt', t);
  report({ phase: 'finish', done: 1, total: 1 });
  return { notes: noteCount, filesSent, filesReused, filesMissing, bytesSent };
}

export function parseManifest(bytes: Uint8Array): Manifest {
  let m: Manifest;
  try {
    m = JSON.parse(dec.decode(bytes)) as Manifest;
  } catch {
    throw new NoBackupFoundError();
  }
  const okParts = (p: unknown): p is TelegramPart[] =>
    Array.isArray(p) && p.length > 0 && p.every((x) => x && typeof x.fileId === 'string' && typeof x.size === 'number');
  if (!m || m.format !== MANIFEST_FORMAT || typeof m.version !== 'number' || !m.notes || !okParts(m.notes.parts)) {
    throw new NoBackupFoundError();
  }
  if (m.version > MANIFEST_VERSION) throw new Error('made by a newer version of the app');
  const files: Manifest['files'] = {};
  for (const [sha, f] of Object.entries(m.files ?? {})) {
    if (/^[0-9a-f]{64}$/.test(sha) && f && typeof f.size === 'number' && okParts(f.parts)) files[sha] = f;
  }
  return { ...m, files };
}

export type RestoreResult = {
  added: number;
  updated: number;
  skipped: number;
  filesRestored: number;
  filesMissing: number;
  filesFailed: number;
  backupDate: string;
};

/**
 * Bring the pinned backup into this phone. Notes merge the same way as
 * "Restore from file" (newer wins, nothing deleted). Then every photo or video
 * this phone lacks is downloaded part by part, joined, and checked against its
 * hash before it is kept.
 */
export async function restoreFromTelegram(deps: Deps): Promise<RestoreResult> {
  const { repo, store, tx, chatId } = deps;
  const report = deps.onProgress ?? (() => undefined);

  const chat = await retry(deps, () =>
    tx.call<{ pinned_message?: { document?: { file_id: string; file_name?: string } } }>('getChat', { chat_id: chatId }),
  );
  const doc = chat.pinned_message?.document;
  if (!doc || (doc.file_name && !doc.file_name.startsWith('pocketleaf-manifest'))) throw new NoBackupFoundError();
  const manifest = parseManifest(await retry(deps, () => tx.download(doc.file_id)));

  // Notes.
  report({ phase: 'notes', done: 0, total: 1 });
  const chunks: Uint8Array[] = [];
  await downloadParts(deps, manifest.notes.parts, async (b) => {
    chunks.push(b);
  });
  const json = concat(chunks);
  if (json.length !== manifest.notes.size || (await deps.sha256Bytes(json)) !== manifest.notes.sha256) {
    throw new Error('the notes file did not match its checksum');
  }
  const merged = await repo.importBackup(JSON.parse(dec.decode(json)));
  report({ phase: 'notes', done: 1, total: 1 });

  // Remember what is already in the chat, so the next backup does not resend it.
  for (const [sha, f] of Object.entries(manifest.files)) await repo.saveTelegramFile(sha, f.size, f.parts);

  // Files this phone does not have yet.
  const need = new Map<string, string | null>();
  for (const a of await repo.listAllAttachments()) {
    if (!need.has(a.fileName) && !(await store.exists(a.fileName))) need.set(a.fileName, a.sha256);
  }
  let filesRestored = 0;
  let filesMissing = 0;
  let filesFailed = 0;
  let done = 0;
  report({ phase: 'files', done, total: need.size });
  for (const [name, sha] of need) {
    const entry = sha ? manifest.files[sha] : undefined;
    if (!entry) {
      filesMissing++;
    } else {
      const w = await store.writer(name);
      try {
        await downloadParts(deps, entry.parts, (b) => w.append(b));
        await w.commit();
        if ((await store.size(name)) !== entry.size || (await store.sha256(name)) !== sha) {
          await store.remove(name);
          filesFailed++;
        } else {
          filesRestored++;
        }
      } catch {
        await w.abort().catch(() => undefined);
        await store.remove(name).catch(() => undefined);
        filesFailed++;
      }
    }
    report({ phase: 'files', done: ++done, total: need.size });
  }
  report({ phase: 'finish', done: 1, total: 1 });
  return { ...merged, filesRestored, filesMissing, filesFailed, backupDate: manifest.created_at };
}

export type ConnectResult = { chatId: string; chatName: string; botName: string };

/**
 * Check the token and find your chat with the bot: the latest private
 * message anyone sent it (you, after /start). A test message confirms it.
 */
export async function findChat(tx: TelegramTransport): Promise<ConnectResult> {
  const me = await tx.call<{ username?: string; first_name: string }>('getMe');
  const updates = await tx.call<
    { message?: { chat: { id: number; type: string; first_name?: string; username?: string } } }[]
  >('getUpdates', { limit: 100, timeout: 0, allowed_updates: ['message'] });
  const chats = updates.map((u) => u.message?.chat).filter((c) => c && c.type === 'private');
  const chat = chats[chats.length - 1];
  if (!chat) throw new NeedsStartError();
  const chatId = String(chat.id);
  await tx.call('sendMessage', {
    chat_id: chatId,
    text: '✅ Pocketleaf is connected. Your backups will arrive in this chat, and the newest one stays pinned.',
  });
  return { chatId, chatName: chat.first_name ?? chat.username ?? 'you', botName: me.username ?? me.first_name };
}
