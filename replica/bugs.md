# Bugs: Pocketleaf

Found by the test pass on 2026-10-18, with the specs in `e2e/` running in the
web build (Chromium from Playwright 1.56, Pixel 7 profile at 412 px and desktop at 1440 px).
Each bug has a spec that failed before its fix and passes after. They are
all fixed in **956c47f**.

The build pass found and fixed 6 other bugs before this one: a DST-gap time,
a stale repeating notification, duplicate folder names on web, the reminder
wording, the chip offset and the folder-row alignment. They are listed in
`replica/build-log.md`.

| | open | fixed |
| --- | --- | --- |
| S1 | 0 | 1 |
| S2 | 0 | 0 |
| S3 | 0 | 7 |
| S4 | 0 | 0 |

---

### BUG-001: The last half-second of typing is lost if the page reloads

- **Severity:** S1 (data loss)
- **Flow / case:** F01 / F01-E5
- **Screen:** S03
- **Build:** 29afe2f
- **Browser / device:** Chromium, Pixel 7 profile

Steps
1. Make a note; type a title; wait a second.
2. Type a body, and reload the page right away.

Expected: the body is saved.
Actual: the body was gone. The autosave waited 500 ms after the last
keystroke, so anything typed in that window was never written.
Evidence: `F01-E5 refresh inside the autosave delay still saves` failed.
Suspected cause: debounced autosave. On a phone the flush on backgrounding
covers swiping the app away, but a crash would have lost the same 500 ms.
Status: **fixed in 956c47f**. The editor now saves as you type, with one
write in flight and the newest text always following it. Checklist items
work the same way.

### BUG-002: A second tab shows a raw browser error

- **Severity:** S3 (web preview only; phones run one copy of the app)
- **Flow / case:** F01 / F01-E7
- **Screen:** startup

Steps
1. Open the app in one tab.
2. Open it again in a second tab.

Expected: a plain explanation.
Actual: "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle'…"
Evidence: `F01-E7` failed; `e2e/web` tab check.
Suspected cause: the web SQLite build holds an exclusive lock on its file.
Status: **fixed in 956c47f**. The second tab now says "Pocketleaf is open in
another tab" and explains what to do.

### BUG-003: Toggle buttons announce "selected" instead of "pressed"

- **Severity:** S3 (accessibility; axe *critical*: aria-allowed-attr)
- **Flow / case:** every screen
- **Screen:** S03, S04, S01

Steps
1. Open a note.
2. Focus "Pin" with a screen reader.

Expected: "Pin, toggle button, not pressed".
Actual: `aria-selected`, which is not allowed on a button, so the state was
not announced.
Status: **fixed in 956c47f**. Pin and the reminder bell now use `aria-pressed`.

### BUG-004: The folder tab list contains a button that is not a tab

- **Severity:** S3 (accessibility; axe *critical*: aria-required-children)
- **Screen:** S01

Steps
1. Open home.
2. Move through the folder chips with a screen reader.

Expected: a list of tabs, then a separate "New folder" button.
Actual: "New folder" sat inside the tab list, so it was announced as a
broken tab.
Status: **fixed in 956c47f**.

### BUG-005: The drag handle does not say where the item is

- **Severity:** S3 (accessibility; axe *critical*: aria-required-attr)
- **Flow / case:** F02 / F02-E6
- **Screen:** S04

Steps
1. Open a list.
2. Focus an item's move handle with a screen reader.

Expected: "Move Oat milk, 1 of 6", adjustable.
Actual: an adjustable control with no value.
Status: **fixed in 956c47f**. It announces "n of N" and works with swipe
up/down on phones.

### BUG-006: Settings switch rows contain two switches

- **Severity:** S3 (accessibility; axe *serious*: nested-interactive)
- **Screen:** S12

Steps
1. Open Settings.
2. Tab to "Show notes as a grid".

Expected: one switch.
Actual: the row was a switch with a native switch inside it, so it was
announced twice and took two tab stops.
Status: **fixed in 956c47f**. The row is the switch, and the track is drawn.

### BUG-007: Sheets and dialogs have no name

- **Severity:** S3 (accessibility; axe *serious*: aria-dialog-name)
- **Screen:** S05, S06, S07, S08, S10, dialogs

Steps
1. Open the colour sheet with a screen reader on.

Expected: "Colour, dialog".
Actual: "dialog".
Status: **fixed in 956c47f**.

### BUG-008: Card and chip names don't contain their visible text

- **Severity:** S3 (accessibility; axe *serious*: label-content-name-mismatch,
  WCAG 2.5.3)
- **Screen:** S01, S09, S11

Steps
1. With voice control, say "tap Groceries 7". Or say the folder chip as
   shown, "All 7".

Expected: it activates.
Actual: the names were "All, 7 notes" and "Groceries, checklist, 2 of 8
done", which don't contain the text on screen, so voice control could miss
them.
Status: **fixed in 956c47f**.

- Cards are now named by their own text.
- The checklist and pinned summary is a screen-reader hint on phones.
- Chips read "All 7 notes".

---

## To check (not reproduced yet: needs a phone)

- **F06-P1/P3:** a reminder fires when the app is closed, and after a reboot.
- **F06-P5:** on Android 14, with exact alarms off, how late reminders arrive
  (`delivery: 'alarmClock'` should fall back to best effort).
- **F01-E9:** swipe the app away mid-typing. With BUG-001's fix, at most the
  in-flight write can be lost.
- **P9:** TalkBack/VoiceOver: hints on cards, the swipe actions on the drag
  handle.
- **P10:** the largest OS font size on the editor toolbar. Five icons plus Back
  at 48 px fit in 336 px, but text scaling could crowd the top bar.
