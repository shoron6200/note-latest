import { View } from 'react-native';

import { copy } from '@/copy';
import type { NoteSummary } from '@/data/types';
import { useTheme } from '@/theme/theme';

import { toCard } from './format';
import { NoteCard } from './NoteCard';
import { AppText } from './Text';
import { useNow } from './useNow';

type GridProps = {
  notes: NoteSummary[];
  columns: number;
  showFolder?: boolean;
  /** Inside a label's view: leave that label's chip off the cards. */
  hideLabel?: string;
  /** Multi-select is on: every card shows whether it is picked. */
  selected?: Set<string> | null;
  onOpen: (n: NoteSummary) => void;
  onLongPress?: (n: NoteSummary) => void;
};

/**
 * Notes as a masonry grid (cards keep their natural height) or a single list.
 * Order runs left to right, then down, so pinned notes stay at the top.
 */
export function NoteGrid({ notes, columns, showFolder, hideLabel, selected, onOpen, onLongPress }: GridProps) {
  const t = useTheme();
  const gap = t.layout['grid-gap'];
  const now = useNow();
  const cols: NoteSummary[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  notes.forEach((n, i) => cols[i % cols.length].push(n));
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {cols.map((col, i) => (
        <View key={i} style={{ flex: 1, gap }}>
          {col.map((n) => (
            <NoteCard
              key={n.id}
              note={toCard(n, { showFolder, now, hideLabel })}
              selected={selected ? selected.has(n.id) : undefined}
              onPress={() => onOpen(n)}
              onLongPress={onLongPress ? () => onLongPress(n) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export type NoteSection = { key: string; title?: string; notes: NoteSummary[] };

/**
 * Keep's headings: "Pinned" and "Others" when something is pinned, and an
 * "Archive" group at the end where archived notes are mixed in (labels,
 * folders, search). Reminders split into upcoming and already sent.
 */
export function sectionsFor(kind: 'notes' | 'reminders' | 'archive' | 'trash' | 'label' | 'folder' | 'search', notes: NoteSummary[]): NoteSection[] {
  if (kind === 'archive' || kind === 'trash') return [{ key: 'all', notes }];
  if (kind === 'reminders') {
    const up = notes.filter((n) => n.reminder?.status === 'scheduled');
    const sent = notes.filter((n) => n.reminder?.status !== 'scheduled');
    if (!sent.length) return [{ key: 'up', notes: up }];
    return [
      { key: 'up', title: up.length ? copy.browse.upcoming : undefined, notes: up },
      { key: 'sent', title: copy.browse.sent, notes: sent },
    ].filter((s) => s.notes.length);
  }
  const live = notes.filter((n) => !n.archived);
  const pinned = live.filter((n) => n.pinned);
  const others = live.filter((n) => !n.pinned);
  const archived = notes.filter((n) => n.archived);
  const out: NoteSection[] = [];
  if (pinned.length) out.push({ key: 'pinned', title: copy.browse.pinned, notes: pinned });
  if (others.length) out.push({ key: 'others', title: pinned.length ? copy.browse.others : undefined, notes: others });
  if (archived.length) out.push({ key: 'archive', title: copy.browse.archive, notes: archived });
  return out;
}

export function NoteSections({ sections, ...grid }: Omit<GridProps, 'notes'> & { sections: NoteSection[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2] }}>
      {sections.map((s, i) => (
        <View key={s.key} style={{ gap: t.space[2], marginTop: i && s.title ? t.space[3] : 0 }}>
          {s.title ? (
            <AppText
              variant="xs"
              weight="700"
              tone="muted"
              role="heading"
              aria-label={`${s.title}, ${copy.search.results(s.notes.length)}`}
              style={{ textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: t.space[1] }}
            >
              {s.title}
            </AppText>
          ) : null}
          <NoteGrid notes={s.notes} {...grid} />
        </View>
      ))}
    </View>
  );
}

/** Loading placeholders in the shape of the grid (no spinner). */
export function GridSkeleton({ columns }: { columns: number }) {
  const t = useTheme();
  const gap = t.layout['grid-gap'];
  const heights = [120, 180, 96, 150, 110, 170];
  return (
    <View style={{ flexDirection: 'row', gap }} role="progressbar" aria-busy aria-label="Loading notes">
      {Array.from({ length: columns }, (_, c) => (
        <View key={c} style={{ flex: 1, gap }}>
          {heights
            .filter((_, i) => i % columns === c)
            .map((h, i) => (
              <View key={i} style={{ height: h, borderRadius: t.radius.md, backgroundColor: t.color.surface }} />
            ))}
        </View>
      ))}
    </View>
  );
}
