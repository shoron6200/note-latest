# Architecture: your notes app (a rebuild of App Notes' core features)

Reads `replica/recon.md` and `replica/features.csv`. Built for your own use on
Android and iOS. The working name is "Notes" until `/replica-brand`.

## The big decision: local-first, no server

The original keeps notes on the phone and adds cloud backup on top. For one
person that is also the right design for your version:

- it works offline and opens instantly
- you need no accounts, no passwords and no monthly bill
- your notes never leave the phone unless you send them somewhere

So most of the default web stack (Postgres, auth, payments, email, hosting)
does not apply. If you later want the same notes on two phones, add sync with
Supabase as its own milestone. The schema below is ready for that: uuid ids
and `updated_at` on every row.

## Stack

| layer | choice | why |
| --- | --- | --- |
| app | Expo (React Native) + TypeScript, SDK 54 or newer | one codebase for Android and iOS, the scope you picked |
| navigation | expo-router | file-based routes, deep links from notifications for free |
| database | SQLite on the device via `expo-sqlite` | fast, offline, has FTS5 for full-text search, no server |
| ORM | Drizzle (`drizzle-orm/expo-sqlite`) + drizzle-kit migrations | typed queries, migrations checked in. The FTS table and triggers live in a custom SQL migration |
| styling | a `theme.ts` token file + `StyleSheet`, filled by `/replica-design` | no extra build step, and dark mode is just a second token set |
| reminders | `expo-notifications`, local scheduled notifications | no push server needed, works offline |
| backup | JSON export via `expo-file-system` + `expo-sharing`, import via `expo-document-picker`, plus the phone's own cloud backup | you choose where it goes (Google Drive, iCloud Files, email). Details below |
| sharing text | React Native `Share` API | the system share sheet |
| checklist reorder | `react-native-draggable-flatlist` (on Reanimated and Gesture Handler) | drag to reorder that works well on both platforms |
| date/time picker | `@react-native-community/datetimepicker` | the native picker on each platform |
| ids | `expo-crypto` `randomUUID()` | uuids on the device, safe to merge across backups |
| tests | Jest + React Native Testing Library for the data layer and screens; Maestro for end-to-end flows on a device | Playwright cannot drive a native app; Maestro is the mobile equivalent |
| builds | EAS Build | Android: an APK from the `preview` profile, installed straight on your phone. iOS: see the note below |
| auth, payments, email, server jobs, hosting | none | single user, on device, no money involved |

**Installing on iOS for your own use.** iPhone apps need signing. A free Apple
ID can install a build from Xcode, but it expires after 7 days. A paid Apple
Developer account ($99 a year) gives you TestFlight and builds that last.
Android has no such limit: you just install the APK.

## Schema

Tables: 5 plus 1 search index (`folders`, `notes`, `checklist_items`,
`reminders`, `settings`, and `notes_fts`). The full SQL is in
`replica/schema.sql`. It was tested on SQLite: accent-free search works,
checklist items are searchable, and deleting a folder keeps its notes.
Deleting a note removes its items, reminder and search row.

Access rules: **none needed.** The database lives in the app's private storage
on one phone, for one person. If sync is added later, each table gets a
`user_id` and Postgres RLS on the server side.

How the inferred model maps to tables (from recon):

| entity | table | notes |
| --- | --- | --- |
| Note | `notes` | `type` text or checklist. `color` and `font_family` hold token names, not values, so a rebrand or dark mode never touches data. `deleted_at` is the trash |
| ChecklistItem | `checklist_items` | `position` for drag order. Cascade-deleted with the note |
| Folder | `folders` | case-insensitive unique name. Deleting a folder sets its notes' `folder_id` to null, and they show under "All" |
| Reminder | `reminders` | one per note (unique `note_id`). Stores the next `fire_at` in UTC, plus the wall-clock `local_time` and IANA `timezone`, so a 09:00 daily reminder stays at 09:00 across DST |
| Settings | `settings` | key/value with a whitelist of keys |
| Backup | not a table | a JSON file, format below |

Hard constraints the recon found, enforced by the database rather than the UI:

- **Duplicate folder names** are blocked by a unique index (`collate nocase`).
- **Deleting a folder deletes no notes.** `on delete set null` handles it.
- **Deleting a note leaves no orphan reminder or items.** `on delete cascade`
  handles it. The app must also cancel the OS notification, because the
  database cannot do that.
- **Search can never go stale.** The `notes_fts` index is kept in step by
  triggers, not by app code.

## API (the data layer)

There is no server, so the "routes" are the functions in `src/data/`. Screens
call only these, never SQL directly. This is the seam where the fake data
layer from `/replica-build` gets swapped for the real one.

| function | does | input | output | flow |
| --- | --- | --- | --- | --- |
| `listNotes` | home list, pinned first, then by chosen sort | `{folderId?, sort}` | `NoteCard[]` (with checklist preview and reminder badge) | F01, F04 |
| `getNote` | one note with items and reminder | `id` | `NoteFull` | all |
| `createNote` | new empty note | `{type, folderId?}` | `id` | F01, F02 |
| `updateNote` | save title, body, colour, font, folder, pinned. Debounced autosave | `id, patch` | `NoteFull` | F01, F03, F04 |
| `discardIfEmpty` | delete a brand-new note left empty | `id` | `boolean` | F01 edge |
| `trashNote` / `restoreNote` | move to or from the trash, and cancel or reschedule its reminder | `id` | void | F08 |
| `deleteForever` / `emptyTrash` | hard delete | `id` / none | void | F08 |
| `duplicateNote` | copy a note and its items, but not its reminder | `id` | `id` | F07 |
| `addItem` / `updateItem` / `removeItem` | checklist rows | `noteId, …` | `Item` | F02 |
| `toggleItem` | tick or untick | `id` | `Item` | F02 |
| `reorderItems` | save the drag order in one transaction | `noteId, ids[]` | void | F02 |
| `listFolders` | folders with note counts | none | `Folder[]` | F04 |
| `createFolder` / `renameFolder` / `deleteFolder` | folder management; a duplicate name returns a typed error | `name` / `id, name` / `id` | `Folder` / void | F04 |
| `searchNotes` | FTS5 query, each word as a prefix (`"charg"*`), escaped | `query` | `NoteCard[]` with match snippet | F05 |
| `setReminder` / `clearReminder` | save the row, schedule or cancel the OS notification | `noteId, {date, time, repeat}` / `noteId` | `Reminder` | F06 |
| `reconcileReminders` | the safety net (see Jobs) | none | count rescheduled | F06 |
| `noteAsText` | plain text for sharing; checklists as "☐ item / ☑ item" | `id` | `string` | F07 |
| `exportBackup` | write the JSON file and open the share sheet | none | file uri | F09 |
| `importBackup` | validate, then merge in one transaction | file uri | `{added, updated, skipped}` | F09 |
| `getSettings` / `setSetting` | view, sort, theme | `key, value` | `Settings` | — |

That is 28 functions in all.

Screen routes (expo-router), matching recon screen IDs:

| route | screen |
| --- | --- |
| `/` | S01 Home (S02 chooser is a sheet on it, S10 actions is a sheet on long-press) |
| `/note/[id]` | S03 Note editor, or S04 Checklist editor depending on `type` (S05, S06, S07, S08, S10 are sheets on it) |
| `/search` | S09 Search |
| `/folders` | S08 Folder manager (full screen) |
| `/trash` | S11 Trash |
| `/settings` | S12 Settings |
| `/settings/backup` | S13 Backup and restore |

S14 (the notification) deep-links to `/note/[id]`.

Webhooks in or out: none. No external APIs: no official API is needed, and the
original's private backend is never touched.

### Jobs

| job | when | what |
| --- | --- | --- |
| `reconcileReminders` | every app start and every return to the foreground | 1. Read all `scheduled` reminders from the database. 2. Roll any repeat whose `fire_at` passed forward to its next time. 3. Mark one-off reminders in the past as `fired`. 4. Compare with `getAllScheduledNotificationsAsync()`, then schedule what is missing and cancel what is not in the database. The database is the truth, the OS schedule is a copy. |
| `rollRepeat` | when a repeating notification is received or tapped | compute the next `fire_at` from `local_time` + `timezone`, and schedule only that one |
| `dailySnapshot` | app start, if the last snapshot is over 24h old | write the backup JSON into the app's documents folder and keep the last 7. This is what the phone's own cloud backup picks up |
| `purgeTrash` (could) | app start | hard-delete notes in the trash for more than 30 days |

### Backup format and where it goes

```json
{
  "format": "notes-backup",
  "schema_version": 1,
  "exported_at": "2026-10-18T09:00:00Z",
  "folders": [...], "notes": [...], "checklist_items": [...],
  "reminders": [...], "settings": {...}
}
```

| need | how | feature row |
| --- | --- | --- |
| back up now | `exportBackup` saves `notes-backup-2026-10-18.json` and opens the share sheet. You pick Google Drive, Files/iCloud Drive or email | should: back up to your own cloud |
| restore | the document picker opens a backup, it is validated (format, version, ids, foreign keys), and then merged | should: restore |
| automatic | `dailySnapshot` keeps 7 rolling local backups. Android's Auto Backup (keep `android.allowBackup` on) and iCloud device backup include the app's files, so they reach your Google or Apple cloud with no code | could: automatic backup |

**Merge rule on restore:** match rows by id. A row only in the backup is
added. When a row exists in both, the newer `updated_at` wins, and a trashed
note stays trashed if that version is newer. Nothing is deleted by a restore.
Afterwards, `reconcileReminders` runs.

Direct upload to Google Drive through its API was considered and left out for
now. It needs a Google Cloud project, OAuth and native sign-in on both
platforms, which is a lot of moving parts for one user when the share sheet
already reaches Drive.

## The parts that bite

- **Time zones and DST.** Store `fire_at` in UTC, plus `local_time` and
  `timezone`. Compute repeats from the wall-clock time in that zone, never by
  adding 24h in UTC, or a 09:00 reminder drifts to 08:00 or 10:00 after a DST
  change. If the phone's zone changes (travel), keep the zone stored on the
  reminder; the reminder picker shows which zone it is in.
- **Reminders getting lost.**
  - Android clears scheduled alarms when the phone reboots.
  - Android 12+ needs the exact-alarm permission. On Android 14+ that
    permission is off by default, and without it reminders can arrive late.
    The reminder sheet should check it and offer to open the setting.
  - Android 13+ and iOS both need the notification permission to be granted
    first.
  - iOS keeps at most 64 pending local notifications per app.

  `reconcileReminders` on every launch covers all of these. On iOS, schedule
  only the 64 soonest.
- **Never losing text.**
  - Autosave is debounced (about 500 ms) and also flushes when the app goes
    to the background, when you leave the editor, and on Android's back
    button.
  - `journal_mode = WAL` keeps writes safe.
  - A new note that stays empty is discarded, not saved.
- **Foreign keys.** SQLite ignores `on delete` rules unless `PRAGMA
  foreign_keys = ON` runs on every connection. Set it where the connection is
  opened, and test it.
- **Search.** User input must be escaped before it reaches FTS5 `MATCH`. Wrap
  each word in quotes, add `*` for prefixes, and drop FTS operators, or a
  query like `"` or `AND` throws. Searching while typing is debounced.
- **Races.** Autosave can fire while a toggle is still writing. Run all writes
  through one queue (or `withTransactionAsync`) so the last write wins in
  order. `reorderItems` and `importBackup` are single transactions.
- **Idempotency.** Importing the same backup twice must change nothing on the
  second run; merging by id with the newer-wins rule gives that. Scheduling a
  reminder always cancels its old `os_notification_id` first.
- **Big notes and big backups.** Keep note bodies as plain text. The note
  list shows a ~200-character preview computed in SQL (`substr`), not the
  whole body. Backups stay small (text only, no images in this slice).
- **Deleting your data.** The original's listing says data cannot be deleted.
  Here, "delete forever", "empty trash" and uninstalling actually remove
  everything. Write that in Settings → About.
- **Not applicable here:** realtime, email deliverability, rate limits,
  multi-tenancy, payments idempotency.

## Build order

1. **Vertical slice**, ugly but working:
   - Screens: S01 Home, then FAB, then S03 Note editor (text only), with
     autosave, back, the note on the list, and kill and reopen still showing
     it.
   - Tables: `notes` plus the FTS triggers (the full first migration runs,
     only `notes` is used).
   - Functions: `createNote`, `updateNote`, `discardIfEmpty`, `listNotes`,
     `getNote`.
   - Proves: Expo, expo-router, expo-sqlite, Drizzle migrations, autosave.
2. **Must-haves**, by area:
   1. Checklists: S02 chooser, S04 editor; `checklist_items`; add, update,
      remove and toggle item functions.
   2. Delete with a confirm step: S10 actions; `trashNote` (the trash itself
      is a could, so for now "delete" can be `deleteForever` behind the
      confirm).
   3. Colour: S05; the `color` token, shown on S01 cards.
   4. Folders: S08 sheet + `/folders`; `folders`; `listFolders`,
      `createFolder`, folder filter on S01.
   5. Search: S09; `searchNotes` with escaping.
   6. Reminders: S07 + S14 deep link; `reminders`; `setReminder`,
      `clearReminder`, `reconcileReminders`; the permission flows.
   7. Share: S10 share; `noteAsText`.
3. **Should-haves:**
   - S06 font and size
   - drag to reorder
   - rename and delete folders
   - repeating reminders + `rollRepeat`
   - the reboot and DST hardening
   - grid or list view, and sort (S12)
   - S13 back up now and restore
   - dark mode tokens

   **Then could-haves:**
   - S11 trash + `purgeTrash`
   - undo snackbar
   - pinning
   - `dailySnapshot`
   - search highlight
4. **Fixes from `/replica-entrepreneur`:** none yet. Run it to read what the
   original's 1.3K+ reviewers complain about; it adds rows to `features.csv`
   with `original` = `no`.
