import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';

import { Snackbar } from './overlays';

type Msg = { id: number; message: string; action?: { label: string; onPress: () => void } };
type Show = (message: string, action?: Msg['action']) => void;

const Ctx = createContext<Show>(() => {});
export const useSnackbar = () => useContext(Ctx);

const SHOW_MS = 5000;

/** One snackbar at a time, above the FAB. Stays put while a screen reader is on. */
export function SnackbarHost({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<Msg | null>(null);
  const seq = useRef(0);
  const reader = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((v) => (reader.current = v)).catch(() => undefined);
  }, []);

  const show = useCallback<Show>((message, action) => {
    setMsg({ id: ++seq.current, message, action });
  }, []);

  useEffect(() => {
    if (!msg) return;
    const ms = reader.current ? SHOW_MS * 3 : SHOW_MS;
    const timer = setTimeout(() => setMsg((m) => (m?.id === msg.id ? null : m)), ms);
    return () => clearTimeout(timer);
  }, [msg]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <View
          pointerEvents="box-none"
          style={[
            styles.host,
            { bottom: insets.bottom + t.layout['fab-size'] + t.layout['fab-offset'] * 2, paddingHorizontal: t.layout.gutter },
          ]}
        >
          <Snackbar
            message={msg.message}
            action={
              msg.action && {
                label: msg.action.label,
                onPress: () => {
                  msg.action!.onPress();
                  setMsg(null);
                },
              }
            }
          />
        </View>
      )}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0 },
});
