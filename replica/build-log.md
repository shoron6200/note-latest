# Build log: Pocketleaf

One line per screen: ID, date, status, what is missing, what was harder than
expected. Checked in the web build: an Expo web export running on real SQLite
(WebAssembly), driven by a headless browser at 390×844 and 1440×900.
Screenshots are in `replica/clone-screens/`.

| ID | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-10-18 | done | — | expo-sqlite on web needs WebAssembly plus cross-origin isolation headers (`metro.config.js`), and has no FTS5, so search falls back to LIKE there |
| data | 2026-10-18 | done | — | 34 tests on real SQLite (node:sqlite). They caught a DST-gap bug (02:30 on the spring-forward night moved back an hour) and a repeating reminder that kept its old OS entry |
| S01 Home | 2026-10-18 | done | — | the chip row was offset at desktop width; the folder filter falls back to All if that folder is deleted elsewhere |
| S02 New (FAB) | 2026-10-18 | done | — | — |
| S03 Note editor | 2026-10-18 | done | formatting toolbar sits in the top bar, not above the keyboard | autosave has to flush on blur, background, back and close; only a *brand-new* note left empty is discarded |
| S04 Checklist editor | 2026-10-18 | done | — | drag to reorder written with PanResponder (no extra native library). The React Compiler lint rules forced the gesture into a small class. It works with touch and with a mouse |
| S05 Colour | 2026-10-18 | done | — | — |
| S06 Font and size | 2026-10-18 | done | — | — |
| S07 Reminder | 2026-10-18 | partial | **not verified on a phone**: notification delivery, the permission prompts, the exact-alarm setting | the web preview gets date/time steppers, phones get the native pickers; quick picks are relative to now |
| S08 Folders | 2026-10-18 | done | reordering folders | wa-sqlite reports a UNIQUE violation as "Error finalizing statement", so duplicate names are now checked before writing, on every platform |
| S09 Search | 2026-10-18 | done | highlighting the match (could) | the screens underneath stay in the DOM on web, so tests have to target visible elements |
| S10 Note actions | 2026-10-18 | done | — | — |
| S11 Trash | 2026-10-18 | done | — | — |
| S12 Settings | 2026-10-18 | done | — | — |
| S13 Backup | 2026-10-18 | done on web, partial on phones | the share sheet and the daily snapshots are not verified on a phone | restore merges by id (newer wins, nothing deleted); restoring the same backup twice changes nothing (checked) |
| S14 Notification | 2026-10-18 | partial | **needs a phone** | tap → `/note/[id]`, including the tap that launches the app (`getLastNotificationResponse`) |

## Flows checked in the web build (all pass, three runs in a row, no console errors)

- **F01:** write a note; it survives a reload; an empty new note is discarded.
- **F02:** make a list; Enter adds an item; tick moves it to Done; the card
  shows "1 of 2 done".
- **F03:** colour and font change.
- **F04:** create a folder; a duplicate name (any case) is blocked; move a
  note into it; filter by it.
- **F05:** search ignores accents ("cafe" finds "café"), finds list items, and
  shows a "nothing found" state.
- **F06:** set a reminder from a quick pick; the chip shows on the card.
- **F07:** share is offered.
- **F08:** trash, undo, trash again, restore from the trash screen.
- **F09:** back up (download) and restore the same file ("Already up to
  date").
- **Drag:** drag "Oat milk" down two places; the order persists.
- **Keyboard:** Tab reaches the New button and Enter opens it; Escape closes
  sheets.

## Deviations from the plan

- **Exact alarms.** `delivery: 'alarmClock'` is used, so reminders are exact
  when Android allows it. Android 14+ asks you to allow exact alarms, and S07
  shows a banner with the setting.
- **The design route** `/design` is still in the app, as a development page.
  Hide it before giving the app to anyone else.
- **Checklist drag** uses PanResponder instead of the
  `react-native-draggable-flatlist` the architecture planned. That means no
  extra native dependency.

## Before calling it done on your phone

1. Build a development APK (`eas build --profile development`, or
   `npx expo run:android`) and install it.
2. Set a reminder 2 minutes out. Let it fire with the app open, then closed,
   then after a reboot. Tap it, and check the note opens.
3. Back up, uninstall, reinstall, restore.

`/replica-test` will turn these into a checklist with results.

## 2026-10-26: Keep-style UI and labels

Behaviour taken from a resource-level study of Google Keep 5.26 (see
`keep-ui-labels-findings.md`). Nothing from Keep's code or assets is used.

| Area | Status |
| --- | --- |
| Home: rounded search bar + menu button, Pinned / Others, speed-dial + | done |
| Drawer: Notes, Reminders, Labels (Edit, Create new label), Folders, Archive, Trash, Settings | done |
| Labels: many per note, Edit labels screen (create / rename / delete), picker with search + "Create", part-ticked boxes for multi-select, `#name` in a note | done |
| Long-press multi-select bar: pin, colour, labels, archive, move, copy, delete | done |
| Editor: pin / reminder / archive on top; + / colour / font / "Edited …" / ⋮ at the bottom | done |
| Archive (comes with Keep's drawer and selection bar) | done |
| Backup format v3 carries labels and archive; v2 backups still import | done |

Checks: 68 unit tests, 76 browser tests (new `f11-labels.spec.ts`; older specs
updated for the drawer/search-bar layout), lint and typecheck clean. Axe found
two list roles with button children (editor label chips, search colours); fixed.
Not checked on a real phone yet.

## 2026-10-26: Share into Pocketleaf, voice notes, text in photos

| Area | Status |
| --- | --- |
| **Share → Pocketleaf** (Android): text, links, photos, videos, recordings; several photos or videos at once. A Save screen with title, text and labels; Save, or Save and open | done on web (test hook); **not checked on a phone** |
| **Voice notes**: + → Record voice note, or + Voice on the home screen. The words go into the note (a new paragraph or list item); the recording is kept under it with a player. Card shows a mic chip; search has a "Voice notes" filter | done on web (sound only); **text needs a phone** |
| Voice privacy: text is made on the phone when an offline speech pack for your language is installed (Android 13+). Otherwise the sound is kept without text, with a button to download the pack, unless Settings → Voice notes → Online speech-to-text is on | done |
| **Text in photos**: each photo is read once on the phone (ML Kit), in the background; the words are searchable. The photo viewer has "Text in photo": copy it, or add it to the note | data + viewer done; **reading needs a phone** |
| Schema v5 (audio kind, photo text, `voice_online` setting) and backup format v4; older backups still import and their photos are read again | done |

Libraries: expo-share-intent 9 (iOS share extension switched off: Android only), expo-speech-recognition 58, expo-audio 58, expo-text-extractor 2 (Latin script only), expo-clipboard 58.

Fixed along the way: the editor now shows body changes made elsewhere (text added from a photo, a restore) when you have no unsaved typing; the "Loading notes" placeholder now has a role (axe).

Checks: 80 unit tests, 83 browser tests (new `f12-capture.spec.ts`, with a fake microphone), lint, typecheck, Replica sweep, and an Android prebuild whose manifest carries the share filters, RECORD_AUDIO and the speech-service queries.

### Check on the phone
1. Share a link from Chrome, a photo from Gallery, and three photos at once.
2. Record a voice note with Wi-Fi off. With a speech pack for your language: words appear. Without: "Download offline speech pack" works.
3. Photograph a receipt; after a few seconds search a word on it; open the photo → Text in photo.
