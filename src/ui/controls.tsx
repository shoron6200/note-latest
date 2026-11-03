import { Check, ChevronDown, ChevronRight, PenLine } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { copy } from '@/copy';
import { noteFontStyle, NOTE_FONT_LABELS } from '@/theme/fonts';
import { useTheme, withAlpha, type NoteColor, type NoteFont, type Theme } from '@/theme/theme';

import { AppText, focusRing, type PState, stateWash } from './Text';

export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

const TARGET = 48;

/** The one press/hover wash every control shares: ink at 6%. */
export const pressWash = (t: Theme) => withAlpha(t.color.text, 0.06);

/** Android's own ripple, in the same ink. Other platforms ignore it. */
export const ripple = (t: Theme, borderless = false) =>
  Platform.OS === 'android' ? { color: withAlpha(t.color.text, 0.12), borderless } : undefined;

// ---------------------------------------------------------------- IconButton

/**
 * A 48pt icon target. State is carried by the icon itself: `active` fills it
 * in the accent (a filled pin is pinned), never a tinted blob behind it.
 */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  variant = 'standard',
  active,
  disabled,
}: {
  icon: IconType;
  label: string;
  onPress?: () => void;
  variant?: 'standard' | 'filled' | 'danger';
  active?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const fg =
    variant === 'filled' ? t.color.onAccent : variant === 'danger' ? t.color.danger : active ? t.color.accent : t.color.text;
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      android_ripple={variant === 'filled' ? undefined : ripple(t, true)}
      style={(s: PState) => [
        styles.iconButton,
        variant === 'filled' && { backgroundColor: t.color.accent, borderRadius: t.radius.sm },
        variant !== 'filled' && stateWash(t, s),
        disabled && { opacity: 0.4 },
        focusRing(t, s, t.radius.pill),
      ]}
    >
      <Icon size={22} color={fg} strokeWidth={1.75} fill={active && variant === 'standard' ? withAlpha(t.color.accent, 0.9) : 'none'} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Button

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  /** `text` is the quiet button: accent label, no box. */
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconType;
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const look: Record<string, { bg?: string; fg: string; border?: string }> = {
    primary: { bg: t.color.accent, fg: t.color.onAccent },
    secondary: { fg: t.color.text, border: withAlpha(t.color.text, 0.3) },
    text: { fg: t.color.accent },
    danger: { bg: t.color.danger, fg: t.mode === 'dark' ? t.color.bg : t.color.onAccent },
  };
  const l = look[variant];
  const height = size === 'sm' ? 40 : 48;
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={size === 'sm' ? 4 : 0}
      android_ripple={ripple(t)}
      style={(s: PState) => [
        styles.button,
        {
          height,
          borderRadius: t.radius.sm,
          backgroundColor: l.bg ?? 'transparent',
          paddingHorizontal: variant === 'text' ? t.space[3] : t.space[5],
        },
        l.border ? { borderWidth: 1, borderColor: l.border } : null,
        // Filled buttons dim slightly; quiet and outlined ones get the ink wash.
        l.bg && s.pressed ? { opacity: 0.82 } : l.bg && s.hovered ? { opacity: 0.92 } : null,
        !l.bg && stateWash(t, s),
        disabled && { opacity: 0.4 },
        focusRing(t, s, t.radius.sm),
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={l.fg} /> : Icon ? <Icon size={18} color={l.fg} strokeWidth={2} /> : null}
      <AppText variant="base" weight="600" style={{ color: l.fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Write button (replaces the speed dial)

/**
 * The one floating control: a split button. "Write" starts a text note at
 * once; the chevron opens the other ways to start (list, photo, voice).
 * Long-pressing "Write" opens the same choices. `compact` folds it to the pen
 * while the list scrolls down.
 */
export function Fab({
  onPress,
  onMore,
  compact,
  style,
}: {
  onPress?: () => void;
  onMore?: () => void;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const h = t.layout['fab-size'];
  return (
    <View
      style={[styles.write, { height: h, borderRadius: t.radius.sm, backgroundColor: t.color.accent }, t.elevation.fab, style]}
    >
      <Pressable
        role="button"
        aria-label={copy.newItem.fabLabel}
        onPress={onPress}
        onLongPress={onMore}
        android_ripple={{ color: withAlpha(t.color.onAccent, 0.2) }}
        style={(s: PState) => [
          styles.writeMain,
          { paddingHorizontal: compact ? 0 : t.space[4], width: compact ? h : undefined, borderRadius: t.radius.sm },
          (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.onAccent, s.pressed ? 0.2 : 0.1) },
          focusRing(t, s, t.radius.sm),
        ]}
      >
        <PenLine size={20} color={t.color.onAccent} strokeWidth={2} />
        {compact ? null : (
          <AppText variant="base" weight="600" tone="onAccent">
            {copy.newItem.fabLabel}
          </AppText>
        )}
      </Pressable>
      {onMore && !compact ? (
        <>
          <View style={{ width: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch', marginVertical: 12, backgroundColor: withAlpha(t.color.onAccent, 0.35) }} />
          <Pressable
            role="button"
            aria-label={copy.newItem.more}
            aria-haspopup="menu"
            onPress={onMore}
            android_ripple={{ color: withAlpha(t.color.onAccent, 0.2) }}
            style={(s: PState) => [
              styles.writeMore,
              { borderRadius: t.radius.sm },
              (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.onAccent, s.pressed ? 0.2 : 0.1) },
              focusRing(t, s, t.radius.sm),
            ]}
          >
            <ChevronDown size={20} color={t.color.onAccent} strokeWidth={2} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- FolderChip

export function FolderChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      role="tab"
      aria-selected={selected}
      aria-label={count === undefined ? label : `${label} ${count} notes`}
      onPress={onPress}
      hitSlop={6}
      style={(s: PState) => [
        styles.chip,
        {
          borderRadius: t.radius.sm,
          borderWidth: 1,
          borderColor: selected ? t.color.accent : t.color.border,
          backgroundColor: selected ? withAlpha(t.color.accent, t.mode === 'dark' ? 0.18 : 0.1) : 'transparent',
        },
        !selected && stateWash(t, s),
        focusRing(t, s, t.radius.sm),
      ]}
    >
      <AppText variant="body" weight={selected ? '600' : '500'} style={{ color: selected ? t.color.accent : t.color.text }}>
        {label}
        {count !== undefined && (
          <AppText variant="xs" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
            {`  ${count}`}
          </AppText>
        )}
      </AppText>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Colour swatches

export const NOTE_COLOR_LABELS: Record<NoteColor, string> = {
  default: 'No colour',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
  gray: 'Grey',
};

/** A swatch shows the note's margin-rule colour: the colour you'll actually see on the page. */
export function ColourSwatch({
  color,
  selected,
  onPress,
}: {
  color: NoteColor;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  const none = color === 'default';
  return (
    <Pressable
      role="radio"
      aria-checked={!!selected}
      aria-label={NOTE_COLOR_LABELS[color]}
      onPress={onPress}
      style={(s: PState) => [styles.swatchTarget, focusRing(t, s, t.radius.pill)]}
    >
      <View
        style={[
          styles.swatch,
          none
            ? { backgroundColor: t.color.surfaceRaised, borderWidth: 1.5, borderColor: t.color.borderInput }
            : { backgroundColor: t.noteRule[color] },
          selected && { borderWidth: 2, borderColor: t.color.text },
        ]}
      >
        {selected ? <Check size={18} color={none ? t.color.text : t.color.surfaceRaised} strokeWidth={2.5} /> : null}
        {none && !selected ? <View style={[styles.noneSlash, { backgroundColor: t.color.borderInput }]} /> : null}
      </View>
    </Pressable>
  );
}

export function ColourPicker({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  const t = useTheme();
  const colors = Object.keys(t.note) as NoteColor[];
  // Wraps instead of scrolling sideways: all ten are visible at once.
  return (
    <View role="radiogroup" aria-label="Note colour" style={styles.swatchGrid}>
      {colors.map((c) => (
        <ColourSwatch key={c} color={c} selected={c === value} onPress={() => onChange(c)} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Font option

export function FontOption({
  font,
  selected,
  onPress,
}: {
  font: NoteFont;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      role="radio"
      aria-checked={!!selected}
      aria-label={`${NOTE_FONT_LABELS[font]} font`}
      onPress={onPress}
      android_ripple={ripple(t)}
      style={(s: PState) => [
        styles.row,
        { borderRadius: t.radius.sm, paddingHorizontal: t.space[3] },
        stateWash(t, s),
        focusRing(t, s, t.radius.sm),
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText style={[{ fontSize: t.noteSize.m.size, lineHeight: t.noteSize.m.line }, noteFontStyle(font)]}>
          Milk, eggs, call mum
        </AppText>
        <AppText variant="sm" tone="muted">
          {NOTE_FONT_LABELS[font]}
        </AppText>
      </View>
      {selected && <Check size={20} color={t.color.accent} strokeWidth={2.25} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Segmented control

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; a11y?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const t = useTheme();
  return (
    <View role="radiogroup" aria-label={label} style={[styles.segmented, { backgroundColor: t.color.surface, borderRadius: t.radius.sm }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            role="radio"
            aria-checked={on}
            aria-label={o.a11y ?? o.label}
            onPress={() => onChange(o.value)}
            style={(s: PState) => [
              styles.segment,
              { borderRadius: t.radius.sm - 2 },
              on && { backgroundColor: t.color.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: t.color.border },
              !on && stateWash(t, s),
              focusRing(t, s, t.radius.sm),
            ]}
          >
            <AppText variant="body" weight={on ? '600' : '400'} tone={on ? 'text' : 'muted'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Tag (inline metadata)

/**
 * A piece of metadata (reminder time, folder, voice): a small icon and text,
 * set inline in the text column. No pill; tappable ones get the press wash.
 */
export function Tag({
  icon: Icon,
  label,
  tone = 'muted',
  onPress,
}: {
  icon?: IconType;
  label: string;
  tone?: 'muted' | 'danger';
  onPress?: () => void;
}) {
  const t = useTheme();
  const fg = tone === 'danger' ? t.color.danger : t.color.textMuted;
  const body = (
    <>
      {Icon && <Icon size={14} color={fg} strokeWidth={2} />}
      <AppText variant="sm" weight="500" style={{ color: fg, fontVariant: ['tabular-nums'], flexShrink: 1 }}>
        {label}
      </AppText>
    </>
  );
  if (!onPress) return <View style={styles.tag}>{body}</View>;
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      hitSlop={12}
      style={(s: PState) => [
        styles.tag,
        { borderRadius: t.radius.xs, marginHorizontal: -4, paddingHorizontal: 4 },
        stateWash(t, s),
        focusRing(t, s, t.radius.xs),
      ]}
    >
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Settings row

export function SettingsRow({
  title,
  subtitle,
  value,
  toggle,
  onPress,
  onToggle,
  disabled,
  last,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  toggle?: boolean;
  onPress?: () => void;
  onToggle?: (v: boolean) => void;
  disabled?: boolean;
  /** The last row of a group draws no separator. */
  last?: boolean;
}) {
  const t = useTheme();
  const isToggle = toggle !== undefined;
  const right: ReactNode = isToggle ? (
    // Drawn to the platform's proportions; the whole row is the switch for screen readers.
    <View
      aria-hidden
      style={[
        styles.track,
        { backgroundColor: toggle ? t.color.accent : withAlpha(t.color.text, 0.22), borderRadius: t.radius.pill, alignItems: toggle ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: toggle ? t.color.onAccent : t.color.surfaceRaised, borderRadius: t.radius.pill }]} />
    </View>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {value ? (
        <AppText variant="body" tone="muted">
          {value}
        </AppText>
      ) : null}
      {onPress ? <ChevronRight size={18} color={t.color.textMuted} strokeWidth={1.75} /> : null}
    </View>
  );
  return (
    <Pressable
      role={isToggle ? 'switch' : 'button'}
      aria-label={isToggle ? title : undefined}
      aria-checked={isToggle ? toggle : undefined}
      aria-disabled={disabled}
      disabled={disabled || (!onPress && !isToggle)}
      onPress={isToggle ? () => onToggle?.(!toggle) : onPress}
      android_ripple={ripple(t)}
      style={(s: PState) => [
        styles.row,
        { paddingHorizontal: t.space[4], gap: t.space[4] },
        stateWash(t, s),
        disabled && { opacity: 0.4 },
        focusRing(t, s, 0),
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{title}</AppText>
        {subtitle ? (
          <AppText variant="sm" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {last ? null : (
        <View style={[styles.separator, { left: t.space[4], backgroundColor: t.color.border }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start' },
  write: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  writeMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  writeMore: { width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 12 },
  swatchTarget: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  noneSlash: { position: 'absolute', width: 1.5, height: 44, transform: [{ rotate: '45deg' }] },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 8 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4, alignSelf: 'flex-start' },
  segment: { minHeight: 40, minWidth: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  track: { width: 48, height: 28, padding: 3, justifyContent: 'center' },
  thumb: { width: 22, height: 22 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 20, alignSelf: 'flex-start', maxWidth: '100%' },
  separator: { position: 'absolute', right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
});
