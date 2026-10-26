import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { migrate, SCHEMA_VERSION } from '../migrations';
import { BACKUP_VERSION, LABEL_LIMIT } from '../repo';
import { DuplicateLabelError, LabelLimitError } from '../types';

import { nodeDb, setup } from './helpers';

const titles = (ns: { title: string }[]) => ns.map((n) => n.title);

async function note(repo: Awaited<ReturnType<typeof setup>>['repo'], title: string, extra: { pinned?: boolean } = {}) {
  const id = await repo.createNote({ type: 'text' });
  await repo.updateNote(id, { title, ...(extra.pinned ? { pinned: true } : {}) });
  return id;
}

describe('schema v4', () => {
  test('a version 3 phone keeps its notes; they start unarchived and unlabelled', async () => {
    const { db, repo } = await setup();
    const id = await note(repo, 'Old');
    // Pretend this database stopped at version 3.
    await db.exec(`drop table note_labels; drop table labels; drop index notes_archived;
      alter table notes drop column archived; PRAGMA user_version = 3;`);
    await migrate(db);
    const v = await db.first<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, SCHEMA_VERSION);
    const n = await repo.getNote(id);
    assert.equal(n?.archived, false);
    assert.deepEqual(n?.labels, []);
  });

  test('a fresh database migrates straight to the latest version', async () => {
    const db = nodeDb();
    await migrate(db);
    assert.equal((await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version, SCHEMA_VERSION);
  });
});

describe('archive', () => {
  test('archived notes leave the home list and appear in the archive; archiving is not an edit', async () => {
    const { repo, tick } = await setup();
    const a = await note(repo, 'A');
    await note(repo, 'B');
    const before = (await repo.getNote(a))!.updatedAt;
    tick();
    await repo.updateNote(a, { archived: true });
    assert.deepEqual(titles(await repo.listNotes()), ['B']);
    assert.deepEqual(titles(await repo.listView({ kind: 'archive' })), ['A']);
    assert.equal((await repo.getNote(a))!.updatedAt, before);
  });

  test('archiving a pinned note unpins it; pinning an archived note unarchives it', async () => {
    const { repo } = await setup();
    const a = await note(repo, 'A', { pinned: true });
    await repo.updateNote(a, { archived: true });
    let n = (await repo.getNote(a))!;
    assert.equal(n.archived, true);
    assert.equal(n.pinned, false);
    await repo.updateNote(a, { pinned: true });
    n = (await repo.getNote(a))!;
    assert.equal(n.archived, false);
    assert.equal(n.pinned, true);
  });

  test('bulk changes report what was unpinned or unarchived on the way', async () => {
    const { repo } = await setup();
    const a = await note(repo, 'A', { pinned: true });
    const b = await note(repo, 'B');
    const r1 = await repo.updateNotes([a, b], { archived: true });
    assert.deepEqual(r1, { changed: 2, unpinned: 1, unarchived: 0 });
    const r2 = await repo.updateNotes([a, b], { pinned: true });
    assert.deepEqual(r2, { changed: 2, unpinned: 0, unarchived: 2 });
    const r3 = await repo.updateNotes([a], { color: 'blue' });
    assert.equal(r3.changed, 1);
    assert.equal((await repo.getNote(a))!.color, 'blue');
  });

  test('trash unpins; restore brings a note back unpinned; bulk trash and restore', async () => {
    const { repo } = await setup();
    const a = await note(repo, 'A', { pinned: true });
    const b = await note(repo, 'B');
    const r = await repo.trashNotes([a, b]);
    assert.deepEqual(r, { changed: 2, unpinned: 1, unarchived: 0 });
    assert.equal((await repo.listTrash()).length, 2);
    await repo.restoreNotes([a, b]);
    assert.deepEqual(titles(await repo.listNotes()).sort(), ['A', 'B']);
    assert.equal((await repo.getNote(a))!.pinned, false);
    await repo.trashNotes([a]);
    await repo.deleteNotesForever([a]);
    assert.equal(await repo.getNote(a), null);
  });

  test('an archived note keeps its reminder scheduled', async () => {
    const { repo, clock, scheduler } = await setup();
    const a = await note(repo, 'A');
    await repo.setReminder(a, { fireAt: clock.t + 3600_000, timezone: 'UTC', localTime: '11:00', repeat: 'none' });
    await repo.updateNote(a, { archived: true });
    assert.equal(scheduler.pending.size, 1);
    assert.deepEqual(titles(await repo.listView({ kind: 'reminders' })), ['A']);
  });
});

describe('labels', () => {
  test('create, list with counts, names unique whatever the case, spaces tidied', async () => {
    const { repo } = await setup();
    const work = await repo.createLabel('  Work   stuff ');
    assert.equal(work.name, 'Work stuff');
    await assert.rejects(repo.createLabel('work STUFF'), DuplicateLabelError);
    await assert.rejects(repo.createLabel('   '));
    await assert.rejects(repo.createLabel('x'.repeat(51)));
    const home = await repo.createLabel('Home');
    const a = await note(repo, 'A');
    const b = await note(repo, 'B');
    await repo.setLabel([a, b], work.id, true);
    await repo.setLabel([a], home.id, true);
    await repo.trashNote(b);
    assert.deepEqual(
      (await repo.listLabels()).map((l) => [l.name, l.count]),
      [['Home', 1], ['Work stuff', 1]],
    );
    assert.deepEqual((await repo.getNote(a))!.labels.map((l) => l.name), ['Home', 'Work stuff']);
    const card = (await repo.listNotes()).find((n) => n.id === a)!;
    assert.deepEqual(card.labels.map((l) => l.name), ['Home', 'Work stuff']);
  });

  test('labelling is not an edit; removing works for several notes at once', async () => {
    const { repo, tick } = await setup();
    const l = await repo.createLabel('Ideas');
    const a = await note(repo, 'A');
    const b = await note(repo, 'B');
    const before = (await repo.getNote(a))!.updatedAt;
    tick();
    await repo.setLabel([a, b], l.id, true);
    await repo.setLabel([a, b], l.id, true); // twice is fine
    assert.equal((await repo.getNote(a))!.updatedAt, before);
    await repo.setLabel([a, b], l.id, false);
    assert.equal((await repo.listLabels())[0].count, 0);
  });

  test('rename refuses another label’s name, allows its own in a new case', async () => {
    const { repo } = await setup();
    const a = await repo.createLabel('Alpha');
    await repo.createLabel('Beta');
    await assert.rejects(repo.renameLabel(a.id, 'beta'), DuplicateLabelError);
    await repo.renameLabel(a.id, 'ALPHA');
    assert.deepEqual((await repo.listLabels()).map((l) => l.name), ['ALPHA', 'Beta']);
  });

  test('deleting a label keeps its notes', async () => {
    const { repo } = await setup();
    const l = await repo.createLabel('Temp');
    const a = await note(repo, 'A');
    await repo.setLabel([a], l.id, true);
    await repo.deleteLabel(l.id);
    assert.deepEqual((await repo.getNote(a))!.labels, []);
    assert.equal((await repo.listNotes()).length, 1);
  });

  test('there is a limit', async () => {
    const { repo } = await setup();
    for (let i = 0; i < LABEL_LIMIT; i++) await repo.createLabel(`L${i}`);
    await assert.rejects(repo.createLabel('one more'), LabelLimitError);
  });

  test('a label view shows archived notes too; a note made there gets the label', async () => {
    const { repo } = await setup();
    const l = await repo.createLabel('Trip');
    const a = await note(repo, 'A');
    const b = await note(repo, 'B');
    await repo.setLabel([a, b], l.id, true);
    await repo.updateNote(b, { archived: true });
    assert.deepEqual(titles(await repo.listView({ kind: 'label', id: l.id })).sort(), ['A', 'B']);
    const c = await repo.createNote({ type: 'checklist', labelId: l.id });
    assert.deepEqual((await repo.getNote(c))!.labels.map((x) => x.name), ['Trip']);
  });

  test('make a copy keeps the labels', async () => {
    const { repo } = await setup();
    const l = await repo.createLabel('Keep me');
    const a = await note(repo, 'A');
    await repo.setLabel([a], l.id, true);
    const copyId = await repo.duplicateNote(a);
    assert.deepEqual((await repo.getNote(copyId!))!.labels.map((x) => x.name), ['Keep me']);
  });
});

describe('search filters', () => {
  for (const mode of ['fts', 'like'] as const) {
    test(`${mode}: filter alone, filter with words, archived found last`, async () => {
      const { repo } = await setup({ fts: mode === 'fts' ? undefined : false });
      const l = await repo.createLabel('Food');
      const a = await note(repo, 'Apple pie');
      const b = await note(repo, 'Apple tree');
      const list = await repo.createNote({ type: 'checklist' });
      await repo.updateNote(list, { title: 'Shopping', color: 'yellow' });
      await repo.setLabel([a, list], l.id, true);
      await repo.updateNote(a, { archived: true });

      assert.deepEqual(titles(await repo.searchNotes('', { kind: 'label', id: l.id })), ['Shopping', 'Apple pie']);
      assert.deepEqual(titles(await repo.searchNotes('apple', { kind: 'label', id: l.id })), ['Apple pie']);
      assert.deepEqual(titles(await repo.searchNotes('', { kind: 'type', value: 'checklist' })), ['Shopping']);
      assert.deepEqual(titles(await repo.searchNotes('', { kind: 'color', value: 'yellow' })), ['Shopping']);
      // Archived notes come after the rest.
      assert.deepEqual(titles(await repo.searchNotes('apple')), ['Apple tree', 'Apple pie']);
      assert.deepEqual(await repo.searchNotes(''), []);
      void b;
    });
  }

  test('reminder and media filters', async () => {
    const { repo, clock } = await setup();
    const a = await note(repo, 'With reminder');
    await note(repo, 'Plain');
    await repo.setReminder(a, { fireAt: clock.t + 60_000, timezone: 'UTC', localTime: '10:01', repeat: 'none' });
    assert.deepEqual(titles(await repo.searchNotes('', { kind: 'type', value: 'reminder' })), ['With reminder']);
    assert.deepEqual(await repo.searchNotes('', { kind: 'type', value: 'media' }), []);
  });
});

describe('backup v3', () => {
  test('labels and the archive travel; a same-name label is merged, not doubled', async () => {
    const one = await setup();
    const l = await one.repo.createLabel('Work');
    const a = await note(one.repo, 'A');
    await one.repo.setLabel([a], l.id, true);
    await one.repo.updateNote(a, { archived: true });
    const data = await one.repo.exportBackup();
    assert.equal(data.schema_version, BACKUP_VERSION);

    const two = await setup();
    const mine = await two.repo.createLabel('work');
    await two.repo.importBackup(data);
    const n = (await two.repo.getNote(a))!;
    assert.equal(n.archived, true);
    assert.deepEqual(n.labels.map((x) => x.id), [mine.id]);
    assert.equal((await two.repo.listLabels()).length, 1);

    // Importing again changes nothing.
    const again = await two.repo.importBackup(data);
    assert.equal(again.added + again.updated, 0);
  });

  test('a version 2 backup still imports and leaves labels here alone', async () => {
    const { repo } = await setup();
    const l = await repo.createLabel('Mine');
    const a = await note(repo, 'A');
    await repo.setLabel([a], l.id, true);
    const v2 = await repo.exportBackup() as Record<string, unknown>;
    delete v2.labels;
    delete v2.note_labels;
    v2.schema_version = 2;
    (v2.notes as Record<string, unknown>[]).forEach((n) => {
      delete n.archived;
      n.updated_at = (n.updated_at as number) + 1000; // newer, so the note is replaced
    });
    await repo.importBackup(v2);
    assert.deepEqual((await repo.getNote(a))!.labels.map((x) => x.name), ['Mine']);
  });
});
