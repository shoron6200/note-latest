import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
 * A rough height for a card, in lines, so the masonry can put each card in
 * the shortest column (dealing them round-robin left columns ragged).
 */
function estimate(n: NoteSummary): number {
  let h = 2; // padding
  if (n.cover) h += 7;
  if (n.title) h += n.title.length > 22 ? 2 : 1;
  if (n.type === 'checklist') h += Math.min(n.items.length, 5) + ((n.itemCount ?? 0) > 5 ? 1 : 0);
  else if (n.preview) h += Math.min(8, Math.ceil(n.preview.length / 26));
  if (n.reminder || n.folderName || n.labels.length || n.audioCount) h += 1;
  return h;
}

/**
 * Notes as an index (one column: entries on a single leaf, ruled between) or
 * a masonry grid of leaves (each card goes into the shortest column, so the
 * reading order stays roughly left to right, top to bottom).
 */
export function NoteGrid({ notes, columns, showFolder, hideLabel, selected, onOpen, onLongPress }: GridProps) {
  const t = useTheme();
  const gap = t.layout['grid-gap'];
  const now = useNow();
  if (columns <= 1) {
    return (
      <View style={[styles.sheet, { backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, borderColor: t.color.border }]}>
        {notes.map((n, i) => (
          <View key={n.id} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border } : null}>
            <NoteCard
              layout="list"
              note={toCard(n, { showFolder, now, hideLabel })}
              selected={selected ? selected.has(n.id) : undefined}
              onPress={() => onOpen(n)}
              onLongPress={onLongPress ? () => onLongPress(n) : undefined}
            />
          </View>
        ))}
      </View>
    );
  }
  const cols: NoteSummary[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  for (const n of notes) {
    const c = heights.indexOf(Math.min(...heights));
    cols[c].push(n);
    heights[c] += estimate(n) + 1;
  }
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {cols.map((col, i) => (
        <View key={i} style={{ flex: 1, gap }}>
          {col.map((n) => (
            <NoteCard
              key={n.id}
              layout="grid"
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
 * Groups: "Pinned" first when something is pinned (the rest follow under no
 * heading, after a wider gap), and an "Archive" group at the end where archived notes are mixed in (labels,
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
  if (others.length) out.push({ key: 'others', notes: others });
  if (archived.length) out.push({ key: 'archive', title: copy.browse.archive, notes: archived });
  return out;
}

export function NoteSections({ sections, ...grid }: Omit<GridProps, 'notes'> & { sections: NoteSection[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2] }}>
      {sections.map((s, i) => (
        <View key={s.key} style={{ gap: t.space[2], marginTop: i ? t.space[4] : 0 }}>
          {s.title ? (
            <AppText
              variant="sm"
              weight="600"
              tone="muted"
              role="heading"
              aria-label={`${s.title}, ${copy.search.results(s.notes.length)}`}
              style={{ paddingHorizontal: t.space[1] }}
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

/**
 * Loading placeholders in the shape of what is coming: index entries (a
 * margin rule, a title bar, a line of text) or grid leaves. No spinner and no
 * shimmer loop; they appear only if loading takes longer than a blink, so a
 * fast open never flashes grey boxes.
 */
export function GridSkeleton({ columns }: { columns: number }) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(id);
  }, []);
  const gap = t.layout['grid-gap'];
  const bar = { backgroundColor: t.color.surface, borderRadius: t.radius.xs };
  const a11y = { role: 'progressbar' as const, 'aria-busy': true, 'aria-label': 'Loading notes' };
  if (!visible) return <View {...a11y} style={{ minHeight: 120 }} />;
  if (columns <= 1) {
    return (
      <View {...a11y} style={[styles.sheet, { backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.md, borderColor: t.color.border }]}>
        {[0.55, 0.4, 0.62, 0.48].map((w, i) => (
          <View
            key={i}
            style={{
              paddingVertical: t.space[4],
              paddingLeft: t.layout.margin + t.layout['rule-width'] + t.space[3],
              paddingRight: t.space[4],
              gap: t.space[2],
              borderTopWidth: i ? StyleSheet.hairlineWidth : 0,
              borderTopColor: t.color.border,
            }}
          >
            <View style={[styles.skelRule, { left: t.layout.margin, backgroundColor: t.color.border }]} />
            <View style={[bar, { height: 16, width: `${w * 100}%` }]} />
            <View style={[bar, { height: 12, width: '85%' }]} />
          </View>
        ))}
      </View>
    );
  }
  const heights = [120, 180, 96, 150, 110, 170];
  return (
    <View style={{ flexDirection: 'row', gap }} {...a11y}>
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

const styles = StyleSheet.create({
  sheet: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  skelRule: { position: 'absolute', top: 0, bottom: 0, width: 2 },
});
