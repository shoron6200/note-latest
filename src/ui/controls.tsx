import { Check, Plus, X, ChevronRight } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { copy } from '@/copy';
import { noteFontStyle, NOTE_FONT_LABELS } from '@/theme/fonts';
import { useTheme, withAlpha, type NoteColor, type NoteFont } from '@/theme/theme';

import { AppText, focusRing, type PState } from './Text';

export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TARGET = 48;

// ---------------------------------------------------------------- IconButton

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
      style={(s: PState) => [
        styles.iconButton,
        variant === 'filled' && { backgroundColor: t.color.accent },
        (s.pressed || s.hovered) && variant !== 'filled' && { backgroundColor: withAlpha(t.color.text, 0.08) },
        active && variant === 'standard' && { backgroundColor: withAlpha(t.color.accent, 0.12) },
        disabled && { opacity: 0.4 },
        focusRing(t, s, t.radius.pill),
      ]}
    >
      <Icon size={24} color={fg} strokeWidth={2} />
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
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconType;
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const look: Record<string, { bg?: string; fg: string; border?: string }> = {
    primary: { bg: t.color.accent, fg: t.color.onAccent },
    secondary: { fg: t.color.text, border: t.color.borderInput },
    text: { fg: t.color.accent },
    danger: { bg: t.color.danger, fg: t.mode === 'dark' ? t.color.bg : '#ffffff' },
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
      style={(s: PState) => [
        styles.button,
        { height, backgroundColor: l.bg ?? 'transparent', paddingHorizontal: variant === 'text' ? t.space[3] : t.space[5] },
        l.border ? { borderWidth: 1, borderColor: l.border } : null,
        (s.pressed || s.hovered) && { opacity: 0.85 },
        (s.pressed || s.hovered) && !l.bg && { backgroundColor: withAlpha(t.color.text, 0.06) },
        disabled && { opacity: 0.4 },
        focusRing(t, s, t.radius.pill),
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={l.fg} /> : Icon ? <Icon size={20} color={l.fg} /> : null}
      <AppText variant="base" weight="600" style={{ color: l.fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Fab

export function Fab({
  expanded,
  onPress,
  actions,
  style,
}: {
  expanded?: boolean;
  onPress?: () => void;
  actions?: { label: string; icon: IconType; onPress: () => void }[];
  style?: ViewStyle;
}) {
  const t = useTheme();
  const size = t.layout['fab-size'];
  return (
    <View style={[styles.fabWrap, style]} pointerEvents="box-none">
      {expanded &&
        actions?.map((a) => (
          <Pressable
            key={a.label}
            role="button"
            aria-label={a.label}
            onPress={a.onPress}
            style={(s: PState) => [
              styles.fabAction,
              { backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.pill },
              t.elevation.fab,
              (s.pressed || s.hovered) && { opacity: 0.9 },
              focusRing(t, s, t.radius.pill),
            ]}
          >
            <a.icon size={20} color={t.color.text} />
            <AppText weight="600">{a.label}</AppText>
          </Pressable>
        ))}
      <Pressable
        role="button"
        aria-label={expanded ? copy.common.cancel : copy.newItem.fabLabel}
        aria-expanded={expanded}
        onPress={onPress}
        style={(s: PState) => [
          {
            width: size,
            height: size,
            borderRadius: t.radius.lg,
            backgroundColor: t.color.accent,
            alignItems: 'center',
            justifyContent: 'center',
          },
          t.elevation.fab,
          (s.pressed || s.hovered) && { opacity: 0.9 },
          focusRing(t, s, t.radius.lg),
        ]}
      >
        {expanded ? <X size={26} color={t.color.onAccent} /> : <Plus size={26} color={t.color.onAccent} />}
      </Pressable>
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
        { backgroundColor: selected ? t.color.accent : t.color.surface, borderRadius: t.radius.pill },
        !selected && (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.1) },
        focusRing(t, s, t.radius.pill),
      ]}
    >
      <AppText variant="sm" weight="500" tone={selected ? 'onAccent' : 'text'}>
        {label}
        {count !== undefined && (
          <AppText variant="xs" tone={selected ? 'onAccent' : 'muted'}>
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
          { backgroundColor: t.note[color], borderColor: selected ? t.color.focus : t.color.border },
          selected && { borderWidth: 2 },
        ]}
      >
        {selected && <Check size={20} color={t.color.text} strokeWidth={2.5} />}
      </View>
    </Pressable>
  );
}

export function ColourPicker({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  const t = useTheme();
  const colors = Object.keys(t.note) as NoteColor[];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} role="radiogroup" aria-label="Note colour">
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {colors.map((c) => (
          <ColourSwatch key={c} color={c} selected={c === value} onPress={() => onChange(c)} />
        ))}
      </View>
    </ScrollView>
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
      style={(s: PState) => [
        styles.row,
        { borderRadius: t.radius.md, paddingHorizontal: t.space[3] },
        (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.06) },
        focusRing(t, s, t.radius.md),
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText
          style={[{ fontSize: t.noteSize.m.size, lineHeight: t.noteSize.m.line }, noteFontStyle(font, selected)]}
        >
          Aa  Milk, eggs, call mum
        </AppText>
        <AppText variant="xs" tone="muted">
          {NOTE_FONT_LABELS[font]}
        </AppText>
      </View>
      {selected && <Check size={22} color={t.color.accent} />}
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
    <View role="radiogroup" aria-label={label} style={[styles.segmented, { backgroundColor: t.color.surface, borderRadius: t.radius.pill }]}>
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
              { borderRadius: t.radius.pill },
              on && { backgroundColor: t.color.surfaceRaised },
              on && t.elevation.fab,
              focusRing(t, s, t.radius.pill),
            ]}
          >
            <AppText variant="sm" weight={on ? '700' : '500'} tone={on ? 'text' : 'muted'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- Chip (reminder / folder tag)

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
  const fg = tone === 'danger' ? t.color.danger : t.color.text;
  const body = (
    <>
      {Icon && <Icon size={14} color={fg} />}
      <AppText variant="xs" style={{ color: fg }}>
        {label}
      </AppText>
    </>
  );
  const style = [styles.tag, { backgroundColor: withAlpha(t.color.surfaceRaised, 0.6), borderRadius: t.radius.pill }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable role="button" aria-label={label} onPress={onPress} hitSlop={12} style={(s: PState) => [style, focusRing(t, s, t.radius.pill)]}>
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
}: {
  title: string;
  subtitle?: string;
  value?: string;
  toggle?: boolean;
  onPress?: () => void;
  onToggle?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  const isToggle = toggle !== undefined;
  const right: ReactNode = isToggle ? (
    // Drawn, not a native Switch: the whole row is the switch for screen readers.
    <View
      aria-hidden
      style={[
        styles.track,
        { backgroundColor: toggle ? t.color.accent : t.color.borderInput, borderRadius: t.radius.pill, alignItems: toggle ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.pill }, t.elevation.fab]} />
    </View>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {value ? (
        <AppText variant="sm" tone="muted">
          {value}
        </AppText>
      ) : null}
      {onPress ? <ChevronRight size={20} color={t.color.textMuted} /> : null}
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
      style={(s: PState) => [
        styles.row,
        { paddingHorizontal: t.space[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.color.border },
        (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.05) },
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, alignSelf: 'flex-start' },
  fabWrap: { alignItems: 'flex-end', gap: 12 },
  fabAction: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 14 },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatchTarget: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4, alignSelf: 'flex-start' },
  segment: { minHeight: 40, minWidth: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  track: { width: 44, height: 26, padding: 3, justifyContent: 'center' },
  thumb: { width: 20, height: 20 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 24, alignSelf: 'flex-start' },
});
