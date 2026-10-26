/**
 * The data layer: every function in replica/architecture.md's API table.
 * Screens call only these, never SQL. All writes go through one serial queue,
 * so an autosave and a checkbox tap can never interleave.
 */
import { NOTE_COLORS, NOTE_FONTS, NOTE_SIZES, type NoteColor, type NoteFont, type NoteSize } from '../theme/constants';
import type { Db, Param } from './db';
import { nextOccurrence, type Repeat } from './time';
import {
  BackupFormatError,
  DuplicateFolderError,
  DuplicateLabelError,
  LabelLimitError,
  isVisual,
  type Attachment,
  type AttachmentKind,
  type BrowseView,
  type Folder,
  type Label,
  type LabelRef,
  type Item,
  type NoteFull,
  type NotePatch,
  type NoteSummary,
  type NewAttachment,
  type NoteType,
  type Reminder,
  type Scheduler,
  type SearchFilter,
  type Settings,
  type Sort,
  type TelegramPart,
} from './types';

export type RepoDeps = {
  db: Db;
  fts: boolean;
  newId: () => string;
  now?: () => number;
  scheduler?: Scheduler;
};

export const PREVIEW_CHARS = 200;
export const CARD_ITEMS = 5;
export const TRASH_DAYS = 30;
export const BACKUP_FORMAT = 'pocketleaf-backup';
export const BACKUP_VERSION = 4;
/** Keep caps labels too; past this, delete one to add another. */
export const LABEL_LIMIT = 50;
export const LABEL_MAX_CHARS = 50;

type NoteRow = {
  id: string;
  type: NoteType;
  title: string;
  body: string;
  color: string;
  font_family: string;
  font_size: string;
  folder_id: string | null;
  pinned: number;
  archived: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type ReminderRow = {
  id: string;
  note_id: string;
  fire_at: number;
  timezone: string;
  local_time: string;
  repeat: Repeat;
  os_notification_id: string | null;
  status: Reminder['status'];
  created_at: number;
  updated_at: number;
};

type AttachmentRow = {
  id: string;
  note_id: string;
  kind: AttachmentKind;
  file_name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  sha256: string | null;
  position: number;
  created_at: number;
  updated_at: number;
  text: string | null;
};

type ItemRow = { id: string; note_id: string; text: string; checked: number; position: number; created_at: number; updated_at: number };
type FolderRow = { id: string; name: string; position: number; created_at: number; updated_at: number };
type LabelRow = { id: string; name: string; created_at: number; updated_at: number };
type NoteLabelRow = { note_id: string; label_id: string };

/** What a bulk change did, so the snackbar can say "archived and unpinned". */
export type BulkResult = { changed: number; unpinned: number; unarchived: number };

const asColor = (c: string): NoteColor => ((NOTE_COLORS as readonly string[]).includes(c) ? (c as NoteColor) : 'default');
const asFont = (f: string): NoteFont => ((NOTE_FONTS as readonly string[]).includes(f) ? (f as NoteFont) : 'default');
const asSize = (s: string): NoteSize => ((NOTE_SIZES as readonly string[]).includes(s) ? (s as NoteSize) : 'm');

const toReminder = (r: ReminderRow): Reminder => ({
  id: r.id,
  noteId: r.note_id,
  fireAt: r.fire_at,
  timezone: r.timezone,
  localTime: r.local_time,
  repeat: r.repeat,
  osNotificationId: r.os_notification_id,
  status: r.status,
});

const toAttachment = (r: AttachmentRow): Attachment => ({
  id: r.id,
  noteId: r.note_id,
  kind: r.kind,
  fileName: r.file_name,
  mime: r.mime,
  size: r.size,
  width: r.width,
  height: r.height,
  durationMs: r.duration_ms,
  sha256: r.sha256,
  position: r.position,
  createdAt: r.created_at,
  text: r.text ?? null,
});

/** Only plain file names are allowed in the store: no folders, no "..". */
export const isSafeFileName = (n: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(n) && !n.includes('..');

const toItem = (r: ItemRow): Item => ({ id: r.id, noteId: r.note_id, text: r.text, checked: !!r.checked, position: r.position });

/** Make user input safe for FTS5 MATCH: each word quoted, prefix-matched, operators dropped. */
export function ftsQuery(input: string): string | null {
  const words = input
    .normalize('NFKC')
    .split(/[\s"'()*:^+\-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !/^(AND|OR|NOT|NEAR)$/.test(w));
  if (words.length === 0) return null;
  return words.map((w) => `"${w.replace(/"/g, '')}"*`).join(' ');
}

/** Lower-case and strip accents, for the LIKE fallback ("Café" -> "cafe"). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export type Repo = ReturnType<typeof createRepo>;

export function createRepo(deps: RepoDeps) {
  const { db, fts, newId } = deps;
  const now = deps.now ?? (() => Date.now());
  const scheduler = deps.scheduler;

  // ------------------------------------------------------------ change events

  const listeners = new Set<() => void>();
  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };
  const emit = () => listeners.forEach((fn) => fn());

  // ------------------------------------------------------------ serial writes

  let queue: Promise<unknown> = Promise.resolve();
  function write<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run.then((v) => {
      emit();
      return v;
    });
  }

  const touch = (noteId: string, t = now()) => db.run('update notes set updated_at = ? where id = ?', [t, noteId]);

  // ------------------------------------------------------------ reads

  async function summaries(where: string, params: Param[], order: string): Promise<NoteSummary[]> {
    const rows = await db.all<
      NoteRow & { folder_name: string | null; r_fire_at: number | null; r_repeat: Repeat | null; r_status: Reminder['status'] | null }
    >(
      `select n.*, f.name as folder_name,
              r.fire_at as r_fire_at, r.repeat as r_repeat, r.status as r_status
         from notes n
         left join folders f on f.id = n.folder_id
         left join reminders r on r.note_id = n.id
        where ${where}
        order by ${order}`,
      params,
    );
    const listIds = rows.filter((r) => r.type === 'checklist').map((r) => r.id);
    const itemsByNote = new Map<string, ItemRow[]>();
    if (listIds.length) {
      const items = await db.all<ItemRow>(
        `select * from checklist_items where note_id in (${listIds.map(() => '?').join(',')})
          order by note_id, checked, position`,
        listIds,
      );
      for (const it of items) {
        const arr = itemsByNote.get(it.note_id) ?? [];
        arr.push(it);
        itemsByNote.set(it.note_id, arr);
      }
    }
    const media = new Map<string, { kind: Attachment['kind']; file_name: string }[]>();
    if (rows.length) {
      const atts = await db.all<{ note_id: string; kind: Attachment['kind']; file_name: string }>(
        `select note_id, kind, file_name from attachments where note_id in (${rows.map(() => '?').join(',')})
          order by note_id, position`,
        rows.map((r) => r.id),
      );
      for (const a of atts) {
        const arr = media.get(a.note_id) ?? [];
        arr.push(a);
        media.set(a.note_id, arr);
      }
    }
    const labelsByNote = await labelsFor(rows.map((r) => r.id));
    return rows.map((r) => {
      const items = itemsByNote.get(r.id) ?? [];
      const all = media.get(r.id) ?? [];
      const att = all.filter((a) => isVisual(a.kind));
      const nonEmpty = items.filter((i) => i.text.trim().length > 0);
      return {
        id: r.id,
        type: r.type,
        title: r.title,
        preview: r.type === 'text' ? r.body.slice(0, PREVIEW_CHARS) : '',
        color: asColor(r.color),
        font: asFont(r.font_family),
        pinned: !!r.pinned,
        folderId: r.folder_id,
        folderName: r.folder_name,
        archived: !!r.archived,
        labels: labelsByNote.get(r.id) ?? [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deletedAt: r.deleted_at,
        items: nonEmpty.slice(0, CARD_ITEMS).map((i) => ({ text: i.text, checked: !!i.checked })),
        itemCount: nonEmpty.length,
        doneCount: nonEmpty.filter((i) => i.checked).length,
        reminder:
          r.r_fire_at !== null && r.r_repeat && r.r_status
            ? { fireAt: r.r_fire_at, repeat: r.r_repeat, status: r.r_status }
            : null,
        cover: att[0] && isVisual(att[0].kind) ? { kind: att[0].kind, fileName: att[0].file_name } : null,
        attachmentCount: att.length,
        audioCount: all.length - att.length,
      };
    });
  }

  /** Labels of many notes at once, each list sorted by name. */
  async function labelsFor(noteIds: string[]): Promise<Map<string, LabelRef[]>> {
    const out = new Map<string, LabelRef[]>();
    if (!noteIds.length) return out;
    const rows = await db.all<{ note_id: string; id: string; name: string }>(
      `select nl.note_id, l.id, l.name from note_labels nl join labels l on l.id = nl.label_id
        where nl.note_id in (${noteIds.map(() => '?').join(',')})
        order by l.name collate nocase`,
      noteIds,
    );
    for (const r of rows) {
      const arr = out.get(r.note_id) ?? [];
      arr.push({ id: r.id, name: r.name });
      out.set(r.note_id, arr);
    }
    return out;
  }

  const ORDER: Record<Sort, string> = {
    updated: 'n.pinned desc, n.updated_at desc',
    created: 'n.pinned desc, n.created_at desc',
    title: "n.pinned desc, case when n.title = '' then 1 else 0 end, n.title collate nocase asc, n.updated_at desc",
  };

  /**
   * Home list. folderId undefined = all folders. Archived notes are left out
   * unless `archived` says otherwise ('any' = both).
   */
  function listNotes(opts: { folderId?: string; labelId?: string; archived?: boolean | 'any'; sort?: Sort } = {}) {
    const where = ['n.deleted_at is null'];
    const params: Param[] = [];
    const archived = opts.archived ?? false;
    if (archived !== 'any') where.push(archived ? 'n.archived = 1' : 'n.archived = 0');
    if (opts.folderId) {
      where.push('n.folder_id = ?');
      params.push(opts.folderId);
    }
    if (opts.labelId) {
      where.push('exists (select 1 from note_labels nl where nl.note_id = n.id and nl.label_id = ?)');
      params.push(opts.labelId);
    }
    return summaries(where.join(' and '), params, ORDER[opts.sort ?? 'updated']);
  }

  /**
   * One drawer entry's notes. Labels and folders show archived notes too
   * (the screen puts them under their own "Archive" heading), like Keep.
   */
  function listView(view: BrowseView, sort: Sort = 'updated'): Promise<NoteSummary[]> {
    switch (view.kind) {
      case 'notes':
        return listNotes({ sort });
      case 'archive':
        return listNotes({ archived: true, sort });
      case 'trash':
        return listTrash();
      case 'label':
        return listNotes({ labelId: view.id, archived: 'any', sort });
      case 'folder':
        return listNotes({ folderId: view.id, archived: 'any', sort });
      case 'reminders':
        return summaries(
          'n.deleted_at is null and r.id is not null',
          [],
          "case when r.status = 'scheduled' then 0 else 1 end, r.fire_at asc",
        );
    }
  }

  function listTrash() {
    return summaries('n.deleted_at is not null', [], 'n.deleted_at desc');
  }

  async function getNote(id: string): Promise<NoteFull | null> {
    const r = await db.first<NoteRow>('select * from notes where id = ?', [id]);
    if (!r) return null;
    const items = await db.all<ItemRow>('select * from checklist_items where note_id = ? order by position', [id]);
    const rem = await db.first<ReminderRow>('select * from reminders where note_id = ?', [id]);
    const atts = await db.all<AttachmentRow>('select * from attachments where note_id = ? order by position', [id]);
    const labels = (await labelsFor([id])).get(id) ?? [];
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      color: asColor(r.color),
      font: asFont(r.font_family),
      fontSize: asSize(r.font_size),
      pinned: !!r.pinned,
      archived: !!r.archived,
      folderId: r.folder_id,
      labels,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      items: items.map(toItem),
      reminder: rem ? toReminder(rem) : null,
      attachments: atts.map(toAttachment),
    };
  }

  // ------------------------------------------------------------ notes

  /** A new note; made while a label is open, it starts with that label (as in Keep). */
  function createNote(opts: { type: NoteType; folderId?: string | null; color?: NoteColor; labelId?: string | null }): Promise<string> {
    return write(async () => {
      const id = newId();
      const t = now();
      await db.run(
        'insert into notes (id, type, color, folder_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?)',
        [id, opts.type, opts.color ?? 'default', opts.folderId ?? null, t, t],
      );
      if (opts.labelId) await db.run('insert or ignore into note_labels (note_id, label_id) values (?, ?)', [id, opts.labelId]);
      return id;
    });
  }

  const PATCH_COLUMNS: Record<keyof NotePatch, string> = {
    title: 'title',
    body: 'body',
    color: 'color',
    font: 'font_family',
    fontSize: 'font_size',
    folderId: 'folder_id',
    pinned: 'pinned',
    archived: 'archived',
  };

  /**
   * Keep's pin/archive rules: archiving a note unpins it, pinning an archived
   * note brings it back from the archive. Neither counts as an edit.
   */
  function withArchiveRules(patch: NotePatch): NotePatch {
    const p = { ...patch };
    if (p.archived === true && p.pinned === undefined) p.pinned = false;
    if (p.pinned === true && p.archived === undefined) p.archived = false;
    return p;
  }

  async function applyPatch(id: string, patch: NotePatch) {
    const sets: string[] = [];
    const params: Param[] = [];
    for (const [k, v] of Object.entries(patch) as [keyof NotePatch, unknown][]) {
      if (v === undefined) continue;
      sets.push(`${PATCH_COLUMNS[k]} = ?`);
      params.push(typeof v === 'boolean' ? (v ? 1 : 0) : (v as Param));
    }
    if (!sets.length) return;
    // Pinning and archiving do not count as edits, so they do not reorder by "last edited".
    const isEdit = Object.keys(patch).some((k) => k !== 'pinned' && k !== 'archived');
    if (isEdit) {
      sets.push('updated_at = ?');
      params.push(now());
    }
    await db.run(`update notes set ${sets.join(', ')} where id = ?`, [...params, id]);
    if ('title' in patch || 'body' in patch) await refreshNotificationText(id);
  }

  function updateNote(id: string, patch: NotePatch): Promise<void> {
    return write(() => applyPatch(id, withArchiveRules(patch)));
  }

  /** The same change on several notes (multi-select). Says how many were unpinned or unarchived on the way. */
  function updateNotes(ids: string[], patch: NotePatch): Promise<BulkResult> {
    return write(async () => {
      const p = withArchiveRules(patch);
      const result: BulkResult = { changed: 0, unpinned: 0, unarchived: 0 };
      await db.transaction(async () => {
        for (const id of ids) {
          const before = await db.first<{ pinned: number; archived: number }>('select pinned, archived from notes where id = ?', [id]);
          if (!before) continue;
          await applyPatch(id, p);
          result.changed++;
          if (before.pinned && p.pinned === false && patch.pinned === undefined) result.unpinned++;
          if (before.archived && p.archived === false && patch.archived === undefined) result.unarchived++;
        }
      });
      return result;
    });
  }

  /** A brand-new note left empty is deleted rather than saved. */
  function discardIfEmpty(id: string): Promise<boolean> {
    return write(async () => {
      const n = await db.first<{ title: string; body: string }>('select title, body from notes where id = ?', [id]);
      if (!n) return false;
      const filled = await db.first<{ c: number }>(
        "select count(*) as c from checklist_items where note_id = ? and trim(text) <> ''",
        [id],
      );
      const media = await db.first<{ c: number }>('select count(*) as c from attachments where note_id = ?', [id]);
      const empty = !n.title.trim() && !n.body.trim() && (filled?.c ?? 0) === 0 && (media?.c ?? 0) === 0;
      if (!empty) return false;
      await cancelOs(id);
      await db.run('delete from notes where id = ?', [id]);
      return true;
    });
  }

  function trashNote(id: string): Promise<void> {
    return trashNotes([id]).then(() => undefined);
  }

  function trashNotes(ids: string[]): Promise<BulkResult> {
    return write(async () => {
      const result: BulkResult = { changed: 0, unpinned: 0, unarchived: 0 };
      for (const id of ids) {
        const n = await db.first<{ pinned: number }>('select pinned from notes where id = ? and deleted_at is null', [id]);
        if (!n) continue;
        await cancelOs(id);
        // A note in the trash is not pinned; restored, it comes back unpinned (Keep does the same).
        await db.run('update notes set deleted_at = ?, pinned = 0 where id = ?', [now(), id]);
        result.changed++;
        if (n.pinned) result.unpinned++;
      }
      return result;
    });
  }

  function restoreNotes(ids: string[]): Promise<void> {
    return write(async () => {
      for (const id of ids) {
        await db.run('update notes set deleted_at = null where id = ?', [id]);
        await scheduleFor(id);
      }
    });
  }

  function deleteNotesForever(ids: string[]): Promise<void> {
    return write(async () => {
      for (const id of ids) {
        await cancelOs(id);
        await db.run('delete from notes where id = ?', [id]);
      }
    });
  }

  function restoreNote(id: string): Promise<void> {
    return write(async () => {
      await db.run('update notes set deleted_at = null where id = ?', [id]);
      await scheduleFor(id);
    });
  }

  function deleteForever(id: string): Promise<void> {
    return write(async () => {
      await cancelOs(id);
      await db.run('delete from notes where id = ?', [id]);
    });
  }

  function emptyTrash(): Promise<number> {
    return write(async () => {
      const ids = await db.all<{ id: string }>('select id from notes where deleted_at is not null');
      for (const { id } of ids) await cancelOs(id);
      const r = await db.run('delete from notes where deleted_at is not null');
      return r.changes;
    });
  }

  /** Hard-delete what has sat in the trash longer than TRASH_DAYS. */
  function purgeTrash(): Promise<number> {
    return write(async () => {
      const cutoff = now() - TRASH_DAYS * 86_400_000;
      const r = await db.run('delete from notes where deleted_at is not null and deleted_at < ?', [cutoff]);
      return r.changes;
    });
  }

  function duplicateNote(id: string): Promise<string | null> {
    return write(async () => {
      const src = await db.first<NoteRow>('select * from notes where id = ?', [id]);
      if (!src) return null;
      const copyId = newId();
      const t = now();
      await db.transaction(async () => {
        await db.run(
          `insert into notes (id, type, title, body, color, font_family, font_size, folder_id, pinned, archived, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [copyId, src.type, src.title, src.body, src.color, src.font_family, src.font_size, src.folder_id, src.archived, t, t],
        );
        await db.run('insert into note_labels (note_id, label_id) select ?, label_id from note_labels where note_id = ?', [copyId, id]);
        const items = await db.all<ItemRow>('select * from checklist_items where note_id = ? order by position', [id]);
        for (const it of items) {
          await db.run(
            'insert into checklist_items (id, note_id, text, checked, position, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
            [newId(), copyId, it.text, it.checked, it.position, t, t],
          );
        }
        // The copy points at the same files; a file is removed only when no note uses it.
        const atts = await db.all<AttachmentRow>('select * from attachments where note_id = ? order by position', [id]);
        for (const a of atts) {
          await db.run(
            `insert into attachments (id, note_id, kind, file_name, mime, size, width, height, duration_ms, sha256, position, created_at, updated_at, text)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId(), copyId, a.kind, a.file_name, a.mime, a.size, a.width, a.height, a.duration_ms, a.sha256, a.position, t, t, a.text],
          );
        }
      });
      return copyId;
    });
  }

  // ------------------------------------------------------------ checklist items

  function addItem(noteId: string, opts: { text?: string; after?: string } = {}): Promise<Item> {
    return write(async () => {
      const t = now();
      const id = newId();
      let position: number;
      if (opts.after) {
        const ref = await db.first<{ position: number }>('select position from checklist_items where id = ?', [opts.after]);
        position = (ref?.position ?? -1) + 1;
        await db.run('update checklist_items set position = position + 1 where note_id = ? and position >= ?', [noteId, position]);
      } else {
        const max = await db.first<{ p: number | null }>('select max(position) as p from checklist_items where note_id = ?', [noteId]);
        position = (max?.p ?? -1) + 1;
      }
      await db.run(
        'insert into checklist_items (id, note_id, text, checked, position, created_at, updated_at) values (?, ?, ?, 0, ?, ?, ?)',
        [id, noteId, opts.text ?? '', position, t, t],
      );
      await touch(noteId, t);
      return { id, noteId, text: opts.text ?? '', checked: false, position };
    });
  }

  function updateItem(id: string, text: string): Promise<void> {
    return write(async () => {
      const t = now();
      const it = await db.first<{ note_id: string }>('select note_id from checklist_items where id = ?', [id]);
      if (!it) return;
      await db.run('update checklist_items set text = ?, updated_at = ? where id = ?', [text, t, id]);
      await touch(it.note_id, t);
    });
  }

  function toggleItem(id: string): Promise<void> {
    return write(async () => {
      const t = now();
      const it = await db.first<{ note_id: string }>('select note_id from checklist_items where id = ?', [id]);
      if (!it) return;
      await db.run('update checklist_items set checked = 1 - checked, updated_at = ? where id = ?', [t, id]);
      await touch(it.note_id, t);
    });
  }

  function removeItem(id: string): Promise<void> {
    return write(async () => {
      const it = await db.first<{ note_id: string }>('select note_id from checklist_items where id = ?', [id]);
      if (!it) return;
      await db.run('delete from checklist_items where id = ?', [id]);
      await touch(it.note_id);
    });
  }

  function reorderItems(noteId: string, ids: string[]): Promise<void> {
    return write(async () => {
      await db.transaction(async () => {
        for (let i = 0; i < ids.length; i++) {
          await db.run('update checklist_items set position = ? where id = ? and note_id = ?', [i, ids[i], noteId]);
        }
        await touch(noteId);
      });
    });
  }

  /** Tick or untick every item at once. */
  function setAllItems(noteId: string, checked: boolean): Promise<void> {
    return write(async () => {
      await db.run('update checklist_items set checked = ?, updated_at = ? where note_id = ?', [checked ? 1 : 0, now(), noteId]);
      await touch(noteId);
    });
  }

  /** Turn a text note into a checklist (one item per line) or back. */
  function convertNote(id: string, to: NoteType): Promise<void> {
    return write(async () => {
      const n = await db.first<NoteRow>('select * from notes where id = ?', [id]);
      if (!n || n.type === to) return;
      const t = now();
      await db.transaction(async () => {
        if (to === 'checklist') {
          const lines = n.body.split('\n').map((l) => l.replace(/^\s*([-*•]|\[[ xX]?\])\s*/, '').trimEnd()).filter((l) => l.trim());
          for (let i = 0; i < lines.length; i++) {
            await db.run(
              'insert into checklist_items (id, note_id, text, checked, position, created_at, updated_at) values (?, ?, ?, 0, ?, ?, ?)',
              [newId(), id, lines[i], i, t, t],
            );
          }
          await db.run("update notes set type = 'checklist', body = '', updated_at = ? where id = ?", [t, id]);
        } else {
          const items = await db.all<ItemRow>('select * from checklist_items where note_id = ? order by position', [id]);
          const body = items.map((i) => i.text).join('\n');
          await db.run('delete from checklist_items where note_id = ?', [id]);
          await db.run("update notes set type = 'text', body = ?, updated_at = ? where id = ?", [body, t, id]);
        }
      });
    });
  }

  // ------------------------------------------------------------ attachments

  /** Add photos or videos (already copied into the store) to the end of a note. */
  function addAttachments(noteId: string, list: NewAttachment[]): Promise<Attachment[]> {
    return write(async () => {
      const t = now();
      const max = await db.first<{ p: number | null }>('select max(position) as p from attachments where note_id = ?', [noteId]);
      let position = (max?.p ?? -1) + 1;
      const ids: string[] = [];
      await db.transaction(async () => {
        for (const a of list) {
          if (!isSafeFileName(a.fileName)) throw new Error('bad file name');
          const id = a.id ?? newId();
          await db.run(
            `insert into attachments (id, note_id, kind, file_name, mime, size, width, height, duration_ms, sha256, position, created_at, updated_at, text)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, noteId, a.kind, a.fileName, a.mime, a.size, a.width ?? null, a.height ?? null, a.durationMs ?? null, a.sha256 ?? null, position++, t, t, a.text ?? null],
          );
          ids.push(id);
        }
        await touch(noteId, t);
      });
      const rows = await db.all<AttachmentRow>(
        `select * from attachments where id in (${ids.map(() => '?').join(',') || "''"}) order by position`,
        ids,
      );
      return rows.map(toAttachment);
    });
  }

  function removeAttachment(id: string): Promise<void> {
    return write(async () => {
      const a = await db.first<{ note_id: string }>('select note_id from attachments where id = ?', [id]);
      if (!a) return;
      await db.run('delete from attachments where id = ?', [id]);
      await touch(a.note_id);
    });
  }

  async function getAttachment(id: string): Promise<Attachment | null> {
    const r = await db.first<AttachmentRow>('select * from attachments where id = ?', [id]);
    return r ? toAttachment(r) : null;
  }

  /** Photos whose text has not been read yet (newest first), for the on-device reader. */
  async function unreadPhotos(limit = 20): Promise<Attachment[]> {
    const rows = await db.all<AttachmentRow>(
      "select * from attachments where kind = 'image' and text is null order by created_at desc limit ?",
      [limit],
    );
    return rows.map(toAttachment);
  }

  /**
   * Store what was read in a photo ('' = nothing). Not an edit: the note's
   * "edited" time stays. Every attachment row using the same file gets it
   * (a copied note shares its files).
   */
  function setPhotoText(fileName: string, text: string): Promise<void> {
    return write(async () => {
      await db.run("update attachments set text = ? where file_name = ? and kind = 'image'", [text.slice(0, 20_000), fileName]);
    });
  }

  /** Every attachment, in any note (trash included): what a backup must carry. */
  async function listAllAttachments(): Promise<Attachment[]> {
    return (await db.all<AttachmentRow>('select * from attachments order by note_id, position')).map(toAttachment);
  }

  /** File names still used by some note. Anything else in the store can go. */
  async function usedFileNames(): Promise<Set<string>> {
    return new Set((await db.all<{ file_name: string }>('select distinct file_name from attachments')).map((r) => r.file_name));
  }

  /** Remember a file's hash once it has been computed (the same file in two notes shares it). */
  function setFileHash(fileName: string, sha256: string): Promise<void> {
    return write(async () => {
      await db.run('update attachments set sha256 = ? where file_name = ?', [sha256, fileName]);
    });
  }

  // ------------------------------------------------------------ telegram bookkeeping

  async function getTelegramFile(sha256: string): Promise<{ size: number; parts: TelegramPart[] } | null> {
    const r = await db.first<{ size: number; parts: string }>('select size, parts from telegram_files where sha256 = ?', [sha256]);
    if (!r) return null;
    try {
      return { size: r.size, parts: JSON.parse(r.parts) as TelegramPart[] };
    } catch {
      return null;
    }
  }

  function saveTelegramFile(sha256: string, size: number, parts: TelegramPart[]): Promise<void> {
    return write(async () => {
      await db.run(
        `insert into telegram_files (sha256, size, parts, uploaded_at) values (?, ?, ?, ?)
         on conflict (sha256) do update set size = excluded.size, parts = excluded.parts, uploaded_at = excluded.uploaded_at`,
        [sha256, size, JSON.stringify(parts), now()],
      );
    });
  }

  /** A different chat or bot: files sent to the old one cannot be reused. */
  function forgetTelegramFiles(): Promise<void> {
    return write(async () => {
      await db.run('delete from telegram_files');
      await db.run("delete from settings where key = 'last_telegram_at'");
    });
  }

  // ------------------------------------------------------------ folders

  async function listFolders(): Promise<Folder[]> {
    const rows = await db.all<FolderRow & { count: number }>(
      `select f.*, (select count(*) from notes n where n.folder_id = f.id and n.deleted_at is null) as count
         from folders f order by f.position, f.name collate nocase`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, position: r.position, count: r.count }));
  }

  const isUniqueError = (e: unknown) => /UNIQUE|constraint/i.test(String((e as Error)?.message ?? e));

  /** Checked before writing: SQLite builds word the UNIQUE error differently (web says only "Error finalizing statement"). */
  async function assertFreeName(name: string, exceptId?: string) {
    const clash = await db.first<{ id: string }>('select id from folders where name = ? collate nocase', [name]);
    if (clash && clash.id !== exceptId) throw new DuplicateFolderError();
  }

  function createFolder(name: string): Promise<Folder> {
    return write(async () => {
      const clean = name.trim().slice(0, 60);
      if (!clean) throw new Error('empty folder name');
      await assertFreeName(clean);
      const t = now();
      const id = newId();
      const max = await db.first<{ p: number | null }>('select max(position) as p from folders');
      const position = (max?.p ?? -1) + 1;
      try {
        await db.run('insert into folders (id, name, position, created_at, updated_at) values (?, ?, ?, ?, ?)', [id, clean, position, t, t]);
      } catch (e) {
        if (isUniqueError(e)) throw new DuplicateFolderError();
        throw e;
      }
      return { id, name: clean, position, count: 0 };
    });
  }

  function renameFolder(id: string, name: string): Promise<void> {
    return write(async () => {
      const clean = name.trim().slice(0, 60);
      if (!clean) throw new Error('empty folder name');
      await assertFreeName(clean, id);
      try {
        await db.run('update folders set name = ?, updated_at = ? where id = ?', [clean, now(), id]);
      } catch (e) {
        if (isUniqueError(e)) throw new DuplicateFolderError();
        throw e;
      }
    });
  }

  /** Deleting a folder keeps its notes: they move back to "All". */
  function deleteFolder(id: string): Promise<void> {
    return write(async () => {
      await db.run('delete from folders where id = ?', [id]);
    });
  }

  // ------------------------------------------------------------ labels

  async function listLabels(): Promise<Label[]> {
    const rows = await db.all<LabelRow & { count: number }>(
      `select l.*, (select count(*) from note_labels nl join notes n on n.id = nl.note_id
                      where nl.label_id = l.id and n.deleted_at is null) as count
         from labels l order by l.name collate nocase`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, count: r.count }));
  }

  const cleanLabel = (name: string) => name.replace(/\s+/g, ' ').trim();

  /** Checked before writing, like folders: the web SQLite words UNIQUE errors differently. */
  async function assertFreeLabel(name: string, exceptId?: string) {
    const clash = await db.first<{ id: string }>('select id from labels where name = ? collate nocase', [name]);
    if (clash && clash.id !== exceptId) throw new DuplicateLabelError();
  }

  function createLabel(name: string): Promise<LabelRef> {
    return write(async () => {
      const clean = cleanLabel(name);
      if (!clean) throw new Error('empty label name');
      if (clean.length > LABEL_MAX_CHARS) throw new Error('label name too long');
      await assertFreeLabel(clean);
      const n = await db.first<{ c: number }>('select count(*) as c from labels');
      if ((n?.c ?? 0) >= LABEL_LIMIT) throw new LabelLimitError();
      const id = newId();
      const t = now();
      try {
        await db.run('insert into labels (id, name, created_at, updated_at) values (?, ?, ?, ?)', [id, clean, t, t]);
      } catch (e) {
        if (isUniqueError(e)) throw new DuplicateLabelError();
        throw e;
      }
      return { id, name: clean };
    });
  }

  function renameLabel(id: string, name: string): Promise<void> {
    return write(async () => {
      const clean = cleanLabel(name);
      if (!clean) throw new Error('empty label name');
      if (clean.length > LABEL_MAX_CHARS) throw new Error('label name too long');
      await assertFreeLabel(clean, id);
      try {
        await db.run('update labels set name = ?, updated_at = ? where id = ?', [clean, now(), id]);
      } catch (e) {
        if (isUniqueError(e)) throw new DuplicateLabelError();
        throw e;
      }
    });
  }

  /** The label goes from every note; the notes stay. */
  function deleteLabel(id: string): Promise<void> {
    return write(async () => {
      await db.run('delete from note_labels where label_id = ?', [id]);
      await db.run('delete from labels where id = ?', [id]);
    });
  }

  /** Put a label on (or take it off) one or more notes. Labelling is not an edit. */
  function setLabel(noteIds: string[], labelId: string, on: boolean): Promise<void> {
    return write(async () => {
      await db.transaction(async () => {
        for (const id of noteIds) {
          if (on) await db.run('insert or ignore into note_labels (note_id, label_id) values (?, ?)', [id, labelId]);
          else await db.run('delete from note_labels where note_id = ? and label_id = ?', [id, labelId]);
        }
      });
    });
  }

  // ------------------------------------------------------------ search

  function filterClause(f: SearchFilter | null | undefined): { where: string; params: Param[] } {
    if (!f) return { where: '', params: [] };
    switch (f.kind) {
      case 'type':
        if (f.value === 'checklist') return { where: " and n.type = 'checklist'", params: [] };
        if (f.value === 'media') return { where: " and exists (select 1 from attachments a where a.note_id = n.id and a.kind <> 'audio')", params: [] };
        if (f.value === 'audio') return { where: " and exists (select 1 from attachments a where a.note_id = n.id and a.kind = 'audio')", params: [] };
        return { where: ' and r.id is not null', params: [] };
      case 'label':
        return { where: ' and exists (select 1 from note_labels nl where nl.note_id = n.id and nl.label_id = ?)', params: [f.id] };
      case 'color':
        return { where: ' and n.color = ?', params: [f.value] };
    }
  }

  /**
   * Notes matching the words, a filter, or both. Archived notes are found too;
   * they come after the others (the screen gives them an "Archive" heading).
   */
  async function searchNotes(query: string, filter?: SearchFilter | null): Promise<NoteSummary[]> {
    const q = query.trim();
    if (!q && !filter) return [];
    const fc = filterClause(filter);
    const order = 'n.archived, n.pinned desc, n.updated_at desc';
    if (!q) return summaries(`n.deleted_at is null${fc.where}`, fc.params, order);
    if (fts) {
      const m = ftsQuery(q);
      if (!m) return [];
      return summaries(
        `n.deleted_at is null and n.id in (select note_id from notes_fts where notes_fts match ?)${fc.where}`,
        [m, ...fc.params],
        order,
      );
    }
    // LIKE fallback (web preview): every word must appear in title, body or an item.
    const words = fold(q).split(/\s+/).filter(Boolean);
    const all = await summaries(`n.deleted_at is null${fc.where}`, fc.params, order);
    const items = await db.all<{ note_id: string; text: string }>('select note_id, text from checklist_items');
    const bodies = await db.all<{ id: string; body: string }>('select id, body from notes where deleted_at is null');
    const hay = new Map<string, string>();
    for (const n of all) hay.set(n.id, fold(n.title));
    for (const b of bodies) hay.set(b.id, `${hay.get(b.id) ?? ''} ${fold(b.body)}`);
    for (const it of items) if (hay.has(it.note_id)) hay.set(it.note_id, `${hay.get(it.note_id)} ${fold(it.text)}`);
    const photoText = await db.all<{ note_id: string; text: string }>('select note_id, text from attachments where text is not null');
    for (const a of photoText) if (hay.has(a.note_id)) hay.set(a.note_id, `${hay.get(a.note_id)} ${fold(a.text)}`);
    return all.filter((n) => words.every((w) => (hay.get(n.id) ?? '').includes(w)));
  }

  // ------------------------------------------------------------ reminders

  async function reminderRow(noteId: string) {
    return db.first<ReminderRow>('select * from reminders where note_id = ?', [noteId]);
  }

  async function cancelOs(noteId: string) {
    const r = await reminderRow(noteId);
    if (r?.os_notification_id && scheduler) {
      await scheduler.cancel(r.os_notification_id).catch(() => undefined);
      await db.run('update reminders set os_notification_id = null where id = ?', [r.id]);
    }
  }

  function notificationText(n: { title: string; body: string; type: NoteType }, items: string[]) {
    const title = n.title.trim() || (n.type === 'checklist' ? items[0] : n.body.split('\n')[0])?.trim() || 'Reminder';
    const body = n.type === 'checklist' ? items.slice(0, 3).join(' · ') : n.body.trim().slice(0, 120);
    return { title, body: n.title.trim() ? body : '' };
  }

  /** Cancel and (re)schedule the OS notification for a note's reminder. */
  async function scheduleFor(noteId: string) {
    await cancelOs(noteId);
    const r = await reminderRow(noteId);
    if (!r || r.status !== 'scheduled' || !scheduler) return;
    const n = await db.first<NoteRow>('select * from notes where id = ?', [noteId]);
    if (!n || n.deleted_at !== null) return;
    if (r.fire_at <= now()) return;
    const items = (await db.all<{ text: string }>(
      "select text from checklist_items where note_id = ? and checked = 0 and trim(text) <> '' order by position",
      [noteId],
    )).map((i) => i.text);
    const text = notificationText(n, items);
    const osId = await scheduler.schedule({ noteId, ...text, fireAt: r.fire_at }).catch(() => null);
    await db.run('update reminders set os_notification_id = ? where id = ?', [osId, r.id]);
  }

  async function refreshNotificationText(noteId: string) {
    const r = await reminderRow(noteId);
    if (r && r.status === 'scheduled') await scheduleFor(noteId);
  }

  function setReminder(
    noteId: string,
    r: { fireAt: number; timezone: string; localTime: string; repeat: Repeat },
  ): Promise<Reminder> {
    return write(async () => {
      const t = now();
      const existing = await reminderRow(noteId);
      const id = existing?.id ?? newId();
      await cancelOs(noteId);
      await db.run(
        `insert into reminders (id, note_id, fire_at, timezone, local_time, repeat, os_notification_id, status, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, null, 'scheduled', ?, ?)
         on conflict (note_id) do update set fire_at = excluded.fire_at, timezone = excluded.timezone,
           local_time = excluded.local_time, repeat = excluded.repeat, os_notification_id = null,
           status = 'scheduled', updated_at = excluded.updated_at`,
        [id, noteId, r.fireAt, r.timezone, r.localTime, r.repeat, t, t],
      );
      await scheduleFor(noteId);
      return toReminder((await reminderRow(noteId))!);
    });
  }

  function clearReminder(noteId: string): Promise<void> {
    return write(async () => {
      await cancelOs(noteId);
      await db.run('delete from reminders where note_id = ?', [noteId]);
    });
  }

  /**
   * The safety net, run on every launch and return to the foreground.
   * The database is the truth; the OS schedule is a copy of it.
   */
  function reconcileReminders(): Promise<{ scheduled: number; cancelled: number; rolled: number }> {
    return write(async () => {
      const t = now();
      let rolled = 0;
      const rows = await db.all<ReminderRow & { deleted_at: number | null }>(
        `select r.*, n.deleted_at from reminders r join notes n on n.id = r.note_id where r.status = 'scheduled'`,
      );
      for (const r of rows) {
        if (r.fire_at > t) continue;
        if (r.repeat === 'none') {
          await db.run("update reminders set status = 'fired', os_notification_id = null where id = ?", [r.id]);
        } else {
          const next = nextOccurrence(
            { fireAt: r.fire_at, timezone: r.timezone, localTime: r.local_time, repeat: r.repeat },
            t,
          );
          await db.run('update reminders set fire_at = ?, os_notification_id = null, updated_at = ? where id = ?', [next, t, r.id]);
          rolled++;
        }
      }
      if (!scheduler) return { scheduled: 0, cancelled: 0, rolled };

      // What should be scheduled: the soonest `maxPending`, notes not in the trash.
      const want = await db.all<ReminderRow>(
        `select r.* from reminders r join notes n on n.id = r.note_id
          where r.status = 'scheduled' and n.deleted_at is null and r.fire_at > ?
          order by r.fire_at limit ?`,
        [t, scheduler.maxPending],
      );
      const wantIds = new Set(want.map((r) => r.note_id));
      const onOs = await scheduler.listScheduled();
      let cancelled = 0;
      const live = new Set<string>();
      for (const s of onOs) {
        const row = want.find((r) => r.note_id === s.noteId);
        if (!s.noteId || !wantIds.has(s.noteId) || row?.os_notification_id !== s.osId) {
          await scheduler.cancel(s.osId).catch(() => undefined);
          cancelled++;
        } else {
          live.add(s.noteId);
        }
      }
      // Anything not wanted (beyond the limit, trashed) loses its stale OS id.
      await db.run(
        `update reminders set os_notification_id = null
          where note_id not in (${want.map(() => '?').join(',') || "''"})`,
        want.map((r) => r.note_id),
      );
      let scheduled = 0;
      for (const r of want) {
        if (live.has(r.note_id)) continue;
        await db.run('update reminders set os_notification_id = null where id = ?', [r.id]);
        await scheduleFor(r.note_id);
        scheduled++;
      }
      return { scheduled, cancelled, rolled };
    });
  }

  /** Called when a reminder's notification is delivered or tapped. */
  function reminderFired(noteId: string): Promise<void> {
    return write(async () => {
      const r = await reminderRow(noteId);
      if (!r) return;
      if (r.repeat === 'none') {
        await db.run("update reminders set status = 'fired', os_notification_id = null where id = ?", [r.id]);
        return;
      }
      await cancelOs(noteId);
      const next = nextOccurrence({ fireAt: r.fire_at, timezone: r.timezone, localTime: r.local_time, repeat: r.repeat }, Math.max(now(), r.fire_at));
      await db.run('update reminders set fire_at = ?, os_notification_id = null, updated_at = ? where id = ?', [next, now(), r.id]);
      await scheduleFor(noteId);
    });
  }

  // ------------------------------------------------------------ sharing

  async function noteAsText(id: string): Promise<string> {
    const n = await getNote(id);
    if (!n) return '';
    const parts: string[] = [];
    if (n.title.trim()) parts.push(n.title.trim());
    if (n.type === 'text') {
      if (n.body.trim()) parts.push(n.body.trimEnd());
    } else {
      const lines = n.items.filter((i) => i.text.trim()).map((i) => `${i.checked ? '☑' : '☐'} ${i.text}`);
      if (lines.length) parts.push(lines.join('\n'));
    }
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------ settings

  const DEFAULTS: Settings = {
    viewMode: 'grid',
    sort: 'updated',
    theme: 'system',
    lastBackupAt: null,
    lastSnapshotAt: null,
    lastTelegramAt: null,
    telegramAuto: true,
    voiceOnline: false,
  };
  const KEY: Record<keyof Settings, string> = {
    viewMode: 'view_mode',
    sort: 'sort',
    theme: 'theme',
    lastBackupAt: 'last_backup_at',
    lastSnapshotAt: 'last_snapshot_at',
    lastTelegramAt: 'last_telegram_at',
    telegramAuto: 'telegram_auto',
    voiceOnline: 'voice_online',
  };

  async function getSettings(): Promise<Settings> {
    const rows = await db.all<{ key: string; value: string }>('select key, value from settings');
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string) => (map.has(k) ? Number(map.get(k)) : null);
    const pick = <T extends string>(k: string, allowed: readonly T[], d: T): T =>
      allowed.includes(map.get(k) as T) ? (map.get(k) as T) : d;
    return {
      viewMode: pick('view_mode', ['grid', 'list'], DEFAULTS.viewMode),
      sort: pick('sort', ['updated', 'created', 'title'], DEFAULTS.sort),
      theme: pick('theme', ['system', 'light', 'dark'], DEFAULTS.theme),
      lastBackupAt: num('last_backup_at'),
      lastSnapshotAt: num('last_snapshot_at'),
      lastTelegramAt: num('last_telegram_at'),
      telegramAuto: map.has('telegram_auto') ? map.get('telegram_auto') === '1' : DEFAULTS.telegramAuto,
      voiceOnline: map.get('voice_online') === '1',
    };
  }

  function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    return write(async () => {
      if (value === null) {
        await db.run('delete from settings where key = ?', [KEY[key]]);
        return;
      }
      await db.run(
        'insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
        [KEY[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value)],
      );
    });
  }

  // ------------------------------------------------------------ backup

  async function exportBackup() {
    const [folders, notes, items, reminders, attachments, settings, labels, noteLabels] = await Promise.all([
      db.all<FolderRow>('select * from folders order by position'),
      db.all<NoteRow>('select * from notes order by created_at'),
      db.all<ItemRow>('select * from checklist_items order by note_id, position'),
      db.all<ReminderRow>('select * from reminders'),
      db.all<AttachmentRow>('select * from attachments order by note_id, position'),
      db.all<{ key: string; value: string }>("select key, value from settings where key in ('view_mode', 'sort', 'theme')"),
      db.all<LabelRow>('select * from labels order by name collate nocase'),
      db.all<NoteLabelRow>('select note_id, label_id from note_labels order by note_id'),
    ]);
    return {
      format: BACKUP_FORMAT,
      schema_version: BACKUP_VERSION,
      exported_at: new Date(now()).toISOString(),
      folders,
      notes,
      checklist_items: items.map((i) => ({ ...i })),
      // OS notification ids mean nothing on another phone.
      reminders: reminders.map((r) => ({ ...r, os_notification_id: null })),
      // The photos and videos themselves travel separately (Telegram backup); this lists them.
      attachments,
      labels,
      note_labels: noteLabels,
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    };
  }

  /**
   * Merge a backup into this phone. Rows match by id; a row only in the backup
   * is added; when both have it, the newer updated_at wins. Nothing is deleted.
   * Running the same import twice changes nothing the second time.
   */
  function importBackup(data: unknown): Promise<{ added: number; updated: number; skipped: number }> {
    return write(async () => {
      const b = validateBackup(data);
      let added = 0;
      let updated = 0;
      let skipped = 0;
      await db.transaction(async () => {
        for (const f of b.folders) {
          const cur = await db.first<FolderRow>('select * from folders where id = ?', [f.id]);
          if (!cur) {
            const clash = await db.first<{ id: string }>('select id from folders where name = ? collate nocase', [f.name]);
            if (clash) {
              // Same name, different id: point the backup's notes at the existing folder.
              await db.run('update notes set folder_id = ? where folder_id = ?', [clash.id, f.id]);
              b.notes.forEach((n) => {
                if (n.folder_id === f.id) n.folder_id = clash.id;
              });
              skipped++;
              continue;
            }
            await db.run('insert into folders (id, name, position, created_at, updated_at) values (?, ?, ?, ?, ?)', [
              f.id, f.name, f.position, f.created_at, f.updated_at,
            ]);
            added++;
          } else if (f.updated_at > cur.updated_at) {
            await db.run('update folders set name = ?, position = ?, updated_at = ? where id = ?', [f.name, f.position, f.updated_at, f.id]);
            updated++;
          } else skipped++;
        }
        // Labels: same rules as folders. A name already here under another id is reused.
        const labelMap = new Map<string, string>();
        for (const l of b.labels) {
          const cur = await db.first<LabelRow>('select * from labels where id = ?', [l.id]);
          if (!cur) {
            const clash = await db.first<{ id: string }>('select id from labels where name = ? collate nocase', [l.name]);
            if (clash) {
              labelMap.set(l.id, clash.id);
              skipped++;
              continue;
            }
            await db.run('insert into labels (id, name, created_at, updated_at) values (?, ?, ?, ?)', [l.id, l.name, l.created_at, l.updated_at]);
            labelMap.set(l.id, l.id);
            added++;
          } else {
            labelMap.set(l.id, l.id);
            if (l.updated_at > cur.updated_at) {
              const clash = await db.first<{ id: string }>('select id from labels where name = ? collate nocase and id <> ?', [l.name, l.id]);
              if (!clash) {
                await db.run('update labels set name = ?, updated_at = ? where id = ?', [l.name, l.updated_at, l.id]);
                updated++;
              } else skipped++;
            } else skipped++;
          }
        }
        const knownFolders = new Set((await db.all<{ id: string }>('select id from folders')).map((r) => r.id));
        const replacedNotes = new Set<string>();
        for (const n of b.notes) {
          const folderId = n.folder_id && knownFolders.has(n.folder_id) ? n.folder_id : null;
          const cur = await db.first<NoteRow>('select * from notes where id = ?', [n.id]);
          const vals: Param[] = [
            n.type, n.title, n.body, asColor(n.color), asFont(n.font_family), asSize(n.font_size), folderId,
            n.pinned ? 1 : 0, n.archived ? 1 : 0, n.created_at, n.updated_at, n.deleted_at,
          ];
          if (!cur) {
            await db.run(
              `insert into notes (type, title, body, color, font_family, font_size, folder_id, pinned, archived, created_at, updated_at, deleted_at, id)
               values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [...vals, n.id],
            );
            replacedNotes.add(n.id);
            added++;
          } else if (n.updated_at > cur.updated_at) {
            await db.run(
              `update notes set type = ?, title = ?, body = ?, color = ?, font_family = ?, font_size = ?, folder_id = ?,
                 pinned = ?, archived = ?, created_at = ?, updated_at = ?, deleted_at = ? where id = ?`,
              [...vals, n.id],
            );
            await db.run('delete from checklist_items where note_id = ?', [n.id]);
            replacedNotes.add(n.id);
            updated++;
          } else skipped++;
        }
        // Items and reminders follow their note: only notes taken from the backup get them.
        for (const it of b.checklist_items) {
          if (!replacedNotes.has(it.note_id)) continue;
          await db.run(
            `insert or replace into checklist_items (id, note_id, text, checked, position, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?)`,
            [it.id, it.note_id, it.text, it.checked ? 1 : 0, it.position, it.created_at, it.updated_at],
          );
        }
        for (const id of replacedNotes) await db.run('delete from attachments where note_id = ?', [id]);
        for (const a of b.attachments) {
          if (!replacedNotes.has(a.note_id)) continue;
          await db.run(
            `insert or replace into attachments (id, note_id, kind, file_name, mime, size, width, height, duration_ms, sha256, position, created_at, updated_at, text)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [a.id, a.note_id, a.kind, a.file_name, a.mime, a.size, a.width, a.height, a.duration_ms, a.sha256, a.position, a.created_at, a.updated_at, a.text],
          );
        }
        // Labels follow their note too. A version 2 backup has none: the note keeps what it had here.
        if (b.hasLabels) {
          for (const id of replacedNotes) await db.run('delete from note_labels where note_id = ?', [id]);
          for (const nl of b.note_labels) {
            const labelId = labelMap.get(nl.label_id);
            if (!replacedNotes.has(nl.note_id) || !labelId) continue;
            await db.run('insert or ignore into note_labels (note_id, label_id) values (?, ?)', [nl.note_id, labelId]);
          }
        }
        for (const r of b.reminders) {
          if (!replacedNotes.has(r.note_id)) continue;
          await cancelOs(r.note_id);
          await db.run('delete from reminders where note_id = ?', [r.note_id]);
          await db.run(
            `insert into reminders (id, note_id, fire_at, timezone, local_time, repeat, os_notification_id, status, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, null, ?, ?, ?)`,
            [r.id, r.note_id, r.fire_at, r.timezone, r.local_time, r.repeat, r.status, r.created_at, r.updated_at],
          );
        }
      });
      return { added, updated, skipped };
    });
  }

  return {
    subscribe,
    fts,
    // reads
    listNotes,
    listView,
    listTrash,
    listLabels,
    getNote,
    listFolders,
    searchNotes,
    noteAsText,
    getSettings,
    exportBackup,
    getAttachment,
    listAllAttachments,
    unreadPhotos,
    setPhotoText,
    usedFileNames,
    getTelegramFile,
    // notes
    createNote,
    updateNote,
    discardIfEmpty,
    trashNote,
    trashNotes,
    restoreNote,
    restoreNotes,
    deleteForever,
    deleteNotesForever,
    updateNotes,
    emptyTrash,
    purgeTrash,
    duplicateNote,
    convertNote,
    // items
    addItem,
    updateItem,
    toggleItem,
    removeItem,
    reorderItems,
    setAllItems,
    // attachments
    addAttachments,
    removeAttachment,
    setFileHash,
    saveTelegramFile,
    forgetTelegramFiles,
    // folders
    createFolder,
    renameFolder,
    deleteFolder,
    // labels
    createLabel,
    renameLabel,
    deleteLabel,
    setLabel,
    // reminders
    setReminder,
    clearReminder,
    reconcileReminders,
    reminderFired,
    // settings and backup
    setSetting,
    importBackup,
  };
}

// ------------------------------------------------------------ backup validation

type BackupData = {
  folders: FolderRow[];
  notes: NoteRow[];
  checklist_items: ItemRow[];
  reminders: ReminderRow[];
  attachments: AttachmentRow[];
  labels: LabelRow[];
  note_labels: NoteLabelRow[];
  /** False for backups made before labels existed (version 1 and 2). */
  hasLabels: boolean;
};

export function validateBackup(data: unknown): BackupData {
  const fail = (why: string): never => {
    throw new BackupFormatError(why);
  };
  if (!data || typeof data !== 'object') fail('not a backup file');
  const d = data as Record<string, unknown>;
  if (d.format !== BACKUP_FORMAT) fail('not a Pocketleaf backup');
  if (typeof d.schema_version !== 'number' || d.schema_version > BACKUP_VERSION) fail('made by a newer version of the app');
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as Record<string, unknown>[]) : fail(`missing ${k}`));
  const str = (v: unknown) => typeof v === 'string';
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

  const folders = arr('folders').filter((f) => str(f.id) && str(f.name) && String(f.name).trim()) as unknown as FolderRow[];
  folders.forEach((f) => {
    f.position = num(f.position) ? f.position : 0;
    f.created_at = num(f.created_at) ? f.created_at : 0;
    f.updated_at = num(f.updated_at) ? f.updated_at : 0;
    f.name = f.name.trim().slice(0, 60);
  });
  const notes = arr('notes').filter(
    (n) => str(n.id) && (n.type === 'text' || n.type === 'checklist') && num(n.created_at) && num(n.updated_at),
  ) as unknown as NoteRow[];
  notes.forEach((n) => {
    n.title = str(n.title) ? n.title : '';
    n.body = str(n.body) ? n.body : '';
    n.color = str(n.color) ? n.color : 'default';
    n.font_family = str(n.font_family) ? n.font_family : 'default';
    n.font_size = str(n.font_size) ? n.font_size : 'm';
    n.folder_id = str(n.folder_id) ? n.folder_id : null;
    n.deleted_at = num(n.deleted_at) ? n.deleted_at : null;
    n.pinned = n.pinned ? 1 : 0;
    n.archived = n.archived ? 1 : 0;
  });
  const noteIds = new Set(notes.map((n) => n.id));
  const items = arr('checklist_items').filter(
    (i) => str(i.id) && str(i.note_id) && noteIds.has(String(i.note_id)) && num(i.position),
  ) as unknown as ItemRow[];
  items.forEach((i) => {
    i.text = str(i.text) ? i.text : '';
    i.checked = i.checked ? 1 : 0;
    i.created_at = num(i.created_at) ? i.created_at : 0;
    i.updated_at = num(i.updated_at) ? i.updated_at : 0;
  });
  const reminders = arr('reminders').filter(
    (r) =>
      str(r.id) && str(r.note_id) && noteIds.has(String(r.note_id)) && num(r.fire_at) && str(r.timezone) &&
      str(r.local_time) && ['none', 'daily', 'weekly', 'monthly'].includes(String(r.repeat)) &&
      ['scheduled', 'fired', 'done'].includes(String(r.status)),
  ) as unknown as ReminderRow[];
  // Version 1 backups have no attachments.
  const rawAtts = Array.isArray(d.attachments) ? (d.attachments as Record<string, unknown>[]) : [];
  const attachments = rawAtts.filter(
    (a) =>
      str(a.id) && str(a.note_id) && noteIds.has(String(a.note_id)) && (a.kind === 'image' || a.kind === 'video' || a.kind === 'audio') &&
      str(a.file_name) && isSafeFileName(String(a.file_name)) && num(a.position),
  ) as unknown as AttachmentRow[];
  attachments.forEach((a) => {
    a.mime = str(a.mime) ? a.mime : a.kind === 'video' ? 'video/mp4' : a.kind === 'audio' ? 'audio/wav' : 'image/jpeg';
    // Version 3 and older backups have no photo text: it is read again on this phone.
    a.text = str(a.text) ? String(a.text).slice(0, 20_000) : null;
    a.size = num(a.size) ? a.size : 0;
    a.width = num(a.width) ? a.width : null;
    a.height = num(a.height) ? a.height : null;
    a.duration_ms = num(a.duration_ms) ? a.duration_ms : null;
    a.sha256 = str(a.sha256) && /^[0-9a-f]{64}$/.test(String(a.sha256)) ? a.sha256 : null;
    a.created_at = num(a.created_at) ? a.created_at : 0;
    a.updated_at = num(a.updated_at) ? a.updated_at : 0;
  });
  // Version 1 and 2 backups have no labels.
  const hasLabels = Array.isArray(d.labels);
  const labels = (hasLabels ? (d.labels as Record<string, unknown>[]) : []).filter(
    (l) => str(l.id) && str(l.name) && String(l.name).trim(),
  ) as unknown as LabelRow[];
  labels.forEach((l) => {
    l.name = l.name.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX_CHARS);
    l.created_at = num(l.created_at) ? l.created_at : 0;
    l.updated_at = num(l.updated_at) ? l.updated_at : 0;
  });
  const labelIds = new Set(labels.map((l) => l.id));
  const noteLabels = (Array.isArray(d.note_labels) ? (d.note_labels as Record<string, unknown>[]) : []).filter(
    (nl) => str(nl.note_id) && str(nl.label_id) && noteIds.has(String(nl.note_id)) && labelIds.has(String(nl.label_id)),
  ) as unknown as NoteLabelRow[];
  return { folders, notes, checklist_items: items, reminders, attachments, labels, note_labels: noteLabels, hasLabels };
}
