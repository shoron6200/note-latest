/** Plain constants shared by the theme and the data layer (no React Native imports). */
export const NOTE_COLORS = [
  'default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray',
] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_FONTS = ['default', 'serif', 'mono', 'hand'] as const;
export type NoteFont = (typeof NOTE_FONTS)[number];

export const NOTE_SIZES = ['s', 'm', 'l', 'xl'] as const;
export type NoteSize = (typeof NOTE_SIZES)[number];
