/**
 * A note in the home list or grid, drawn as a page from a pocket notebook:
 * a margin rule in the note's colour, status glyphs in the margin beside the
 * line they describe, the user's title in the serif, and one plain footer of
 * metadata (reminder, progress, folder, #labels). No pills.
 */
import { Bell, Check, Folder, Image as ImageIcon, Mic, Pin, Repeat } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { copy } from '@/copy';
import type { VisualKind } from '@/data/types';
import { noteFontStyle } from '@/theme/fonts';
import { isWide, useTheme, withAlpha, type NoteColor, type NoteFont, type Theme } from '@/theme/theme';

import { ripple, Tag } from './controls';
import { CardCover } from './media';
import { AppText, focusRing, type PState, stateWash } from './Text';

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
  /** First photo or video, drawn across the top of a grid card. */
  cover?: { kind: VisualKind; fileName: string };
  mediaCount?: number;
  voiceCount?: number;
  /** Label names, set as #name in the footer. */
  labels?: string[];
};

const CARD_LABELS = 3;
const PREVIEW_ITEMS = 5;

/** The note title's text style: the serif for Standard notes, the note's own font otherwise. */
export function entryTitleStyle(t: Theme, font: NoteFont) {
  return font === 'default' ? t.type.entry : { ...t.type.entry, fontFamily: undefined, fontWeight: '400' as const, ...noteFontStyle(font, true) };
}

export function NoteCard({
  note,
  layout = 'grid',
  selected,
  onPress,
  onLongPress,
}: {
  note: NoteCardData;
  /** `list`: an entry on the page (margin column at the left). `grid`: a leaf of its own. */
  layout?: 'list' | 'grid';
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isList = note.type === 'checklist';
  const grid = layout === 'grid';
  const items = note.items?.slice(0, PREVIEW_ITEMS) ?? [];
  const more = (note.itemCount ?? items.length) - items.length;
  const empty = !note.title && !note.preview && items.length === 0 && !note.cover && !note.voiceCount;
  const picking = selected !== undefined;

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

  const ruleColor = selected ? t.color.accent : t.noteRule[note.color];
  const ruleWidth = selected ? 4 : t.layout['rule-width'];
  const margin = grid ? t.space[3] : isWide(width) ? t.layout['margin-wide'] : t.layout.margin;
  const textInset = margin + t.layout['rule-width'] + (grid ? 10 : t.space[3]);
  const wash = t.note[note.color];

  // ------------------------------------------------------------ pieces

  const title = note.title ? (
    <AppText numberOfLines={grid ? 3 : 2} style={[entryTitleStyle(t, note.font), { color: t.color.text }, grid && picking && { paddingRight: 24 }]}>
      {note.title}
    </AppText>
  ) : null;

  const listPreview = isList
    ? grid
      ? items.length > 0 && (
          <View style={{ gap: 4 }}>
            {items.map((it, i) => (
              <View key={i} style={styles.item}>
                <View
                  style={[
                    styles.miniBox,
                    { borderColor: t.color.textMuted, borderRadius: t.radius.xs },
                    it.checked && { backgroundColor: t.color.textMuted },
                  ]}
                >
                  {it.checked && <Check size={10} color={wash} strokeWidth={3.5} />}
                </View>
                <AppText
                  variant="body"
                  numberOfLines={1}
                  style={[{ flex: 1, color: withAlpha(t.color.text, 0.82) }, noteFontStyle(note.font), it.checked && { textDecorationLine: 'line-through', color: t.color.textMuted }]}
                >
                  {it.text}
                </AppText>
              </View>
            ))}
            {more > 0 && (
              <AppText variant="sm" tone="muted">
                +{more} more
              </AppText>
            )}
          </View>
        )
      : items.length > 0 && (
          // The list view reads like an index: the items run on as one line.
          <AppText variant="body" numberOfLines={2} style={[{ color: withAlpha(t.color.text, 0.82) }, noteFontStyle(note.font)]}>
            {items.map((i) => i.text).join(', ')}
            {more > 0 ? '…' : ''}
          </AppText>
        )
    : null;

  const textPreview =
    !isList && !!note.preview ? (
      <AppText
        variant="body"
        numberOfLines={grid ? t.layout['card-preview-lines'] : 2}
        style={[{ color: withAlpha(t.color.text, 0.82) }, noteFontStyle(note.font), !note.title && grid && picking ? { paddingRight: 24 } : null]}
      >
        {/* The index runs a note on as one paragraph; a leaf keeps its line breaks. */}
        {grid ? note.preview : note.preview.replace(/\s+/g, ' ').trim()}
      </AppText>
    ) : null;

  const progress = isList && note.itemCount ? `${note.doneCount ?? 0} of ${note.itemCount} done` : null;
  const labels = note.labels ?? [];
  const hasFooter = !!(note.reminder || progress || note.folder || note.voiceCount || note.mediaCount || labels.length);
  const footer = hasFooter ? (
    <View style={styles.footer}>
      {note.reminder ? (
        <Tag
          // In the list the bell sits in the margin; the time stays here.
          icon={grid ? (note.reminder.repeat ? Repeat : Bell) : note.reminder.repeat ? Repeat : undefined}
          label={note.reminder.label}
          tone={note.reminder.overdue ? 'danger' : 'muted'}
        />
      ) : null}
      {progress ? <Tag label={progress} /> : null}
      {note.voiceCount ? <Tag icon={Mic} label={note.voiceCount > 1 ? copy.voice.count(note.voiceCount) : copy.voice.title} /> : null}
      {note.mediaCount && !note.cover ? <Tag icon={ImageIcon} label={String(note.mediaCount)} /> : null}
      {note.folder ? <Tag icon={Folder} label={note.folder} /> : null}
      {labels.slice(0, CARD_LABELS).map((l) => (
        <LabelChip key={l} label={l} />
      ))}
      {labels.length > CARD_LABELS ? <Tag label={`+${labels.length - CARD_LABELS}`} /> : null}
    </View>
  ) : null;

  const marginGlyph = (icon: ReactNode) => (
    <View style={[styles.marginCell, { width: margin }]} aria-hidden>
      {icon}
    </View>
  );
  const pinGlyph = <Pin size={15} color={t.color.textMuted} fill={withAlpha(t.color.textMuted, 0.9)} strokeWidth={1.75} />;
  const pickGlyph = (
    <View style={[styles.pick, { borderRadius: t.radius.xs, borderColor: selected ? t.color.accent : t.color.textMuted }, selected && { backgroundColor: t.color.accent }]}>
      {selected ? <Check size={12} color={t.color.onAccent} strokeWidth={3} /> : null}
    </View>
  );

  // ------------------------------------------------------------ layouts

  const pressStyle = (s: PState) => [
    grid
      ? [styles.leaf, { backgroundColor: wash, borderRadius: t.radius.md, borderColor: selected ? t.color.accent : t.color.border }]
      : { backgroundColor: wash },
    (s.pressed || s.hovered) && { backgroundColor: blend(wash, withAlpha(t.color.text, s.pressed ? 0.08 : 0.04)) },
    focusRing(t, s, grid ? t.radius.md : 0),
  ];

  const rule = (
    <View
      aria-hidden
      style={[styles.rule, { left: margin, width: ruleWidth, backgroundColor: ruleColor, marginLeft: selected ? -1 : 0 }]}
    />
  );

  return (
    <Pressable
      role="button"
      accessibilityHint={hint || undefined}
      aria-pressed={picking ? selected : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      // A short delay before the pressed wash, so starting a scroll over a
      // card doesn't flash it. Still well inside the 100 ms feedback window.
      unstable_pressDelay={Platform.OS === 'web' ? 0 : 64}
      android_ripple={ripple(t)}
      style={pressStyle}
    >
      {grid ? (
        <View>
          {note.cover && <CardCover kind={note.cover.kind} fileName={note.cover.fileName} count={note.mediaCount ?? 1} />}
          <View style={{ paddingTop: t.space[4], paddingBottom: t.space[4], paddingLeft: textInset, paddingRight: t.space[3], gap: t.space[2] }}>
            {rule}
            {/* Pinned leaves sit under "Pinned"; the corner is kept for the selection box. */}
            {picking && <View style={styles.corner}>{pickGlyph}</View>}
            {title}
            {empty && (
              <AppText variant="body" tone="muted">
                Empty note
              </AppText>
            )}
            {textPreview}
            {listPreview}
            {footer}
          </View>
        </View>
      ) : (
        <View style={{ paddingVertical: t.space[4], paddingRight: t.space[4], gap: t.space[1] }}>
          {rule}
          <View style={styles.line}>
            {marginGlyph(picking ? pickGlyph : note.pinned ? pinGlyph : null)}
            <View style={[styles.content, { paddingLeft: t.layout['rule-width'] + t.space[3] }]}>
              {title ?? (empty ? <AppText variant="body" tone="muted">Empty note</AppText> : textPreview ?? listPreview)}
            </View>
            {note.cover ? (
              <View style={{ marginLeft: t.space[3] }}>
                <CardCover variant="thumb" kind={note.cover.kind} fileName={note.cover.fileName} count={note.mediaCount ?? 1} />
              </View>
            ) : null}
          </View>
          {title && (textPreview || listPreview) ? (
            <View style={styles.line}>
              {marginGlyph(null)}
              <View style={[styles.content, { paddingLeft: t.layout['rule-width'] + t.space[3] }]}>{textPreview ?? listPreview}</View>
            </View>
          ) : null}
          {footer ? (
            <View style={[styles.line, { marginTop: t.space[1] }]}>
              {marginGlyph(note.reminder ? <Bell size={14} color={note.reminder.overdue ? t.color.danger : t.color.textMuted} strokeWidth={2} /> : null)}
              <View style={[styles.content, { paddingLeft: t.layout['rule-width'] + t.space[3] }]}>{footer}</View>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/** A label, set the way it is typed: #name. Tappable in the editor (opens the label picker). */
export function LabelChip({ label, onPress }: { label: string; onPress?: () => void }) {
  const t = useTheme();
  const body = (
    <View style={styles.labelRow}>
      <AppText variant="sm" weight="500" aria-hidden style={{ color: withAlpha(t.color.textMuted, 0.7) }}>
        #
      </AppText>
      <AppText variant="sm" weight="500" numberOfLines={1} style={{ color: t.color.textMuted, maxWidth: 160 }}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return <View style={styles.label}>{body}</View>;
  return (
    <Pressable
      role="button"
      aria-label={copy.labels.chip(label)}
      onPress={onPress}
      hitSlop={10}
      style={(s: PState) => [
        styles.label,
        { borderRadius: t.radius.xs, paddingHorizontal: 4, marginHorizontal: -4 },
        stateWash(t, s),
        focusRing(t, s, t.radius.xs),
      ]}
    >
      {body}
    </Pressable>
  );
}

/** Lay a translucent `#rrggbbaa` wash over an opaque `#rrggbb` colour. */
function blend(base: string, over: string): string {
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const a = over.length === 9 ? p(over, 7) / 255 : 1;
  const ch = (i: number) => Math.round(p(base, i) * (1 - a) + p(over, i) * a).toString(16).padStart(2, '0');
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

const styles = StyleSheet.create({
  leaf: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  rule: { position: 'absolute', top: 0, bottom: 0 },
  corner: { position: 'absolute', top: 16, right: 12, zIndex: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start' },
  marginCell: { alignItems: 'center', paddingTop: 4, minHeight: 20 },
  content: { flex: 1, minWidth: 0 },
  pick: { width: 18, height: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniBox: { width: 14, height: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginTop: 2 },
  label: { minHeight: 20, justifyContent: 'center', alignSelf: 'flex-start' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
});
