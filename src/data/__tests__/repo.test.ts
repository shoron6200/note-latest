import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { migrate, SCHEMA_VERSION } from '../migrations';
import { createRepo, ftsQuery } from '../repo';
import { DuplicateFolderError } from '../types';

import { nodeDb, setup } from './helpers';

describe('schema', () => {
  test('migrates to the latest version with full-text search', async () => {
    const { db, fts } = await setup();
    assert.equal(fts, true);
    const v = await db.first<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, SCHEMA_VERSION);
  });

  test('an existing version 2 database keeps its settings when it moves to the latest version', async () => {
    const db = nodeDb();
    await db.exec(`create table settings (key text primary key not null
      check (key in ('view_mode', 'sort', 'theme', 'last_backup_at', 'last_snapshot_at')), value text not null);
      insert into settings values ('theme', 'dark');
      PRAGMA user_version = 2;`);
    // v1 tables, as a real v2 phone has them.
    await db.exec(`create table folders (id text primary key, name text, position integer, created_at integer, updated_at integer);
      create table notes (id text primary key, type text, title text, body text, color text, font_family text, font_size text,
        folder_id text, pinned integer, created_at integer, updated_at integer, deleted_at integer);`);
    await migrate(db);
    const v = await db.first<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, SCHEMA_VERSION);
    assert.deepEqual((await db.all<{ key: string; value: string }>('select key, value from settings')).map((r) => [r.key, r.value]), [['theme', 'dark']]);
    await db.run("insert into settings values ('last_telegram_at', '1')");
  });
});

describe('notes', () => {
  test('home list: pinned first, then last edited; pinning does not count as an edit', async () => {
    const { repo, tick } = await setup();
    const a = await repo.createNote({ type: 'text' });
    await repo.updateNote(a, { title: 'A' });
    tick();
    const b = await repo.createNote({ type: 'text' });
    await repo.updateNote(b, { title: 'B' });
    tick();
    assert.deepEqual((await repo.listNotes()).map((n) => n.title), ['B', 'A']);
    await repo.updateNote(a, { pinned: true });
    tick();
    assert.deepEqual((await repo.listNotes()).map((n) => n.title), ['A', 'B']);
    const before = (await repo.getNote(a))!.updatedAt;
    await repo.updateNote(a, { pinned: false });
    assert.equal((await repo.getNote(a))!.updatedAt, before);
  });

  test('sort by title puts untitled notes last', async () => {
    const { repo, tick } = await setup();
    for (const t of ['banana', '', 'Apple']) {
      const id = await repo.createNote({ type: 'text' });
      await repo.updateNote(id, { title: t, body: 'x' });
      tick();
    }
    assert.deepEqual((await repo.listNotes({ sort: 'title' })).map((n) => n.title), ['Apple', 'banana', '']);
  });

  test('an empty new note is discarded, a written one is kept', async () => {
    const { repo } = await setup();
    const empty = await repo.createNote({ type: 'text' });
    await repo.updateNote(empty, { title: '   ', body: '\n' });
    assert.equal(await repo.discardIfEmpty(empty), true);
    assert.equal(await repo.getNote(empty), null);
    const kept = await repo.createNote({ type: 'checklist' });
    await repo.addItem(kept, { text: 'milk' });
    assert.equal(await repo.discardIfEmpty(kept), false);
  });

  test('preview is capped and text notes have no items', async () => {
    const { repo } = await setup();
    const id = await repo.createNote({ type: 'text' });
    await repo.updateNote(id, { body: 'x'.repeat(1000) });
    const [s] = await repo.listNotes();
    assert.equal(s.preview.length, 200);
    assert.equal(s.itemCount, 0);
  });

  test('duplicate copies items but not the reminder', async () => {
    const { repo, clock } = await setup();
    const id = await repo.createNote({ type: 'checklist' });
    await repo.addItem(id, { text: 'one' });
    await repo.setReminder(id, { fireAt: clock.t + 3600_000, timezone: 'UTC', localTime: '11:00', repeat: 'none' });
    const copy = (await repo.duplicateNote(id))!;
    const full = (await repo.getNote(copy))!;
    assert.equal(full.items[0].text, 'one');
    assert.equal(full.reminder, null);
  });
});

describe('checklists', () => {
  test('add, toggle, reorder, counts and card preview (unchecked first)', async () => {
    const { repo } = await setup();
    const id = await repo.createNote({ type: 'checklist' });
    const a = await repo.addItem(id, { text: 'a' });
    const b = await repo.addItem(id, { text: 'b' });
    const c = await repo.addItem(id, { text: 'c' });
    await repo.addItem(id, { text: '   ' }); // blank rows are not counted
    await repo.toggleItem(a.id);
    await repo.reorderItems(id, [c.id, b.id, a.id]);
    const full = (await repo.getNote(id))!;
    assert.deepEqual(full.items.slice(0, 3).map((i) => i.text), ['c', 'b', 'a']);
    const [card] = await repo.listNotes();
    assert.equal(card.itemCount, 3);
    assert.equal(card.doneCount, 1);
    assert.deepEqual(card.items.map((i) => i.text), ['c', 'b', 'a']);
  });

  test('insert after an item shifts the rest down', async () => {
    const { repo } = await setup();
    const id = await repo.createNote({ type: 'checklist' });
    const a = await repo.addItem(id, { text: 'a' });
    await repo.addItem(id, { text: 'c' });
    await repo.addItem(id, { text: 'b', after: a.id });
    assert.deepEqual((await repo.getNote(id))!.items.map((i) => i.text), ['a', 'b', 'c']);
  });

  test('convert text <-> checklist keeps the lines', async () => {
    const { repo } = await setup();
    const id = await repo.createNote({ type: 'text' });
    await repo.updateNote(id, { body: '- eggs\n\n• milk\n[ ] bread' });
    await repo.convertNote(id, 'checklist');
    assert.deepEqual((await repo.getNote(id))!.items.map((i) => i.text), ['eggs', 'milk', 'bread']);
    await repo.convertNote(id, 'text');
    assert.equal((await repo.getNote(id))!.body, 'eggs\nmilk\nbread');
  });
});

describe('folders', () => {
  test('names are unique regardless of case', async () => {
    const { repo } = await setup();
    await repo.createFolder('Work');
    await assert.rejects(repo.createFolder('  work '), DuplicateFolderError);
  });

  test('deleting a folder keeps its notes', async () => {
    const { repo } = await setup();
    const f = await repo.createFolder('Home');
    const id = await repo.createNote({ type: 'text', folderId: f.id });
    await repo.updateNote(id, { title: 'kept' });
    assert.equal((await repo.listFolders())[0].count, 1);
    assert.equal((await repo.listNotes({ folderId: f.id })).length, 1);
    await repo.deleteFolder(f.id);
    const n = (await repo.getNote(id))!;
    assert.equal(n.folderId, null);
    assert.equal(n.title, 'kept');
  });
});

describe('search', () => {
  async function seeded(fts?: boolean) {
    const s = await setup({ fts });
    const t = await s.repo.createNote({ type: 'text' });
    await s.repo.updateNote(t, { title: 'Weekend', body: 'Coffee at the Café near the station' });
    const l = await s.repo.createNote({ type: 'checklist' });
    await s.repo.updateNote(l, { title: 'Trip' });
    await s.repo.addItem(l, { text: 'Passport' });
    const gone = await s.repo.createNote({ type: 'text' });
    await s.repo.updateNote(gone, { body: 'passport photo' });
    await s.repo.trashNote(gone);
    return { ...s, t, l };
  }

  for (const mode of ['fts', 'like'] as const) {
    test(`${mode}: accents, case, prefixes, checklist items, trash excluded`, async () => {
      const { repo, t, l } = await seeded(mode === 'fts' ? undefined : false);
      assert.deepEqual((await repo.searchNotes('cafe')).map((n) => n.id), [t]);
      assert.deepEqual((await repo.searchNotes('PASS')).map((n) => n.id), [l]);
      assert.deepEqual((await repo.searchNotes('coffee station')).map((n) => n.id), [t]);
      assert.deepEqual(await repo.searchNotes('zebra'), []);
    });
  }

  test('user input cannot break the FTS query', async () => {
    const { repo } = await seeded();
    for (const q of ['"', 'AND', '(', '*', 'a OR', 'NEAR(', "it's", '-', '^x']) {
      await repo.searchNotes(q); // must not throw
    }
    assert.equal(ftsQuery('  AND  '), null);
    assert.equal(ftsQuery('caf'), '"caf"*');
  });

  test('editing an item updates the index', async () => {
    const { repo, l } = await seeded();
    const item = (await repo.getNote(l))!.items[0];
    await repo.updateItem(item.id, 'Visa');
    assert.deepEqual(await repo.searchNotes('passport'), []);
    assert.deepEqual((await repo.searchNotes('visa')).map((n) => n.id), [l]);
  });
});

describe('trash', () => {
  test('trash cancels the reminder, restore reschedules it, purge removes old ones', async () => {
    const { repo, clock, scheduler } = await setup();
    const id = await repo.createNote({ type: 'text' });
    await repo.updateNote(id, { title: 'Dentist' });
    await repo.setReminder(id, { fireAt: clock.t + 86_400_000, timezone: 'UTC', localTime: '10:00', repeat: 'none' });
    assert.equal(scheduler.pending.size, 1);
    await repo.trashNote(id);
    assert.equal(scheduler.pending.size, 0);
    assert.equal((await repo.listNotes()).length, 0);
    assert.equal((await repo.listTrash()).length, 1);
    await repo.restoreNote(id);
    assert.equal(scheduler.pending.size, 1);
    await repo.trashNote(id);
    clock.t += 31 * 86_400_000;
    assert.equal(await repo.purgeTrash(), 1);
    assert.equal(await repo.getNote(id), null);
  });
});

describe('reminders', () => {
  test('a reminder in the past is saved but not scheduled', async () => {
    const { repo, clock, scheduler } = await setup();
    const id = await repo.createNote({ type: 'text' });
    await repo.setReminder(id, { fireAt: clock.t - 1000, timezone: 'UTC', localTime: '09:59', repeat: 'none' });
    assert.equal(scheduler.pending.size, 0);
  });

  test('notification text uses the title, or the first line', async () => {
    const { repo, clock, scheduler } = await setup();
    const id = await repo.createNote({ type: 'checklist' });
    await repo.addItem(id, { text: 'Buy stamps' });
    await repo.setReminder(id, { fireAt: clock.t + 60_000, timezone: 'UTC', localTime: '10:01', repeat: 'none' });
    assert.equal([...scheduler.pending.values()][0].title, 'Buy stamps');
    await repo.updateNote(id, { title: 'Post office' });
    const r = [...scheduler.pending.values()];
    assert.equal(r.length, 1);
    assert.equal(r[0].title, 'Post office');
  });

  test('reconcile: rolls repeats, marks one-offs fired, respects the pending limit, cancels strays', async () => {
    const { repo, clock, scheduler } = await setup();
    scheduler.maxPending = 2;
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await repo.createNote({ type: 'text' });
      await repo.updateNote(id, { title: `n${i}` });
      ids.push(id);
    }
    await repo.setReminder(ids[0], { fireAt: clock.t + 3600_000, timezone: 'UTC', localTime: '11:00', repeat: 'daily' });
    await repo.setReminder(ids[1], { fireAt: clock.t + 7200_000, timezone: 'UTC', localTime: '12:00', repeat: 'none' });
    await repo.setReminder(ids[2], { fireAt: clock.t + 10_800_000, timezone: 'UTC', localTime: '13:00', repeat: 'none' });
    await scheduler.schedule({ noteId: 'ghost', title: '', body: '', fireAt: 0 }); // left over from an old install
    clock.t += 2.5 * 3600_000; // 12:30: the daily and one one-off have passed
    const res = await repo.reconcileReminders();
    assert.equal(res.rolled, 1);
    const daily = (await repo.getNote(ids[0]))!.reminder!;
    assert.equal(daily.fireAt, Date.UTC(2026, 9, 19, 11, 0));
    assert.equal((await repo.getNote(ids[1]))!.reminder!.status, 'fired');
    const pendingNotes = [...scheduler.pending.values()].map((p) => p.noteId).sort();
    assert.deepEqual(pendingNotes, [ids[0], ids[2]].sort());
    assert.ok(![...scheduler.pending.values()].some((p) => p.noteId === 'ghost'));
    // Idempotent: a second run changes nothing.
    const again = await repo.reconcileReminders();
    assert.deepEqual(again, { scheduled: 0, cancelled: 0, rolled: 0 });
  });

  test('reminderFired rolls a weekly reminder forward and reschedules it', async () => {
    const { repo, clock, scheduler } = await setup();
    const id = await repo.createNote({ type: 'text' });
    const at = clock.t + 60_000;
    await repo.setReminder(id, { fireAt: at, timezone: 'UTC', localTime: '10:01', repeat: 'weekly' });
    clock.t = at + 1000;
    await repo.reminderFired(id);
    const r = (await repo.getNote(id))!.reminder!;
    assert.equal(r.fireAt, at + 7 * 86_400_000);
    assert.equal(scheduler.pending.size, 1);
  });
});

describe('share and backup', () => {
  test('noteAsText', async () => {
    const { repo } = await setup();
    const id = await repo.createNote({ type: 'checklist' });
    await repo.updateNote(id, { title: 'Trip' });
    const a = await repo.addItem(id, { text: 'Passport' });
    await repo.addItem(id, { text: 'Chargers' });
    await repo.toggleItem(a.id);
    assert.equal(await repo.noteAsText(id), 'Trip\n\n☑ Passport\n☐ Chargers');
  });

  test('round trip, idempotent re-import, newer wins, nothing deleted', async () => {
    const src = await setup();
    const f = await src.repo.createFolder('Work');
    const n = await src.repo.createNote({ type: 'checklist', folderId: f.id });
    await src.repo.updateNote(n, { title: 'Plan', color: 'green' });
    await src.repo.addItem(n, { text: 'step 1' });
    await src.repo.setReminder(n, { fireAt: src.clock.t + 3600_000, timezone: 'Europe/Belgrade', localTime: '13:00', repeat: 'daily' });
    const backup = JSON.parse(JSON.stringify(await src.repo.exportBackup()));
    assert.equal(backup.reminders[0].os_notification_id, null);

    const dst = await setup();
    const local = await dst.repo.createNote({ type: 'text' });
    await dst.repo.updateNote(local, { title: 'only here' });
    const r1 = await dst.repo.importBackup(backup);
    assert.deepEqual(r1, { added: 2, updated: 0, skipped: 0 });
    const got = (await dst.repo.getNote(n))!;
    assert.equal(got.title, 'Plan');
    assert.equal(got.color, 'green');
    assert.equal(got.items[0].text, 'step 1');
    assert.equal(got.reminder?.localTime, '13:00');
    assert.equal(got.folderId, f.id);
    assert.ok(await dst.repo.getNote(local));

    const r2 = await dst.repo.importBackup(backup);
    assert.deepEqual(r2, { added: 0, updated: 0, skipped: 2 });

    // The phone has a newer edit: the backup must not overwrite it.
    dst.clock.t += 60_000;
    await dst.repo.updateNote(n, { title: 'Plan v2' });
    await dst.repo.importBackup(backup);
    assert.equal((await dst.repo.getNote(n))!.title, 'Plan v2');
  });

  test('rejects files that are not backups', async () => {
    const { repo } = await setup();
    await assert.rejects(repo.importBackup({ hello: 1 }), /not a Pocketleaf backup/);
    await assert.rejects(repo.importBackup({ format: 'pocketleaf-backup', schema_version: 99 }), /newer version/);
  });

  test('a folder with the same name but another id is merged, not duplicated', async () => {
    const src = await setup();
    const f = await src.repo.createFolder('Work');
    const n = await src.repo.createNote({ type: 'text', folderId: f.id });
    await src.repo.updateNote(n, { title: 'x' });
    const backup = await src.repo.exportBackup();
    const dst = await setup();
    const mine = await dst.repo.createFolder('work');
    await dst.repo.importBackup(backup);
    assert.equal((await dst.repo.listFolders()).length, 1);
    assert.equal((await dst.repo.getNote(n))!.folderId, mine.id);
  });
});

describe('settings', () => {
  test('defaults and round trip', async () => {
    const { repo } = await setup();
    assert.deepEqual(await repo.getSettings(), {
      viewMode: 'grid',
      sort: 'updated',
      theme: 'system',
      lastBackupAt: null,
      lastSnapshotAt: null,
      lastTelegramAt: null,
      telegramAuto: true,
      voiceOnline: false,
    });
    await repo.setSetting('telegramAuto', false);
    assert.equal((await repo.getSettings()).telegramAuto, false);
    await repo.setSetting('theme', 'dark');
    await repo.setSetting('lastBackupAt', 123);
    const s = await repo.getSettings();
    assert.equal(s.theme, 'dark');
    assert.equal(s.lastBackupAt, 123);
  });
});

describe('concurrency', () => {
  test('writes run in order even when fired together', async () => {
    const { db, repo } = await setup();
    const id = await repo.createNote({ type: 'text' });
    await Promise.all(Array.from({ length: 20 }, (_, i) => repo.updateNote(id, { body: `v${i}` })));
    assert.equal((await repo.getNote(id))!.body, 'v19');
    // A failed write does not jam the queue.
    const bad = createRepo({ db, fts: true, newId: () => 'dup', now: () => 1 });
    await bad.createFolder('A');
    await assert.rejects(bad.createFolder('B'));
    assert.equal((await bad.listFolders()).length, 1);
  });
});

describe('folders, renaming', () => {
  test('renaming onto another folder name is refused, renaming to its own name in new case is fine', async () => {
    const { repo } = await setup();
    const a = await repo.createFolder('Work');
    await repo.createFolder('Home');
    await assert.rejects(repo.renameFolder(a.id, 'HOME'), DuplicateFolderError);
    await repo.renameFolder(a.id, 'WORK');
    assert.equal((await repo.listFolders()).find((f) => f.id === a.id)?.name, 'WORK');
  });
});
