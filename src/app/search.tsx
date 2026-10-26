/**
 * S09 Search, Keep-style. Empty, it offers filters: types (reminders, lists,
 * photos and videos), labels and colours. Pick one to see those notes, then
 * type to search within it. Archived notes are found too, under "Archive".
 */
import { router } from 'expo-router';
import { ArrowLeft, Bell, CheckSquare, Image as ImageIcon, Mic, SearchX, Tag, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useQuery, useSettings } from '@/data/DataProvider';
import type { SearchFilter } from '@/data/types';
import { SelectionBar, useSelection } from '@/features/selection';
import { gridColumns, NOTE_COLORS, useTheme, withAlpha, type NoteColor } from '@/theme/theme';
import { IconButton, NOTE_COLOR_LABELS, type IconType } from '@/ui/controls';
import { EmptyState } from '@/ui/layout';
import { GridSkeleton, NoteSections, sectionsFor } from '@/ui/NoteGrid';
import { AppText, focusRing, type PState } from '@/ui/Text';

export default function SearchScreen() {
  const t = useTheme();
  const settings = useSettings();
  const { width } = useWindowDimensions();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter | null>(null);
  const sel = useSelection();

  useEffect(() => {
    const h = setTimeout(() => setQuery(text.trim()), t.layout['search-debounce-ms']);
    return () => clearTimeout(h);
  }, [text, t.layout]);

  const labels = useQuery((r) => r.listLabels(), []).data ?? [];
  const results = useQuery((r) => r.searchNotes(query, filter), [query, filter]);
  const contentWidth = Math.min(width, 1280) - t.layout.gutter * 2;
  const columns = settings?.viewMode === 'list' ? 1 : gridColumns(contentWidth);
  const typing = text.trim() !== query;
  const filterName = filter ? filterLabel(filter, labels) : null;
  const searching = !!query || !!filter;
  const list = results.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.bg }} edges={['top', 'left', 'right']}>
      {sel.active ? (
        <SelectionBar notes={list.filter((n) => sel.ids.has(n.id))} onClear={sel.clear} />
      ) : (
        <View style={[styles.bar, { height: t.layout['top-bar-height'] + 8, paddingHorizontal: t.space[1], borderBottomColor: t.color.border }]}>
          <IconButton icon={ArrowLeft} label={copy.common.back} onPress={() => router.back()} />
          {filter && filterName ? (
            <Pressable
              role="button"
              aria-label={`${copy.search.clearFilter}: ${filterName}`}
              onPress={() => setFilter(null)}
              style={(s: PState) => [
                styles.filterChip,
                { backgroundColor: withAlpha(t.color.accent, 0.14), borderRadius: t.radius.pill },
                focusRing(t, s, t.radius.pill),
              ]}
            >
              <AppText variant="sm" weight="600" tone="accent" numberOfLines={1} style={{ maxWidth: 120 }}>
                {filterName}
              </AppText>
              <X size={14} color={t.color.accent} />
            </Pressable>
          ) : null}
          <TextInput
            aria-label={copy.search.placeholder}
            placeholder={filterName ? copy.search.within(filterName) : copy.search.placeholder}
            placeholderTextColor={t.color.textMuted}
            value={text}
            onChangeText={setText}
            autoFocus
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={t.color.accent}
            cursorColor={t.color.accent}
            style={[t.type.base, { flex: 1, color: t.color.text, minHeight: 48, paddingHorizontal: t.space[2] }, { outlineStyle: 'none' } as object]}
          />
          {text ? <IconButton icon={X} label="Clear search" onPress={() => setText('')} /> : null}
        </View>
      )}

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: t.space[8] }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contentWidth, gap: t.space[3], paddingTop: t.space[3] }}>
          {!searching ? (
            <Filters labels={labels} onPick={setFilter} />
          ) : !results.data || typing ? (
            <GridSkeleton columns={columns} />
          ) : list.length === 0 ? (
            <EmptyState compact icon={SearchX} title={copy.search.noneTitle} body={query ? copy.search.noneBody(query) : undefined} />
          ) : (
            <>
              <AppText variant="sm" tone="muted" aria-live="polite">
                {copy.search.results(list.length)}
              </AppText>
              <NoteSections
                sections={sectionsFor('search', list)}
                columns={columns}
                showFolder
                selected={sel.active ? sel.ids : null}
                onOpen={(n) => (sel.active ? sel.toggle(n.id) : router.push({ pathname: '/note/[id]', params: { id: n.id } }))}
                onLongPress={(n) => sel.toggle(n.id)}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function filterLabel(f: SearchFilter, labels: { id: string; name: string }[]): string {
  if (f.kind === 'label') return labels.find((l) => l.id === f.id)?.name ?? copy.search.labels;
  if (f.kind === 'color') return NOTE_COLOR_LABELS[f.value as NoteColor] ?? f.value;
  if (f.value === 'checklist') return copy.search.lists;
  if (f.value === 'media') return copy.search.media;
  if (f.value === 'audio') return copy.search.voice;
  return copy.search.reminders;
}

function Heading({ children }: { children: string }) {
  const t = useTheme();
  return (
    <AppText variant="xs" weight="700" tone="muted" role="heading" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginTop: t.space[2] }}>
      {children}
    </AppText>
  );
}

function Tile({ icon: Icon, label, onPress }: { icon: IconType; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      style={(s: PState) => [
        styles.tile,
        { backgroundColor: t.color.surface, borderRadius: t.radius.md, padding: t.space[3] },
        (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.1) },
        focusRing(t, s, t.radius.md),
      ]}
    >
      <Icon size={28} color={t.color.accent} />
      <AppText variant="sm" weight="500" numberOfLines={2} style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Filters({ labels, onPick }: { labels: { id: string; name: string }[]; onPick: (f: SearchFilter) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[3] }}>
      <Heading>{copy.search.types}</Heading>
      <View style={styles.tiles}>
        <Tile icon={Bell} label={copy.search.reminders} onPress={() => onPick({ kind: 'type', value: 'reminder' })} />
        <Tile icon={CheckSquare} label={copy.search.lists} onPress={() => onPick({ kind: 'type', value: 'checklist' })} />
        <Tile icon={ImageIcon} label={copy.search.media} onPress={() => onPick({ kind: 'type', value: 'media' })} />
        <Tile icon={Mic} label={copy.search.voice} onPress={() => onPick({ kind: 'type', value: 'audio' })} />
      </View>

      {labels.length > 0 && (
        <>
          <Heading>{copy.search.labels}</Heading>
          <View style={styles.tiles}>
            {labels.map((l) => (
              <Tile key={l.id} icon={Tag} label={l.name} onPress={() => onPick({ kind: 'label', id: l.id })} />
            ))}
          </View>
        </>
      )}

      <Heading>{copy.search.colours}</Heading>
      <View style={[styles.swatches, { gap: t.space[2] }]} role="group" aria-label={copy.search.colours}>
        {NOTE_COLORS.map((c) => (
          <Pressable
            key={c}
            role="button"
            aria-label={NOTE_COLOR_LABELS[c]}
            onPress={() => onPick({ kind: 'color', value: c })}
            style={(s: PState) => [
              styles.swatch,
              { backgroundColor: t.note[c], borderColor: t.color.borderInput },
              (s.pressed || s.hovered) && { transform: [{ scale: 0.94 }] },
              focusRing(t, s, 999),
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: 104, minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 6 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1 },
});
