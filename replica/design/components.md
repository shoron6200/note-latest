# Components

The component specs for the notes app. They come from the component list in
`replica/recon.md`. Values are token names from `tokens.json`, never raw
numbers or hex. Platform: React Native (Expo).

The original's look was not measured: there were no screenshots of it. This
is a fresh design that follows the category's conventions. That suits a
rebuild that gets its own brand anyway. Once the original's screenshots land
in `replica/screens/`, the **layout** gets checked against them (by
replica-diff). The colours never are.

Rules for every component:

- **Touch targets** are at least `layout.touch-target-min` (48). If something
  looks smaller, it gets `hitSlop`.
- **Every pressable** has an `accessibilityRole` and a label. Icon-only
  buttons carry a label in your own words, for example "Set reminder".
- **Focus** (keyboard or switch control) shows a 2px `focus` ring with radius
  matching the component. RN-web and Android TV use the same style.
- **Dynamic type.** Text scales with the OS font size up to 1.5×
  (`maxFontSizeMultiplier={1.5}`). Layouts wrap; they never clip.
- **Motion** uses the `motion.*` tokens. With Reduce Motion on, every
  animation becomes a 120 ms fade.
- **Icons** come from Lucide (`lucide-react-native`, ISC licence) at 24px
  with a 2px stroke, in `text` or `text-muted`. Nothing is traced from the
  original.

---

```
TopBar
  variants  home (title + search, view toggle, menu), editor (back + action icons),
            sheet-less title (search, folders, trash, settings)
  size      height layout.top-bar-height 56, gutter layout.gutter
  states    default, scrolled (1px border bottom), selection mode (count + bulk actions)
  tokens    bg bg, title type.xl text, icons text
  a11y      title is a header (accessibilityRole="header"); back is "Back"
  used on   S01, S03, S04, S08, S09, S11, S12, S13
```

```
IconButton
  variants  standard, filled (accent bg), danger (danger icon)
  size      48 target, 24 icon
  states    default, pressed (surface overlay), disabled (40% opacity), active (toggled, e.g. pinned)
  tokens    icon text / text-muted, pressed bg surface, radius pill
  a11y      role button, label required, active state in accessibilityState.selected
  used on   all top bars, editor toolbar
```

```
Button
  variants  primary, secondary (border), text, danger
  sizes     md 48 (default), sm 40 (inside dialogs only, still a 48 hit area)
  states    default, pressed, focus-visible, disabled, loading (spinner + label kept)
  tokens    primary: bg accent, text on-accent; secondary: border border-input, text text;
            text: text accent; danger: text danger (text variant) or bg danger + white text
            radius pill, type base/600
  a11y      role button, busy state while loading, the label never changes to "Loading"
  used on   S07, S08, S12, S13, dialogs, empty states
```

```
Fab
  variants  single (+), speed-dial (open: "Text note", "Checklist" with labels)
  size      layout.fab-size 56, offset layout.fab-offset from bottom and end, above the safe area
  states    default, pressed, expanded (scrim at 32% scrim, + rotates to ×), hidden on scroll down
  tokens    bg accent, icon on-accent, elevation fab, radius lg
  a11y      label "New note"; expanded options are buttons with text; back/escape closes
  used on   S01 (opens S02)
```

```
NoteCard
  variants  text (title + body preview), checklist (title + first 5 items with boxes, "+3 more"),
            pinned (pin icon), with reminder (bell + time chip), with folder (folder chip)
  layout    masonry grid (layout.columns by width) or single-column list; padding space 4 (16)
            title max 2 lines, preview max layout.card-preview-lines
  states    default, pressed, selected (2px focus ring + check badge), empty title (shows body only),
            no content ("Empty note" in text-muted)
  tokens    bg note.<color> for the current theme, title type.lg text, body type.sm text-muted,
            checked items text-muted + line-through, radius md, border border only for "default" colour
  a11y      one pressable; label = title + first line + "checklist, 3 of 5 done" + reminder time;
            long-press has an accessible alternative (the "Select" action in the menu)
  used on   S01, S09, S11
```

```
FolderChip
  variants  all, folder, trash (in drawer only)
  states    default, selected (bg accent, text on-accent), pressed
  tokens    bg surface, text text, type sm/500, radius pill, height 36 (48 hit area)
  a11y      role tab inside a tablist; selected in accessibilityState
  used on   S01 (horizontal scroller), S08
```

```
TextField
  variants  title (type.xl, no border), body (multiline, note-size token, no border),
            search (pill, leading icon, clear button), dialog (border border-input, label above)
  states    empty (placeholder text-muted), focused (dialog: 2px focus border), filled,
            error (dialog: danger border + message below), disabled
  tokens    text text, placeholder text-muted, caret accent, radius md (dialog), pill (search)
  a11y      label always set (visible or accessibilityLabel); errors are announced
  used on   S03, S04, S08, S09, dialogs
```

```
ChecklistRow
  variants  unchecked, checked
  layout    drag handle | checkbox | text (multiline) | remove ×
  states    default, editing (focused), dragging (elevation sheet, scale 1.02), checked (moves to
            the "Done" group below, text-muted + line-through), new row (empty, autofocus)
  tokens    checkbox border border-input, checked fill accent with on-accent tick, text note-size
  a11y      checkbox has role checkbox + checked state + the item text as its label;
            drag handle has "Move up / Move down" accessibility actions instead of drag
  used on   S04
```

```
BottomSheet
  variants  colour picker (S05), font picker (S06), new item (S02), note actions (S10),
            folder picker (S08), reminder (S07)
  layout    max width layout.sheet-max-width, centred on tablets; grab handle; title type.lg
  states    opening, open, closing, keyboard open (content lifts above it)
  tokens    bg surface-raised, scrim at 40% scrim, radius lg on top corners, elevation sheet
  a11y      focus moves into the sheet and returns to the opener on close; back/escape closes;
            the scrim is a "Close" button
  used on   S02, S05, S06, S07, S08, S10
```

```
ColourSwatch
  variants  one per note colour (default, red, orange, yellow, green, teal, blue, purple, pink, gray)
  size      40 circle, 48 hit area, 12 gap, scrolls sideways if it does not fit
  states    default, selected (2px focus ring + check icon, so the choice never relies on colour alone),
            pressed
  tokens    fill note.<color> for the current theme, border border
  a11y      role radio in a radiogroup; label is the colour name ("Yellow"), selected state set
  used on   S05
```

```
FontOption
  variants  default, serif, mono, hand; size steps s, m, l, xl
  layout    each font row shows "Aa  The quick note" in that font; sizes are a 4-step segmented control
  states    default, selected (check icon + bold), pressed
  tokens    row text in its own font at note-size m, selected icon accent
  a11y      radio groups; labels "Serif font", "Large text"
  used on   S06
```

```
DateTimeField (reminder)
  variants  date, time, repeat (none, daily, weekly, monthly as a segmented control)
  states    empty, set, in the past (danger helper "That time has passed"), saving,
            notifications blocked (warning banner + "Open settings" button),
            exact alarms off on Android 12+ (warning banner: reminders may be late)
  tokens    field bg surface, text text, helper type.xs
  a11y      opens the native picker; value announced as a full sentence ("Monday 20 October, 9:00")
  used on   S07
```

```
Dialog
  variants  confirm (title, one line, cancel + primary/danger), input (title, TextField, cancel + save)
  states    open, saving, error (inline in the field)
  tokens    bg surface-raised, radius lg, title type.lg, body type.base text-muted, elevation sheet
  a11y      role alert for confirm; initial focus on the safe action (cancel) for destructive dialogs
  used on   S08 (new / rename / delete folder), S10 (delete), S11 (empty trash), S13 (restore)
```

```
Snackbar
  variants  info, undo (with action)
  states    shown (5 s; stays while a screen reader is on), hidden
  tokens    bg snackbar-bg, text snackbar-text, action snackbar-action type sm/700, radius md,
            elevation snackbar, sits above the FAB
  a11y      announced with a live region (polite); the action is a button
  used on   S01, S03, S04 (after delete, restore, backup)
```

```
EmptyState
  variants  no notes, no results, empty trash, no folders, no reminders permission
  layout    Lucide icon at 48 in text-muted, headline type.display (type.lg on small screens),
            one line type.base text-muted, an optional Button
  tokens    as above, centred, max width 320
  a11y      headline is a header
  used on   S01, S08, S09, S11
  copy      written fresh in /replica-build and replaced again in /replica-brand's voice pass
```

```
SettingsRow
  variants  toggle, choice (opens a sheet or radio list), action (chevron), info (value on the right)
  states    default, pressed, disabled
  tokens    title type.base text, subtitle type.sm text-muted, divider border
  a11y      a toggle is role switch with checked state; a choice row announces its current value
  used on   S12, S13
```

```
ReminderChip / FolderTag (inside cards and editor)
  variants  reminder (bell + "Tomorrow 9:00"), overdue (danger text), repeat (adds a ↻ icon), folder
  tokens    bg surface at 60% over the note colour, type xs, radius pill
  a11y      part of the parent card's label; in the editor the reminder chip is a button opening S07
  used on   S01, S03, S04, S09
```

---

**Screen-level layout**

- **Home grid:**
  - 2 columns below 600dp wide, 3 up to 900dp, 4 above that
  - `grid-gap` 12, `gutter` 16
  - masonry: cards keep their natural height
- **Editor:**
  - content at most `editor-max-width` (720) wide, centred on tablets
  - the toolbar sits just above the keyboard while it is open
- **Safe areas:** respected on every screen, so nothing hides under the notch
  or the gesture bar.
