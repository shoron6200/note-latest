import { AlertTriangle, ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, withAlpha } from '@/theme/theme';

import { Button, IconButton, type IconType } from './controls';
import { AppText } from './Text';

// ---------------------------------------------------------------- TopBar

export function TopBar({
  title,
  onBack,
  actions,
  scrolled,
  bg,
  serif,
}: {
  title?: string;
  /** The title is the user's own words (a folder or label name): set it in the serif. */
  serif?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  scrolled?: boolean;
  /** Editor: the note's own colour. */
  bg?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          height: t.layout['top-bar-height'],
          paddingHorizontal: onBack ? t.space[1] : t.space[4],
          backgroundColor: bg ?? t.color.bg,
          borderBottomWidth: scrolled ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: t.color.border,
        },
      ]}
    >
      {onBack && <IconButton icon={ArrowLeft} label="Back" onPress={onBack} />}
      <AppText variant={serif ? 'screen' : 'xl'} role="heading" numberOfLines={1} style={{ flex: 1, marginLeft: onBack ? t.space[1] : 0 }}>
        {title ?? ''}
      </AppText>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

// ---------------------------------------------------------------- EmptyState

/**
 * An empty page, not an illustration: three faint ruled lines with the
 * margin rule, a serif line saying what is (not) here, and one plain line
 * saying what to do. The icon is kept for screen-specific meaning, small.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact,
}: {
  icon?: IconType;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}) {
  const t = useTheme();
  const margin = t.layout.margin;
  return (
    <View style={[styles.empty, { paddingVertical: compact ? t.space[6] : t.space[8] }]}>
      <View aria-hidden style={[styles.emptyRule, { left: margin, backgroundColor: t.color.border }]} />
      {[0, 1, 2].map((i) => (
        <View key={i} aria-hidden style={{ height: t.space[5], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: withAlpha(t.color.border, 0.7) }} />
      ))}
      <View style={{ paddingLeft: margin + t.space[4], paddingTop: t.space[5], gap: t.space[2] }}>
        {Icon ? (
          <View aria-hidden style={{ position: 'absolute', left: (margin - 18) / 2, top: t.space[5] + 8 }}>
            <Icon size={18} color={t.color.textMuted} strokeWidth={1.75} />
          </View>
        ) : null}
        <AppText variant={compact ? 'entry' : 'page'} role="heading">
          {title}
        </AppText>
        {body ? (
          <AppText variant="body" tone="muted" style={{ maxWidth: 360 }}>
            {body}
          </AppText>
        ) : null}
        {action ? (
          <View style={{ marginTop: t.space[2] }}>
            <Button label={action.label} variant="secondary" onPress={action.onPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Banner (permission warnings)

export function Banner({
  tone = 'warning',
  message,
  action,
}: {
  tone?: 'warning' | 'danger';
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  const fg = tone === 'danger' ? t.color.danger : t.color.warning;
  return (
    <View
      role="alert"
      style={[styles.banner, { backgroundColor: withAlpha(fg, 0.1), borderRadius: t.radius.sm, padding: t.space[3] }]}
    >
      <AlertTriangle size={20} color={fg} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="sm" style={{ color: t.color.text }}>
          {message}
        </AppText>
        {action ? (
          <View style={{ marginLeft: -t.space[3] }}>
            <Button label={action.label} variant="text" size="sm" onPress={action.onPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  empty: { width: '100%', maxWidth: 560 },
  emptyRule: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
