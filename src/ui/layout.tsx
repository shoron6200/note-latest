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
}: {
  title?: string;
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
      <AppText variant="xl" role="heading" numberOfLines={1} style={{ flex: 1 }}>
        {title ?? ''}
      </AppText>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

// ---------------------------------------------------------------- EmptyState

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact,
}: {
  icon: IconType;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Icon size={48} color={t.color.textMuted} strokeWidth={1.5} />
      <AppText variant={compact ? 'lg' : 'display'} role="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body ? (
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      ) : null}
      {action ? (
        <View style={{ marginTop: t.space[2] }}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
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
      style={[styles.banner, { backgroundColor: withAlpha(fg, 0.12), borderRadius: t.radius.md, padding: t.space[3] }]}
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
  empty: { alignItems: 'center', gap: 12, maxWidth: 320, alignSelf: 'center', paddingVertical: 48 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
