import { Text as RNText, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme, withAlpha, type Theme, type TypeName } from '@/theme/theme';

import { focusFromKeyboard } from './motion';

type Variant = TypeName;
type Tone = 'text' | 'muted' | 'accent' | 'danger' | 'success' | 'warning' | 'onAccent';

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  weight?: TextStyle['fontWeight'];
};

export function toneColor(theme: Theme, tone: Tone): string {
  const c = theme.color;
  return {
    text: c.text,
    muted: c.textMuted,
    accent: c.accent,
    danger: c.danger,
    success: c.success,
    warning: c.warning,
    onAccent: c.onAccent,
  }[tone];
}

/**
 * All interface text goes through this: type scale + colour role + OS font
 * scaling (max 2x). The serif variants (entry, screen, page) set the user's
 * own words; a weight override never applies to them (the weight is in the font).
 */
export function AppText({ variant = 'base', tone = 'text', weight, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const t = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={2}
      {...rest}
      style={[t, { color: toneColor(theme, tone) }, weight && !t.fontFamily ? { fontWeight: weight } : null, style]}
    />
  );
}

/** Pressable state, including the web-only `hovered` / `focused` flags react-native-web passes. */
export type PState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/**
 * The 2px focus ring every pressable shows while focused from a keyboard,
 * switch control or remote (on the web, not after a mouse click).
 */
export function focusRing(theme: Theme, state: PState, radius: number): ViewStyle | null {
  if (!state.focused || !focusFromKeyboard()) return null;
  return {
    outlineColor: theme.color.focus,
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineOffset: 2,
    borderRadius: radius,
  } as ViewStyle;
}

/**
 * The ink wash under a pressable: a faint one on hover (pointer devices), a
 * firmer one while pressed, so hovering and pressing read as two states.
 */
export function stateWash(theme: Theme, state: PState): ViewStyle | null {
  if (state.pressed) return { backgroundColor: withAlpha(theme.color.text, 0.1) };
  if (state.hovered) return { backgroundColor: withAlpha(theme.color.text, 0.05) };
  return null;
}
