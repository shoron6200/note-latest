/**
 * The theme, read straight from replica/design/tokens.json so there is one
 * source of truth. Components use roles (theme.color.textMuted), never hex.
 * replica-brand changes the JSON values; nothing here needs to change.
 */
import { createContext, useContext } from 'react';
import { Platform, useColorScheme, type ViewStyle } from 'react-native';

import tokens from '../../replica/design/tokens.json';
import type { NoteColor, NoteSize } from './constants';

export type Mode = 'light' | 'dark';
export type ModeSetting = Mode | 'system';

export { NOTE_COLORS, NOTE_FONTS, NOTE_SIZES } from './constants';
export type { NoteColor, NoteFont, NoteSize } from './constants';

type UiColorTokens = typeof tokens.color.light;
type CamelCase<S extends string> = S extends `${infer H}-${infer T}`
  ? `${H}${Capitalize<CamelCase<T>>}`
  : S;
export type UiColors = { [K in keyof UiColorTokens as CamelCase<K & string>]: string };

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function uiColors(mode: Mode): UiColors {
  const src = tokens.color[mode] as Record<string, string>;
  return Object.fromEntries(Object.entries(src).map(([k, v]) => [camel(k), v])) as UiColors;
}

type TypeName = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'display';
export type TypeStyle = { fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '600' | '700' };

function typeScale(): Record<TypeName, TypeStyle> {
  const out = {} as Record<TypeName, TypeStyle>;
  for (const [k, v] of Object.entries(tokens.type)) {
    out[k as TypeName] = {
      fontSize: v.size,
      lineHeight: v.line,
      fontWeight: String(v.weight) as TypeStyle['fontWeight'],
    };
  }
  return out;
}

/** Cross-platform elevation: Android uses `elevation`, iOS and web a shadow. */
function elevate(dp: number, mode: Mode): ViewStyle {
  if (dp <= 0) return {};
  if (Platform.OS === 'android') return { elevation: dp };
  return {
    shadowColor: '#000000',
    shadowOpacity: mode === 'dark' ? 0.5 : 0.18,
    shadowRadius: dp * 1.2,
    shadowOffset: { width: 0, height: Math.round(dp / 2) },
  };
}

const s = tokens.space;
export const space = {
  0: s[0], 1: s[1], 2: s[2], 3: s[3], 4: s[4], 5: s[5], 6: s[6], 7: s[7], 8: s[8], 9: s[9],
} as const;

export function makeTheme(mode: Mode) {
  const e = tokens.elevation;
  return {
    mode,
    color: uiColors(mode),
    note: tokens.color.note[mode] as Record<NoteColor, string>,
    type: typeScale(),
    noteSize: tokens['note-size'] as Record<NoteSize, { size: number; line: number }>,
    space,
    radius: tokens.radius,
    elevation: {
      card: elevate(e.card, mode),
      fab: elevate(e.fab, mode),
      sheet: elevate(e.sheet, mode),
      snackbar: elevate(e.snackbar, mode),
    },
    motion: { fast: tokens.motion.fast, base: tokens.motion.base, slow: tokens.motion.slow },
    layout: tokens.layout,
  };
}

export type Theme = ReturnType<typeof makeTheme>;

export const lightTheme = makeTheme('light');
export const darkTheme = makeTheme('dark');

export const ModeContext = createContext<ModeSetting>('system');

/** The theme for the current mode: the user's setting, or the OS when "system". */
export function useTheme(): Theme {
  const setting = useContext(ModeContext);
  const os = useColorScheme();
  const mode: Mode = setting === 'system' ? (os === 'dark' ? 'dark' : 'light') : setting;
  return mode === 'dark' ? darkTheme : lightTheme;
}

/** Columns for the home grid at a given window width (layout.columns / breakpoints). */
export function gridColumns(width: number): number {
  const { breakpoints, columns } = tokens.layout;
  if (width >= breakpoints.expanded) return columns.expanded;
  if (width >= breakpoints.medium) return columns.medium;
  return columns.compact;
}

/** `#rrggbb` + alpha (0-1) -> `#rrggbbaa`, for scrims and overlays. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}
