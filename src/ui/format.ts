import type { NoteSummary } from '@/data/types';

import type { NoteCardData } from './NoteCard';

const DAY = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Today 18:00", "Tomorrow 9:00", "Yesterday 9:00", "Fri 23 Oct 10:00". */
export function whenLabel(ts: number, now = Date.now()): string {
  const days = Math.round((startOfDay(ts) - startOfDay(now)) / DAY);
  const time = timeLabel(ts);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  const date = new Date(ts).toLocaleDateString([], {
    weekday: Math.abs(days) < 7 ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
  return `${date} ${time}`;
}

const WEEKDAY = (ts: number) => new Date(ts).toLocaleDateString([], { weekday: 'long' });

/** Card chip text for a reminder. Repeats say how often. */
export function reminderChip(r: NonNullable<NoteSummary['reminder']>, now = Date.now()) {
  const overdue = r.status !== 'scheduled' || r.fireAt < now;
  let label: string;
  if (r.repeat === 'daily') label = `Daily ${timeLabel(r.fireAt)}`;
  else if (r.repeat === 'weekly') label = `${WEEKDAY(r.fireAt)}s ${timeLabel(r.fireAt)}`;
  else if (r.repeat === 'monthly') label = `Monthly, ${whenLabel(r.fireAt, now)}`;
  else label = whenLabel(r.fireAt, now);
  return { label, overdue: overdue && r.repeat === 'none', repeat: r.repeat !== 'none' };
}

/** "just now", "5 min ago", "today 10:42", "yesterday", "3 Oct". */
export function editedLabel(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (days === 0) return `today ${timeLabel(ts)}`;
  if (days === 1) return 'yesterday';
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** `hideLabel`: inside a label's own view its chip would only repeat the title. */
export function toCard(n: NoteSummary, opts: { showFolder?: boolean; now?: number; hideLabel?: string } = {}): NoteCardData {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    preview: n.preview,
    items: n.items,
    itemCount: n.itemCount,
    doneCount: n.doneCount,
    color: n.color,
    font: n.font,
    pinned: n.pinned,
    folder: opts.showFolder ? (n.folderName ?? undefined) : undefined,
    reminder: n.reminder ? reminderChip(n.reminder, opts.now) : undefined,
    cover: n.cover ?? undefined,
    mediaCount: n.attachmentCount,
    voiceCount: n.audioCount,
    labels: opts.hideLabel ? n.labels.filter((l) => l.id !== opts.hideLabel).map((l) => l.name) : n.labels.map((l) => l.name),
  };
}
