/**
 * The navigation drawer: a leaf that slides in from the left over a scrim
 * (a fade with Reduce Motion on). Back, a tap on the scrim, or picking an
 * entry closes it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { useTheme, withAlpha } from '@/theme/theme';

import { ripple, type IconType } from './controls';
import { EASE_IN, EASE_OUT, useReducedMotion } from './motion';
import { AppText, focusRing, type PState, stateWash } from './Text';


export function NavDrawer({ open, onClose, header, children }: { open: boolean; onClose: () => void; header?: ReactNode; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(t.layout['drawer-width'], Math.round(screen * 0.85));
  const reduced = useReducedMotion();
  // Kept in state (not a ref) so reading it while rendering is allowed.
  const [x] = useState(() => new Animated.Value(-width));
  const [mounted, setMounted] = useState(open);
  // Mount as soon as it opens; unmount only after the close animation ends.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    Animated.timing(x, {
      toValue: open ? 0 : -width,
      duration: reduced ? t.motion.reduced : open ? t.motion.base : t.motion.fast,
      easing: open ? EASE_OUT : EASE_IN,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, width, x, reduced, t.motion.base, t.motion.fast, t.motion.reduced]);

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
            // Reduce Motion: the panel fades in place instead of sliding.
            transform: reduced ? [] : [{ translateX: x }],
            opacity: reduced ? scrim : 1,
            backgroundColor: t.color.surfaceRaised,
            borderTopRightRadius: t.radius.md,
            borderBottomRightRadius: t.radius.md,
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

/** One entry. The current view gets a leaf-green bar on its leading edge and a faint leaf wash. */
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
      android_ripple={ripple(t)}
      style={(s: PState) => [
        styles.item,
        { borderRadius: t.radius.sm, marginHorizontal: t.space[3], paddingHorizontal: t.space[3] },
        selected && { backgroundColor: withAlpha(t.color.accent, t.mode === 'dark' ? 0.16 : 0.1) },
        !selected && stateWash(t, s),
        focusRing(t, s, t.radius.sm),
      ]}
    >
      {selected ? <View style={[styles.bar, { backgroundColor: t.color.accent }]} /> : null}
      <Icon size={20} color={selected ? t.color.accent : t.color.textMuted} strokeWidth={1.75} />
      <AppText weight={selected ? '600' : '400'} numberOfLines={1} style={{ flex: 1, color: selected ? t.color.accent : t.color.text }}>
        {label}
      </AppText>
      {trailing ? (
        <AppText variant="xs" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
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
      <AppText variant="sm" weight="600" tone="muted" role="heading" style={{ flex: 1 }}>
        {label}
      </AppText>
      {action ? (
        <Pressable
          role="button"
          aria-label={action.a11y ?? action.label}
          onPress={action.onPress}
          hitSlop={8}
          style={(s: PState) => [
            { paddingHorizontal: t.space[3], minHeight: 36, justifyContent: 'center', borderRadius: t.radius.sm },
            stateWash(t, s),
            focusRing(t, s, t.radius.sm),
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
});
