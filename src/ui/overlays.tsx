import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, withAlpha } from '@/theme/theme';

import { Button } from './controls';
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
      <View style={[styles.grab, { backgroundColor: t.color.borderInput }]} />
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
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent {...dialogName(title)}>
      <View style={styles.sheetHost}>
        <Pressable
          role="button"
          aria-label="Close"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(t.color.scrim, 0.4) }]}
        />
        <SheetSurface title={title}>{children}</SheetSurface>
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
      style={[styles.dialog, { backgroundColor: t.color.surfaceRaised, borderRadius: t.radius.lg, padding: t.space[6] }, t.elevation.sheet]}
    >
      <AppText variant="lg" role="heading">
        {title}
      </AppText>
      {body ? <AppText tone="muted">{body}</AppText> : null}
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
  const { open, ...rest } = props;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={rest.cancel.onPress} statusBarTranslucent {...dialogName(rest.title)}>
      <View style={[styles.dialogHost, { backgroundColor: withAlpha(t.color.scrim, 0.4) }]}>
        <DialogSurface {...rest} />
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
      style={[styles.snack, { backgroundColor: t.color.snackbarBg, borderRadius: t.radius.md }, t.elevation.snackbar]}
    >
      <AppText variant="sm" style={{ color: t.color.snackbarText, flex: 1 }}>
        {message}
      </AppText>
      {action ? (
        <Pressable role="button" aria-label={action.label} onPress={action.onPress} hitSlop={12} style={{ paddingHorizontal: 8, minHeight: 36, justifyContent: 'center' }}>
          <AppText variant="sm" weight="700" style={{ color: t.color.snackbarAction }}>
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
  grab: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12, opacity: 0.6 },
  dialogHost: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 400, gap: 12 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  snack: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 16, paddingRight: 8, paddingVertical: 6 },
});
