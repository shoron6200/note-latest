import { Bell, Check, Folder, Mic, Pin, Repeat } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/copy';
import type { VisualKind } from '@/data/types';
import { noteFontStyle } from '@/theme/fonts';
import { useTheme, withAlpha, type NoteColor, type NoteFont } from '@/theme/theme';

import { Tag } from './controls';
import { CardCover } from './media';
import { AppText, focusRing, type PState } from './Text';

/** The shape listNotes() returns for one card (see replica/architecture.md). */
export type NoteCardData = {
  id: string;
  type: 'text' | 'checklist';
  title: string;
  preview: string; // text notes: first ~200 chars of the body
  items?: { text: string; checked: boolean }[]; // checklists: first items, unchecked first
  itemCount?: number;
  doneCount?: number;
  color: NoteColor;
  font: NoteFont;
  pinned?: boolean;
  folder?: string;
  reminder?: { label: string; overdue?: boolean; repeat?: boolean };
  /** First photo or video, drawn across the top. */
  cover?: { kind: VisualKind; fileName: string };
  mediaCount?: number;
  /** Voice notes: a small mic chip, like Keep's. */
  voiceCount?: number;
  /** Label names, shown as small chips at the bottom (Keep shows a few, then "+N"). */
  labels?: string[];
};

const CARD_LABELS = 2;

const PREVIEW_ITEMS = 5;

export function NoteCard({
  note,
  selected,
  onPress,
  onLongPress,
}: {
  note: NoteCardData;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const lines = t.layout['card-preview-lines'];
  const isList = note.type === 'checklist';
  const items = note.items?.slice(0, PREVIEW_ITEMS) ?? [];
  const more = (note.itemCount ?? items.length) - items.length;
  const empty = !note.title && !note.preview && items.length === 0 && !note.cover && !note.voiceCount;

  // The card is named by the text it shows (so voice control can say "tap
  // Groceries"); phone screen readers also hear this summary after it.
  const hint = [
    note.pinned ? 'Pinned' : '',
    isList ? `Checklist, ${note.doneCount ?? 0} of ${note.itemCount ?? 0} done` : '',
    note.mediaCount ? copy.attach.count(note.mediaCount) : '',
    note.voiceCount ? copy.voice.count(note.voiceCount) : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      role="button"
      accessibilityHint={hint || undefined}
      aria-pressed={selected === undefined ? undefined : selected}
      onPress={onPress}
      onLongPress={onLongPress}
      style={(s: PState) => [
        styles.card,
        {
          backgroundColor: t.note[note.color],
          borderRadius: t.radius.md,
          padding: t.space[4],
          borderWidth: note.color === 'default' ? 1 : 0,
          borderColor: t.color.border,
        },
        (s.pressed || s.hovered) && { opacity: 0.92 },
        selected && { borderWidth: 2, borderColor: t.color.focus, padding: t.space[4] - 2 },
        focusRing(t, s, t.radius.md),
      ]}
    >
      <View style={styles.body}>
      {note.cover && <CardCover kind={note.cover.kind} fileName={note.cover.fileName} count={note.mediaCount ?? 1} />}
      {(note.pinned || selected) && (
        <View style={styles.corner}>
          {selected ? (
            <View style={[styles.badge, { backgroundColor: t.color.focus }]}>
              <Check size={14} color={t.mode === 'dark' ? t.color.bg : '#ffffff'} strokeWidth={3} />
            </View>
          ) : note.cover ? (
            // On a photo the pin needs its own backdrop to stay visible.
            <View style={[styles.badge, { backgroundColor: t.note[note.color] }]}>
              <Pin size={14} color={t.color.textMuted} />
            </View>
          ) : (
            <Pin size={16} color={t.color.textMuted} />
          )}
        </View>
      )}

      {!!note.title && (
        <AppText variant="lg" numberOfLines={2} style={[noteFontStyle(note.font, true), { paddingRight: 20 }]}>
          {note.title}
        </AppText>
      )}

      {empty && (
        <AppText variant="sm" tone="muted">
          Empty note
        </AppText>
      )}

      {!isList && !!note.preview && (
        <AppText
          variant="sm"
          tone="muted"
          numberOfLines={lines}
          // Without a title, the preview is the first line: keep it clear of the pin / check badge.
          style={[noteFontStyle(note.font), !note.title && (note.pinned || selected) ? { paddingRight: 24 } : null]}
        >
          {note.preview}
        </AppText>
      )}

      {isList && items.length > 0 && (
        <View style={{ gap: 4 }}>
          {items.map((it, i) => (
            <View key={i} style={styles.item}>
              <View
                style={[
                  styles.miniBox,
                  { borderColor: t.color.textMuted },
                  it.checked && { backgroundColor: t.color.textMuted, borderColor: t.color.textMuted },
                ]}
              >
                {it.checked && <Check size={10} color={t.note[note.color]} strokeWidth={3.5} />}
              </View>
              <AppText
                variant="sm"
                tone="muted"
                numberOfLines={1}
                style={[{ flex: 1 }, noteFontStyle(note.font), it.checked && { textDecorationLine: 'line-through' }]}
              >
                {it.text}
              </AppText>
            </View>
          ))}
          {more > 0 && (
            <AppText variant="xs" tone="muted">
              +{more} more
            </AppText>
          )}
        </View>
      )}

      {(note.reminder || note.folder || note.voiceCount || (note.labels && note.labels.length > 0)) && (
        <View style={styles.tags}>
          {note.voiceCount ? <Tag icon={Mic} label={note.voiceCount > 1 ? copy.voice.count(note.voiceCount) : copy.voice.title} /> : null}
          {note.reminder && (
            <Tag
              icon={note.reminder.repeat ? Repeat : Bell}
              label={note.reminder.label}
              tone={note.reminder.overdue ? 'danger' : 'muted'}
            />
          )}
          {note.folder && <Tag icon={Folder} label={note.folder} />}
          {note.labels?.slice(0, CARD_LABELS).map((l) => (
            <LabelChip key={l} label={l} />
          ))}
          {note.labels && note.labels.length > CARD_LABELS && <LabelChip label={`+${note.labels.length - CARD_LABELS}`} />}
        </View>
      )}
      </View>
    </Pressable>
  );
}

/** A label on a card: an outlined pill with just the name. */
export function LabelChip({ label, onPress }: { label: string; onPress?: () => void }) {
  const t = useTheme();
  const body = (
    <AppText variant="xs" numberOfLines={1} style={{ color: t.color.text, maxWidth: 140 }}>
      {label}
    </AppText>
  );
  const style = [styles.label, { borderColor: withAlpha(t.color.text, 0.22), borderRadius: t.radius.pill, backgroundColor: withAlpha(t.color.text, 0.05) }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable role="button" aria-label={copy.labels.chip(label)} onPress={onPress} hitSlop={10} style={(s: PState) => [style, focusRing(t, s, t.radius.pill)]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { height: 24, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, alignSelf: 'flex-start' },
  card: { overflow: 'hidden' },
  body: { gap: 8 },
  corner: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniBox: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
