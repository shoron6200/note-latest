/**
 * The navigation drawer: slides in from the left over a scrim, like Keep's.
 * Back, a tap on the scrim, or picking an entry closes it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useTheme, withAlpha } from '@/theme/theme';

import type { IconType } from './controls';
import { AppText, focusRing, type PState } from './Text';

const WIDTH = 320;

export function NavDrawer({ open, onClose, header, children }: { open: boolean; onClose: () => void; header?: ReactNode; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(WIDTH, Math.round(screen * 0.85));
  // Kept in state (not a ref) so reading it while rendering is allowed.
  const [x] = useState(() => new Animated.Value(-width));
  const [mounted, setMounted] = useState(open);
  // Mount as soon as it opens; unmount only after the close animation ends.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    Animated.timing(x, {
      toValue: open ? 0 : -width,
      duration: open ? 220 : 180,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, width, x]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!mounted) return null;
  const scrim = x.interpolate({ inputRange: [-width, 0], outputRange: [0, 1] });
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrim, backgroundColor: withAlpha(t.color.scrim, 0.4) }]}>
        <Pressable role="button" aria-label={copy.nav.close} onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        role="navigation"
        aria-label={copy.nav.open}
        style={[
          styles.panel,
          {
            width,
            transform: [{ translateX: x }],
            backgroundColor: t.color.surfaceRaised,
            borderTopRightRadius: t.radius.lg,
            borderBottomRightRadius: t.radius.lg,
            paddingTop: insets.top + t.space[2],
          },
          t.elevation.sheet,
        ]}
      >
        {header}
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + t.space[4] }}>{children}</ScrollView>
      </Animated.View>
    </Modal>
  );
}

/** One entry: a pill that fills with the accent tint when it is the current view. */
export function DrawerItem({
  icon: Icon,
  label,
  selected,
  onPress,
  trailing,
}: {
  icon: IconType;
  label: string;
  selected?: boolean;
  onPress: () => void;
  trailing?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      onPress={onPress}
      style={(s: PState) => [
        styles.item,
        { borderRadius: t.radius.pill, marginHorizontal: t.space[3], paddingHorizontal: t.space[4] },
        selected && { backgroundColor: withAlpha(t.color.accent, t.mode === 'dark' ? 0.24 : 0.14) },
        !selected && (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.06) },
        focusRing(t, s, t.radius.pill),
      ]}
    >
      <Icon size={22} color={selected ? t.color.accent : t.color.textMuted} />
      <AppText weight={selected ? '700' : '500'} numberOfLines={1} style={{ flex: 1, color: selected ? t.color.accent : t.color.text }}>
        {label}
      </AppText>
      {trailing ? (
        <AppText variant="xs" tone="muted">
          {trailing}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** "Labels ............ Edit" */
export function DrawerHeading({ label, action }: { label: string; action?: { label: string; a11y?: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View style={[styles.heading, { paddingLeft: t.space[6], paddingRight: t.space[3], marginTop: t.space[2] }]}>
      <AppText variant="xs" weight="700" tone="muted" role="heading" style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </AppText>
      {action ? (
        <Pressable
          role="button"
          aria-label={action.a11y ?? action.label}
          onPress={action.onPress}
          hitSlop={8}
          style={(s: PState) => [
            { paddingHorizontal: t.space[3], minHeight: 36, justifyContent: 'center', borderRadius: t.radius.pill },
            (s.pressed || s.hovered) && { backgroundColor: withAlpha(t.color.text, 0.06) },
            focusRing(t, s, t.radius.pill),
          ]}
        >
          <AppText variant="sm" weight="600" tone="accent">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DrawerDivider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.color.border, marginVertical: t.space[2], marginHorizontal: t.space[4] }} />;
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 },
  heading: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
});
