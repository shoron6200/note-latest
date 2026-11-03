import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';

import { usePresence, useReducedMotion } from './motion';
import { Snackbar } from './overlays';

type Msg = { id: number; message: string; action?: { label: string; onPress: () => void } };
type Show = (message: string, action?: Msg['action']) => void;

const Ctx = createContext<Show>(() => {});
export const useSnackbar = () => useContext(Ctx);

const SHOW_MS = 5000;

/**
 * One snackbar at a time, above the Write button. Stays longer while a screen
 * reader is on. It rises a few points as it fades in (it came from the
 * action below it) and fades out faster; Reduce Motion keeps only the fade.
 */
export function SnackbarHost({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<Msg | null>(null);
  const seq = useRef(0);
  const reader = useRef(false);
  const reduced = useReducedMotion();
  const { mounted, progress } = usePresence(!!msg, reduced ? t.motion.reduced : t.motion.base, reduced ? t.motion.reduced : t.motion.fast);
  // The last message stays on screen while the snackbar fades out.
  const [shown, setShown] = useState<Msg | null>(null);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((v) => (reader.current = v)).catch(() => undefined);
  }, []);

  const show = useCallback<Show>((message, action) => {
    const m = { id: ++seq.current, message, action };
    setMsg(m);
    setShown(m);
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
      {mounted && shown && (
        <Animated.View
          pointerEvents={msg ? 'box-none' : 'none'}
          style={[
            styles.host,
            {
              bottom: insets.bottom + t.layout['fab-size'] + t.layout['fab-offset'] * 2,
              paddingHorizontal: t.layout.gutter,
              opacity: progress,
              transform: reduced ? [] : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <Snackbar
            message={shown.message}
            action={
              shown.action && {
                label: shown.action.label,
                onPress: () => {
                  shown.action!.onPress();
                  setMsg(null);
                },
              }
            }
          />
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0 },
});
