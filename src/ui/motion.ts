import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The OS "Reduce Motion" setting. When it is on, every slide becomes a short
 * fade (theme.motion.reduced), as tokens.json promises.
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
