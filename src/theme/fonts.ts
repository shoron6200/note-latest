/**
 * Note fonts. All open-licensed (SIL OFL 1.1), bundled through @expo-google-fonts.
 * The interface itself uses the system font, so only notes pay for these.
 */
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { SourceSerif4_400Regular, SourceSerif4_700Bold } from '@expo-google-fonts/source-serif-4';
import { useFonts } from 'expo-font';
import type { TextStyle } from 'react-native';

import type { NoteFont } from './theme';

export function useNoteFonts(): boolean {
  const [loaded] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
    PatrickHand_400Regular,
  });
  return loaded;
}

/**
 * Font style for a note font. Custom fonts carry their weight in the family
 * name, so bold maps to a different family instead of fontWeight.
 */
export function noteFontStyle(font: NoteFont, bold = false): TextStyle {
  switch (font) {
    case 'serif':
      return { fontFamily: bold ? 'SourceSerif4_700Bold' : 'SourceSerif4_400Regular' };
    case 'mono':
      return { fontFamily: bold ? 'JetBrainsMono_700Bold' : 'JetBrainsMono_400Regular' };
    case 'hand':
      // One weight only; bold is skipped rather than faked.
      return { fontFamily: 'PatrickHand_400Regular' };
    default:
      return bold ? { fontWeight: '700' } : {};
  }
}

export const NOTE_FONT_LABELS: Record<NoteFont, string> = {
  default: 'Standard',
  serif: 'Serif',
  mono: 'Monospace',
  hand: 'Handwriting',
};
