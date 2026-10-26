-- Schema for Pocketleaf: notes, lists, folders and reminders, stored on the phone.
-- SQLite on the device, through expo-sqlite. This is the first migration.
--
-- Conventions, adapted from Postgres to SQLite:
--   ids     TEXT uuid v4, made in the app with expo-crypto randomUUID()
--   times   INTEGER milliseconds since epoch, always UTC
--   bools   INTEGER 0 or 1, with a check
-- There is no owner column: the database lives on one phone and belongs to one
-- person, so there are no access rules to enforce (see architecture.md).
--
-- Every connection must run:  PRAGMA foreign_keys = ON;
-- SQLite ignores the ON DELETE rules below without it.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

create table folders (
  id          text primary key not null,
  name        text not null check (length(trim(name)) between 1 and 60),
  position    integer not null default 0,
  created_at  integer not null,
  updated_at  integer not null
);
-- "Work" and "work" are the same folder (recon F04 edge: duplicate names)
create unique index folders_name_unique on folders (name collate nocase);
create index folders_position on folders (position);

create table notes (
  id           text primary key not null,
  type         text not null check (type in ('text', 'checklist')),
  title        text not null default '',
  body         text not null default '',          -- unused for checklists
  color        text not null default 'default',   -- a token role name, never a hex value
  font_family  text not null default 'default',   -- a token name: default | serif | mono | hand
  font_size    text not null default 'm' check (font_size in ('s', 'm', 'l', 'xl')),
  folder_id    text references folders (id) on delete set null,  -- deleting a folder keeps its notes
  pinned       integer not null default 0 check (pinned in (0, 1)),
  created_at   integer not null,
  updated_at   integer not null,
  deleted_at   integer                             -- not null = in the trash
);
-- home list: not deleted, pinned first, newest first
create index notes_home on notes (deleted_at, pinned desc, updated_at desc);
create index notes_folder on notes (folder_id, deleted_at, updated_at desc);
create index notes_trash on notes (deleted_at) where deleted_at is not null;

create table checklist_items (
  id          text primary key not null,
  note_id     text not null references notes (id) on delete cascade,
  text        text not null default '',
  checked     integer not null default 0 check (checked in (0, 1)),
  position    integer not null,
  created_at  integer not null,
  updated_at  integer not null
);
create index checklist_items_note on checklist_items (note_id, position);

create table reminders (
  id                  text primary key not null,
  note_id             text not null unique references notes (id) on delete cascade,  -- one per note
  fire_at             integer not null,           -- next time it fires, UTC ms
  timezone            text not null,              -- IANA zone it was set in, e.g. Europe/Belgrade
  local_time          text not null,              -- 'HH:MM' wall-clock time, so repeats keep it across DST
  repeat              text not null default 'none'
                      check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  os_notification_id  text,                       -- id returned by expo-notifications, null if not scheduled
  status              text not null default 'scheduled'
                      check (status in ('scheduled', 'fired', 'done')),
  created_at          integer not null,
  updated_at          integer not null
);
create index reminders_due on reminders (status, fire_at);

create table settings (
  key    text primary key not null
         check (key in ('view_mode', 'sort', 'theme', 'last_backup_at', 'last_snapshot_at')),
  value  text not null
);

-- Search. One row per note: title, plus body or all checklist item texts.
-- remove_diacritics 2 makes "cafe" find "Café"; unicode61 is case-insensitive.
-- Kept in step by the triggers below, so it can never drift from the data.
create virtual table notes_fts using fts5 (
  note_id unindexed,
  title,
  content,
  tokenize = 'unicode61 remove_diacritics 2'
);

create trigger notes_fts_insert after insert on notes begin
  insert into notes_fts (note_id, title, content) values (new.id, new.title, new.body);
end;

create trigger notes_fts_update after update of title, body on notes begin
  delete from notes_fts where note_id = new.id;
  insert into notes_fts (note_id, title, content)
    select n.id, n.title,
           n.body || ' ' || coalesce((select group_concat(text, ' ')
                                      from checklist_items where note_id = n.id), '')
    from notes n where n.id = new.id;
end;

create trigger notes_fts_delete after delete on notes begin
  delete from notes_fts where note_id = old.id;
end;

create trigger checklist_fts_insert after insert on checklist_items begin
  delete from notes_fts where note_id = new.note_id;
  insert into notes_fts (note_id, title, content)
    select n.id, n.title,
           n.body || ' ' || coalesce((select group_concat(text, ' ')
                                      from checklist_items where note_id = n.id), '')
    from notes n where n.id = new.note_id;
end;

create trigger checklist_fts_update after update of text on checklist_items begin
  delete from notes_fts where note_id = new.note_id;
  insert into notes_fts (note_id, title, content)
    select n.id, n.title,
           n.body || ' ' || coalesce((select group_concat(text, ' ')
                                      from checklist_items where note_id = n.id), '')
    from notes n where n.id = new.note_id;
end;

create trigger checklist_fts_delete after delete on checklist_items begin
  delete from notes_fts where note_id = old.note_id;
  insert into notes_fts (note_id, title, content)
    select n.id, n.title,
           n.body || ' ' || coalesce((select group_concat(text, ' ')
                                      from checklist_items where note_id = n.id), '')
    from notes n where n.id = old.note_id;
end;

PRAGMA user_version = 1;
