import { Text as RNText, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '@/theme/theme';

type Variant = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'display';
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

/** All interface text goes through this: type scale + colour role + OS font scaling (max 1.5x). */
export function AppText({ variant = 'base', tone = 'text', weight, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const t = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={1.5}
      {...rest}
      style={[t, { color: toneColor(theme, tone) }, weight ? { fontWeight: weight } : null, style]}
    />
  );
}

/** Pressable state, including the web-only `hovered` / `focused` flags react-native-web passes. */
export type PState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/** The 2px focus ring every pressable shows while focused (keyboard, switch control, web). */
export function focusRing(theme: Theme, state: PState, radius: number): ViewStyle | null {
  if (!state.focused) return null;
  return {
    outlineColor: theme.color.focus,
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineOffset: 2,
    borderRadius: radius,
  } as ViewStyle;
}
