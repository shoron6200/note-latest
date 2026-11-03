import { useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, withAlpha } from '@/theme/theme';

import { Button } from './controls';
import { usePresence, useReducedMotion } from './motion';
import { AppText } from './Text';

/** The web Modal passes extra props to its dialog element, which needs a name. */
const dialogName = (title?: string) => (title ? ({ 'aria-label': title } as object) : {});

// ---------------------------------------------------------------- Bottom sheet

/** The panel itself. Rendered inline on the /design route, inside a Modal in the app. */
export function SheetSurface({ title, children }: { title?: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: t.color.surfaceRaised,
          borderTopLeftRadius: t.radius.lg,
          borderTopRightRadius: t.radius.lg,
          maxWidth: t.layout['sheet-max-width'],
          paddingBottom: Math.max(insets.bottom, t.space[4]),
        },
        t.elevation.sheet,
      ]}
    >
      <View style={[styles.grab, { backgroundColor: t.color.border }]} />
      {title ? (
        <AppText variant="lg" role="heading" style={{ paddingHorizontal: t.space[4], marginBottom: t.space[2] }}>
          {title}
        </AppText>
      ) : null}
      <View style={{ paddingHorizontal: t.space[2] }}>{children}</View>
    </View>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  // The scrim fades while the sheet rises from the bottom edge it belongs to;
  // closing is quicker than opening. Reduce Motion: a short fade, no travel.
  const { mounted, progress } = usePresence(open, reduced ? t.motion.reduced : t.motion.base, reduced ? t.motion.reduced : t.motion.fast);
  const [height, setHeight] = useState(480);
  if (!mounted) return null;
  // The whole sheet travels from below the screen's edge, so it reads as coming from there.
  const rise = reduced ? 0 : height;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent {...dialogName(title)}>
      <View style={styles.sheetHost} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress, backgroundColor: withAlpha(t.color.scrim, 0.4) }]}>
          <Pressable role="button" aria-label="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setHeight(Math.ceil(e.nativeEvent.layout.height))}
          style={{
            width: '100%',
            alignItems: 'center',
            opacity: reduced ? progress : 1,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }],
          }}
        >
          <SheetSurface title={title}>{children}</SheetSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- Dialog

type DialogAction = { label: string; onPress: () => void; variant?: 'primary' | 'danger'; loading?: boolean };

export function DialogSurface({
  title,
  body,
  children,
  cancel,
  confirm,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
  cancel: { label?: string; onPress: () => void };
  confirm: DialogAction;
}) {
  const t = useTheme();
  return (
    <View
      role={confirm.variant === 'danger' ? 'alertdialog' : 'dialog'}
      aria-label={title}
      style={[styles.dialog, { backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.dialog, padding: t.space[6] }, t.elevation.sheet]}
    >
      <AppText variant="lg" role="heading">
        {title}
      </AppText>
      {body ? <AppText variant="body" tone="muted">{body}</AppText> : null}
      {children}
      <View style={styles.dialogActions}>
        {/* Cancel first in reading order: the safe action gets initial focus on destructive dialogs. */}
        <Button label={cancel.label ?? 'Cancel'} variant="text" size="sm" onPress={cancel.onPress} />
        <Button label={confirm.label} variant={confirm.variant ?? 'primary'} size="sm" loading={confirm.loading} onPress={confirm.onPress} />
      </View>
    </View>
  );
}

export function Dialog(props: Parameters<typeof DialogSurface>[0] & { open: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const { open, ...rest } = props;
  // A dialog interrupts in place: it fades up from 97% (no travel), and leaves faster.
  const { mounted, progress } = usePresence(open, reduced ? t.motion.reduced : t.motion.fast, reduced ? t.motion.reduced : 120);
  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={rest.cancel.onPress} statusBarTranslucent {...dialogName(rest.title)}>
      <View style={styles.dialogHost} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress, backgroundColor: withAlpha(t.color.scrim, 0.4) }]} />
        <Animated.View
          style={{
            width: '100%',
            alignItems: 'center',
            opacity: progress,
            transform: reduced ? [] : [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          }}
        >
          <DialogSurface {...rest} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- Snackbar

export function Snackbar({ message, action }: { message: string; action?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View
      aria-live="polite"
      style={[styles.snack, { backgroundColor: t.color.snackbarBg, borderRadius: t.radius.sm }, t.elevation.snackbar]}
    >
      <AppText variant="body" style={{ color: t.color.snackbarText, flex: 1 }}>
        {message}
      </AppText>
      {action ? (
        <Pressable role="button" aria-label={action.label} onPress={action.onPress} hitSlop={12} style={{ paddingHorizontal: 8, minHeight: 36, justifyContent: 'center' }}>
          <AppText variant="body" weight="600" style={{ color: t.color.snackbarAction }}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheetHost: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', paddingTop: 8 },
  grab: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  dialogHost: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 400, gap: 12 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  snack: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 16, paddingRight: 8, paddingVertical: 6 },
});
