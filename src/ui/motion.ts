/**
 * Motion helpers. Motion in Pocketleaf only ever explains something: a
 * press was felt, a sheet came from the bottom edge, a note was made. Every
 * duration comes from tokens.motion; exits are faster than entrances; with
 * Reduce Motion on, movement becomes a short fade.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutAnimation, Platform } from 'react-native';

/** Confident arrival: decelerates into place, no overshoot. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Leaving: accelerates away. */
export const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

/**
 * The OS "Reduce Motion" setting (on the web, prefers-reduced-motion). When
 * it is on, every slide becomes a short fade (theme.motion.reduced).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * Mount-then-animate for overlays. `progress` runs 0 → 1 when `open` turns
 * true, and back to 0 (faster) before `mounted` turns false, so an overlay
 * can play its exit instead of vanishing.
 */
export function usePresence(open: boolean, enterMs: number, exitMs: number) {
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));
  const [mounted, setMounted] = useState(open);
  // Mount as soon as it opens (allowed during render: it only ever turns on here).
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? enterMs : exitMs,
      easing: open ? EASE_OUT : EASE_IN,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => anim.stop();
  }, [open, enterMs, exitMs, progress]);

  return { mounted, progress };
}

/**
 * Let the next layout change ease into place (an item moving to "Done", the
 * Write button folding). Native only; the web lays out instantly. Skipped
 * with Reduce Motion on.
 */
export function easeNextLayout(reduced: boolean, ms = 160) {
  if (reduced || Platform.OS === 'web') return;
  LayoutAnimation.configureNext({
    duration: ms,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity, duration: Math.round(ms * 0.75) },
  });
}

// ---------------------------------------------------------------- input modality (web)

/**
 * Whether the last input was the keyboard. The focus ring is for keyboard
 * and switch users; a mouse click should not leave a ring behind (the web's
 * :focus-visible rule). Native platforms always show it: focus there only
 * moves with a keyboard, switch control or a TV remote.
 */
let keyboardLast = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) keyboardLast = true;
  }, true);
  window.addEventListener('pointerdown', () => (keyboardLast = false), true);
}

export function focusFromKeyboard(): boolean {
  return Platform.OS !== 'web' || keyboardLast;
}
