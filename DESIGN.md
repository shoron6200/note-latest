# Pocketleaf design system: "The Margin"

Pocketleaf is a leaf of paper in your pocket. The interface borrows from the
pocket notebook: ledger-tinted paper, rounded page corners, and the **margin
rule**, the vertical line at the left of every page where status marks live.
The margin is the one memorable element; everything else stays quiet.

Values live in `replica/design/tokens.json` (the single source of truth, read
by `src/theme/theme.ts`). Check contrast after any palette change:

```bash
npm run contrast
```

## Colour

| Role | Token | Light | Dark |
|---|---|---|---|
| Ledger (page) | `bg` | `#eff2ec` | `#161917` |
| Leaf paper (cards, sheets) | `surface-raised` | `#fafbf8` | `#1f2320` |
| Recessed (search, segmented, skeleton) | `surface` | `#e4e9e1` | `#262b27` |
| Ink (text, icons) | `text` | `#1d231f` | `#e4e9e3` |
| Pencil (secondary) | `text-muted` | `#5b645d` | `#a4ada5` |
| Rule (separators) | `border` | `#d5dcd3` | `#2e342f` |
| Leaf (the one accent) | `accent` | `#2f6b45` | `#8fd3a8` |

- Leaf green appears only on the primary action (Write), the current
  selection, focus rings and ticked boxes.
- Note colours are stored by name (`notes.color`). Each name has a **rule**
  (`color.note-rule`, the margin line, at least 3:1 on paper) and a **wash**
  (`color.note`, the faint page tint, with every text colour at least 4.5:1).

## Type

Your words in serif, the app's words in sans.

| Variant | Size/line | Face | Use |
|---|---|---|---|
| `page` | 28/36 | Source Serif 4 SemiBold | editor title, empty-state title |
| `screen` | 22/28 | serif | wordmark, folder/label names as titles |
| `entry` | 19/24 | serif | note titles in the list and grid |
| `xl` | 22/28 600 | system sans | screen titles ("Settings") |
| `lg` | 17/24 600 | sans | sheet and dialog titles |
| `base` | 16/24 | sans | inputs, rows, menus |
| `body` | 15/22 | sans | previews, dialog body |
| `sm` | 13/18 | sans | metadata, group titles |
| `xs` | 12/16 500 | sans | counts |

- A note with its own font (Serif, Monospace, Handwriting) uses it for its
  title and body; the app's own text never does.
- No all-caps labels. Group titles are `sm` 600 in pencil, sentence case.
- Text scales with the OS setting up to 2×.

## Space, shape, depth

- 4pt grid: 4, 8, 12, 16, 24, 32, 48.
- Margin column 32 on phones, 40 from 600px wide. Rule width 2 (4 when selected).
- Radius by object: checkbox 3, buttons and fields 6, leaves 10, dialogs 12,
  sheets 16 (top corners only), the switch a full pill.
- Leaves are flat with a hairline edge. Only sheets, dialogs, the snackbar and
  the Write button cast a shadow.

## Components

- **Note entry (list, the default view).** Entries sit on one leaf, ruled
  between. Margin glyphs (pin, bell) sit beside the line they describe.
  Then the title in `entry` serif, a two-line preview, and one footer of
  plain metadata: reminder time (danger when overdue), "2 of 8 done",
  folder, `#labels`.
- **Note leaf (grid).** The same content on its own leaf, with the rule
  inset from the leading edge. Cards go into the shortest column.
- **Write button.** A split button: "Write" starts a text note; the chevron
  (or a long-press) opens List, Image, Voice. It folds to the pen while
  scrolling down.
- **Icon buttons.** 22px Lucide at 1.75 stroke in a 48pt target. State is shown
  by fill (a filled pin is pinned), never by a tinted circle.
- **Buttons.** Primary (leaf fill), secondary (ink outline), text (quiet),
  danger. Labels are verbs.
- **Editor.** The note's wash, a full-height margin rule in its colour, the
  serif title, a metadata line ("Edited …" and the reminder), and a toolbar
  with labelled tools (Add, Colour, Font).
- **Empty states.** Faint ruled lines and the margin rule, a serif title and
  one plain line of direction. No illustrations.

## Interaction and motion

- Press and hover: an ink wash at 6%; a native ripple on Android.
- Focus: 2px leaf ring, 2px offset.
- 160ms for state changes, 220ms for sheets and the drawer. Reduce Motion
  turns slides into fades (`src/ui/motion.ts`).
- One signature moment: on a new note, the margin rule draws down the page
  (240ms).
