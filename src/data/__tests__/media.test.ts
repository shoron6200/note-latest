import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { migrate, SCHEMA_VERSION } from '../migrations';
import { BACKUP_VERSION } from '../repo';

import { setup } from './helpers';

const titles = (ns: { title: string }[]) => ns.map((n) => n.title);

type Repo = Awaited<ReturnType<typeof setup>>['repo'];

async function note(repo: Repo, title: string) {
  const id = await repo.createNote({ type: 'text' });
  await repo.updateNote(id, { title });
  return id;
}

const photo = (fileName: string) => ({ kind: 'image' as const, fileName, mime: 'image/jpeg', size: 10 });
const voice = (fileName: string) => ({ kind: 'audio' as const, fileName, mime: 'audio/wav', size: 10, durationMs: 4200 });

describe('schema v5', () => {
  test('a version 4 phone keeps its photos; they wait to be read', async () => {
    const { db, repo } = await setup();
    const id = await note(repo, 'Receipt');
    // Pretend this database stopped at version 4: old attachments table, no text column.
    await db.exec(`drop table attachments;
      create table attachments (
        id text primary key not null, note_id text not null references notes (id) on delete cascade,
        kind text not null check (kind in ('image', 'video')), file_name text not null, mime text not null,
        size integer not null default 0, width integer, height integer, duration_ms integer, sha256 text,
        position integer not null, created_at integer not null, updated_at integer not null);
      insert into attachments values ('a1', '${id}', 'image', 'r.jpg', 'image/jpeg', 1, null, null, null, null, 0, 1, 1);
      PRAGMA user_version = 4;`);
    await migrate(db);
    assert.equal((await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version, SCHEMA_VERSION);
    const n = (await repo.getNote(id))!;
    assert.equal(n.attachments.length, 1);
    assert.equal(n.attachments[0].text, null);
    assert.deepEqual((await repo.unreadPhotos()).map((a) => a.fileName), ['r.jpg']);
    // The new setting can be stored.
    await repo.setSetting('voiceOnline', true);
    assert.equal((await repo.getSettings()).voiceOnline, true);
  });

  test('voice online is off by default', async () => {
    const { repo } = await setup();
    assert.equal((await repo.getSettings()).voiceOnline, false);
  });
});

describe('voice notes', () => {
  test('a voice note is listed apart: not the card cover, counted on its own', async () => {
    const { repo } = await setup();
    const id = await note(repo, 'Idea');
    await repo.addAttachments(id, [voice('v.wav'), photo('p.jpg')]);
    const [card] = await repo.listNotes();
    assert.equal(card.cover?.fileName, 'p.jpg');
    assert.equal(card.attachmentCount, 1);
    assert.equal(card.audioCount, 1);

    const only = await note(repo, 'Just talk');
    await repo.addAttachments(only, [voice('w.wav')]);
    const c2 = (await repo.listNotes()).find((n) => n.id === only)!;
    assert.equal(c2.cover, null);
    assert.equal(c2.audioCount, 1);
  });

  test('the Voice filter finds notes with a voice note; Images and videos does not', async () => {
    const { repo } = await setup();
    const a = await note(repo, 'Talk');
    const b = await note(repo, 'Pic');
    await repo.addAttachments(a, [voice('v.wav')]);
    await repo.addAttachments(b, [photo('p.jpg')]);
    assert.deepEqual(titles(await repo.searchNotes('', { kind: 'type', value: 'audio' })), ['Talk']);
    assert.deepEqual(titles(await repo.searchNotes('', { kind: 'type', value: 'media' })), ['Pic']);
  });

  test('a copy keeps the voice note', async () => {
    const { repo } = await setup();
    const a = await note(repo, 'Talk');
    await repo.addAttachments(a, [voice('v.wav')]);
    const copyId = await repo.duplicateNote(a);
    assert.equal((await repo.getNote(copyId!))!.attachments[0].kind, 'audio');
  });
});

describe('text in photos', () => {
  for (const mode of ['fts', 'like'] as const) {
    test(`${mode}: words read in a photo find the note`, async () => {
      const { repo } = await setup({ fts: mode === 'fts' ? undefined : false });
      const a = await note(repo, 'Receipt');
      await note(repo, 'Other');
      await repo.addAttachments(a, [photo('r.jpg')]);
      assert.deepEqual(await repo.searchNotes('invoice'), []);
      await repo.setPhotoText('r.jpg', 'INVOICE 2231\nTotal 14,90 €');
      assert.deepEqual(titles(await repo.searchNotes('invoice')), ['Receipt']);
      assert.deepEqual(titles(await repo.searchNotes('2231')), ['Receipt']);
      // Removing the photo takes its words out of search.
      const att = (await repo.getNote(a))!.attachments[0];
      await repo.removeAttachment(att.id);
      assert.deepEqual(await repo.searchNotes('invoice'), []);
    });
  }

  test('reading a photo is not an edit; a copied note shares the text', async () => {
    const { repo, tick } = await setup();
    const a = await note(repo, 'Whiteboard');
    await repo.addAttachments(a, [photo('w.jpg')]);
    const copyId = await repo.duplicateNote(a);
    const before = (await repo.getNote(a))!.updatedAt;
    tick(60_000);
    await repo.setPhotoText('w.jpg', 'Sprint goals');
    assert.equal((await repo.getNote(a))!.updatedAt, before);
    assert.equal((await repo.getNote(copyId!))!.attachments[0].text, 'Sprint goals');
    assert.deepEqual(await repo.unreadPhotos(), []);
  });

  test('nothing found is remembered, so the photo is not read again', async () => {
    const { repo } = await setup();
    const a = await note(repo, 'Cat');
    await repo.addAttachments(a, [photo('c.jpg')]);
    await repo.setPhotoText('c.jpg', '');
    assert.deepEqual(await repo.unreadPhotos(), []);
  });

  test('videos and voice notes are never queued for reading', async () => {
    const { repo } = await setup();
    const a = await note(repo, 'Clip');
    await repo.addAttachments(a, [{ kind: 'video', fileName: 'v.mp4', mime: 'video/mp4', size: 1 }, voice('a.wav')]);
    assert.deepEqual(await repo.unreadPhotos(), []);
  });
});

describe('backup v4', () => {
  test('voice notes and photo text travel; an older backup leaves photos to be read again', async () => {
    const one = await setup();
    const a = await note(one.repo, 'Mixed');
    await one.repo.addAttachments(a, [voice('v.wav'), photo('p.jpg')]);
    await one.repo.setPhotoText('p.jpg', 'Hello');
    const data = await one.repo.exportBackup();
    assert.equal(data.schema_version, BACKUP_VERSION);

    const two = await setup();
    await two.repo.importBackup(data);
    const n = (await two.repo.getNote(a))!;
    assert.deepEqual(n.attachments.map((x) => x.kind), ['audio', 'image']);
    assert.equal(n.attachments[1].text, 'Hello');
    assert.deepEqual(titles(await two.repo.searchNotes('hello')), ['Mixed']);

    const old = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    old.schema_version = 3;
    (old.attachments as Record<string, unknown>[]).forEach((x) => delete x.text);
    const three = await setup();
    await three.repo.importBackup(old);
    assert.deepEqual((await three.repo.unreadPhotos()).map((x) => x.fileName), ['p.jpg']);
  });
});

describe('photo reader queue', () => {
  const store = (files: Set<string>) =>
    ({ uri: async (n: string) => (files.has(n) ? `file:///store/${n}` : null) }) as unknown as import('../types').FileStore;

  test('reads each unread photo once; missing files and failures are skipped, not looped on', async () => {
    const { createPhotoQueue, joinBlocks } = await import('../photoQueue');
    const { repo } = await setup();
    const a = await note(repo, 'Many');
    // 25 photos: more than one batch. Two have no file yet, one fails to read.
    const names = Array.from({ length: 25 }, (_, i) => `p${i}.jpg`);
    await repo.addAttachments(a, names.map(photo));
    const files = new Set(names.filter((n) => n !== 'p3.jpg' && n !== 'p20.jpg'));
    const seen: string[] = [];
    const q = createPhotoQueue(async (uri) => {
      seen.push(uri);
      if (uri.endsWith('p7.jpg')) throw new Error('bad image');
      return uri.endsWith('p0.jpg') ? ['  INVOICE  2231 ', '', 'Total'] : [];
    });
    assert.equal(await q.run(repo, store(files)), 22);
    assert.equal(new Set(seen).size, seen.length, 'no photo read twice');
    assert.deepEqual((await repo.unreadPhotos(50)).map((x) => x.fileName).sort(), ['p20.jpg', 'p3.jpg', 'p7.jpg']);
    assert.deepEqual(titles(await repo.searchNotes('invoice')), ['Many']);
    // A second run in the same session does not retry the skipped ones.
    assert.equal(await q.run(repo, store(files)), 0);
    assert.equal(joinBlocks(['  INVOICE  2231 ', '', 'Total']), 'INVOICE 2231\nTotal');
  });
});
