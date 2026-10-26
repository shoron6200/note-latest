# Test plan: Pocketleaf

Flows come from `replica/recon.md` (F01–F09). Each case is marked:

- **[auto]**: a Playwright spec in `e2e/`, run against the web build.
- **[unit]**: a data-layer test in `src/data/__tests__/`.
- **[phone]**: needs a real phone, in the manual checklist at the end.

How to run:

```bash
npx expo export --platform web
npx playwright test                  # specs + axe scan on every screen
npm test                             # data layer, on real SQLite
```

**Not applicable to this app, and why:**

- Second user's data, expired session, wrong password: no accounts. One
  person, one phone.
- Card declined and the payment flows: no payments.
- Slow network or offline: the app never uses the network. Every test is
  effectively offline. Nothing loads from a server after install.

## Results, 2026-10-18

- **61 of 61 specs pass** across the phone and desktop projects, on three runs
  in a row. That includes an axe scan of all 13 web-testable screens, with no
  serious or critical issues.
- **34 of 34** data-layer tests pass.
- The first run failed 23. Of those, 8 were real bugs (see `bugs.md`, all
  fixed). The rest were mistakes in the tests themselves (a 59-character
  "60-character" name, an inexact locator, waits) and are corrected in the
  specs.
- **Phone checklist:** 0 of 10 run. That needs your device.

## F01 Write a quick text note

| ID | case | expect | how |
| --- | --- | --- | --- |
| F01-H1 | New → Note, type a title and body, back | card on home; still there after a reload | auto |
| F01-E1 | New → Note, type nothing, back | no "Empty note" card | auto |
| F01-E2 | very long title (300+ chars) and a 10,000-char body | title capped at 300; card preview capped; no layout break | auto |
| F01-E3 | emoji and accents in the title and body ("Café ☕ 🎉") | saved exactly; findable by "cafe" | auto |
| F01-E4 | type, then press back within the 500 ms debounce | text saved (flushed on leave) | auto |
| F01-E5 | type, then refresh within the debounce | text saved | auto |
| F01-E6 | double-click "Note" in the New menu | exactly one note is created | auto |
| F01-E7 | two tabs open at once (web only) | the second tab works or explains itself | auto |
| F01-E8 | keyboard only: Tab to New, Enter, Note, type, Escape | note saved | auto |
| F01-E9 | the app is killed mid-typing | at most the last half-second is lost | phone |

## F02 Make a list and tick it off

| ID | case | expect | how |
| --- | --- | --- | --- |
| F02-H1 | New → List, add two items, tick one | Done (1); card shows "1 of 2 done" | auto |
| F02-E1 | Enter in an item adds a new one below it and focuses it | new row, focused | auto |
| F02-E2 | Backspace in an empty item | row removed | auto |
| F02-E3 | paste text with newlines into an item | one line of text, no broken row | auto |
| F02-E4 | untick an item in Done | returns to the open list | auto |
| F02-E5 | blank rows | not counted on the card | unit |
| F02-E6 | drag an item down two places | order kept after reopening | auto |
| F02-E7 | convert a list to a note and back | lines kept | unit |

## F03 Colour and style a note

| ID | case | expect | how |
| --- | --- | --- | --- |
| F03-H1 | pick yellow, then Serif | editor and card use them after a reload | auto |
| F03-E1 | dark mode | the note colour switches to its dark version; text passes AA | auto (+ contrast.py) |

## F04 Organise notes into folders

| ID | case | expect | how |
| --- | --- | --- | --- |
| F04-H1 | create a folder, move a note into it, filter | only that note shows | auto |
| F04-N1 | a name that already exists, in another case | "There's already a folder…" | auto |
| F04-N2 | empty name | "Give the folder a name." | auto |
| F04-E1 | a 60-character name | saved in full, wraps in the list | auto |
| F04-E2 | delete a folder that holds notes | notes stay in All | auto |
| F04-E3 | rename a folder | the chip shows the new name | auto |

## F05 Find a note

| ID | case | expect | how |
| --- | --- | --- | --- |
| F05-H1 | search a word from a body | the note found | auto |
| F05-E1 | "cafe" finds "Café" | found | auto + unit |
| F05-E2 | a word that is only in a checklist item | the list found | auto |
| F05-E3 | `"`, `(`, `AND`, `*` | no crash, sensible result | auto + unit |
| F05-E4 | a note in the trash | not found | auto |
| F05-N1 | nothing matches | "Nothing found" | auto |

## F06 Get reminded

| ID | case | expect | how |
| --- | --- | --- | --- |
| F06-H1 | Remind me → Tomorrow morning → Set | chip on the editor and the card; snackbar | auto |
| F06-N1 | a time in the past | "That time has already gone by."; Set disabled | auto |
| F06-E1 | remove a reminder | chip gone | auto |
| F06-E2 | daily 09:00 across the DST change | stays at 09:00 local | unit |
| F06-E3 | trash a note with a reminder | OS notification cancelled; restore reschedules it | unit |
| F06-P1 | notification arrives on time, app open and closed | banner + sound | phone |
| F06-P2 | tap the notification | the note opens | phone |
| F06-P3 | reboot, then wait for the time | still fires | phone |
| F06-P4 | notifications denied | banner with "Open settings" | phone |
| F06-P5 | Android 14: exact alarms off | banner with "Allow exact reminders" | phone |

## F07 Share a note

| ID | case | expect | how |
| --- | --- | --- | --- |
| F07-H1 | More → Share | share action offered | auto |
| F07-E1 | list text format | "☐ item / ☑ item" | unit |
| F07-P1 | share to another app | text arrives intact | phone |

## F08 Delete and recover

| ID | case | expect | how |
| --- | --- | --- | --- |
| F08-H1 | move to trash → Undo | note back | auto |
| F08-E1 | restore from the trash screen | back on home | auto |
| F08-E2 | open a note that is in the trash | read-only with a Restore button | auto |
| F08-E3 | delete for good | gone from the trash | auto |
| F08-E4 | empty the trash | "The trash is empty" | auto |
| F08-E5 | 30 days in the trash | deleted automatically | unit |

## F09 Back up and restore

| ID | case | expect | how |
| --- | --- | --- | --- |
| F09-H1 | Back up now → restore the same file | "Already up to date." | auto |
| F09-E1 | restore into an install that has other notes | both sets present, nothing deleted | auto |
| F09-N1 | pick a file that is not a backup | "That file isn't a Pocketleaf backup." | auto |
| F09-E2 | a newer edit on the phone beats an older backup | phone version kept | unit |
| F09-P1 | Back up now → save to Drive/Files via the share sheet | file saved | phone |
| F09-P2 | uninstall, reinstall, restore | everything back | phone |

## Settings (S12)

| ID | case | expect | how |
| --- | --- | --- | --- |
| S12-H1 | theme Dark | applies everywhere and survives a reload | auto |
| S12-H2 | sort by title, list view | home follows both | auto |

## Every screen

- An axe accessibility scan with no serious or critical violations [auto].
- No console errors [auto].
- Works at 390 and 1440 wide [auto, in `e2e/web/screens.py`].

## Phone checklist (manual)

| ID | step | result |
| --- | --- | --- |
| P1 | Install a development build (`npx expo run:android`, or `eas build --profile development`) | to run |
| P2 | F06-P1: reminder 2 min out, app open; then app closed | to run |
| P3 | F06-P2: tap it, note opens | to run |
| P4 | F06-P3: set for 10 min out, reboot, wait | to run |
| P5 | F06-P4/P5: deny notifications; Android 14 exact alarms | to run |
| P6 | F01-E9: type, swipe the app away at once, reopen | to run |
| P7 | F07-P1: share a list to a chat app | to run |
| P8 | F09-P1/P2: back up to Drive, uninstall, reinstall, restore | to run |
| P9 | Screen reader (TalkBack / VoiceOver): make a list, tick an item, move an item with the swipe actions | to run |
| P10 | Large text (OS font size max): home, editor and sheets still readable | to run |


## F10 Photos and videos, F11 Telegram backup (added 2026-10-20)

Automated:

- `e2e/f10-attachments.spec.ts`: add two photos, reload, card cover and
  "+1"; viewer previous/next and remove; a note with only a photo is kept;
  Telegram screen says phone-only on web. `a11y.spec.ts` adds the attach
  sheet (S14), the viewer (S15) and the Telegram screen (S16).
- `src/data/__tests__/telegram.test.ts` (fake Telegram with the real 50 MB
  upload and 20 MB download limits): a 45 MB video goes up in 3 parts and
  comes back byte for byte on a fresh phone; files are sent once and reused;
  429 "slow down" is retried; a damaged part fails its hash and is not kept;
  missing files and "no pinned backup" are reported, not fatal; connect finds
  the chat or asks for /start; shared files are swept only when unused.

Phone only (P11–P14 in deploy.md): camera and gallery, the real bot, a real
video over 20 MB, restore after reinstall.
