# Recon map: App Notes - Notebook, Notepad (Android)

Original: `com.note.todolist.noteapp` by "Security Lab" (Hai Duong, Vietnam).
The Play listing gives the tagline as "Jot down notes and create to-do lists".
Category: Productivity. 500K+ installs, 3.8 stars from about 1.3-1.4K reviews.
It shows ads, offers in-app purchases and has an Everyone rating. Last updated
2024-03-25, with no recent changelog.

Scope: the core note and to-do loop. That covers text notes and checklists,
folders, per-note colour and font, search, reminders, sharing, and backup and
restore.
Platform for the clone: Android and iOS, built with Expo (React Native).
For: the user's own use. No ads, no paywall, no store launch work for now.
Date: 2026-10-18

> **Confidence warning.** The only public source is the Play listing. The app
> has no website, help center, changelog or public walkthroughs, and its five
> screenshots have no captions that could be read. Everything in Screens, Flows
> and the data model below is **inferred** from the listing's feature list and
> from how apps in this category almost always work. Each item is tagged with
> its confidence. To confirm it, install the original on your phone and save
> screenshots of each screen into `replica/screens/` as S01.png, S02.png and
> so on. Then this map gets corrected to match.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Play Store listing | https://play.google.com/store/apps/details?id=com.note.todolist.noteapp | feature list, data safety, ratings. Read 2026-10-18 |
| 2 | privacy policy | https://docs.google.com/document/d/1Wcg2LEGDuWPlpav5EB3lyN2Z_bM0Yms3t-W6a_jgyxc/edit | a Google Doc, not read in detail |
| 3 | help center / docs | none found | |
| 4 | changelog | none on the listing | last update 2024-03-25 |
| 5 | your own install | to do | the most valuable source here: screenshot every screen and state |

What the listing claims, paraphrased:

- quick note creation
- fonts and colours per note
- folders or categories
- keyword search
- reminders on notes and to-dos
- styling notes to tell kinds of information apart
- sharing notes and lists with others
- calendar and task-manager integration
- automatic cloud backup

Data safety notes from the listing:

- It says data may be shared with third parties (photos and videos, app
  activity and two more types).
- It also says no data is collected, which contradicts the line above.
- Data is encrypted in transit.
- **Data cannot be deleted.** This is worth fixing in your version.

## Core loop

Open the app, write a note or a checklist in a few taps, find it again later
(by folder, colour or search), and get reminded when it matters.

## Screens

| ID | screen | route / how to reach | purpose | key components | states | confidence |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Notes home | app launch | all notes, newest first | top bar, search icon, folder chips or drawer button, note cards (grid or list), FAB "new" | empty (first launch), filled, filtered by folder, long titles | high |
| S02 | New item chooser | FAB on S01 | pick text note or checklist | bottom sheet or speed-dial with 2 options | default | medium |
| S03 | Note editor | tap a card, or "text note" on S02 | write and edit a text note | title field, body field, toolbar (colour, font, reminder, folder, share, more), autosave | new (empty), editing, read-only preview, very long note | high |
| S04 | Checklist editor | "checklist" on S02, or tap a list card | to-do list | title, rows with checkbox and text, add row, drag to reorder, checked items struck through or moved down | new, partly done, all done | high |
| S05 | Colour picker | colour button on S03/S04 | set the note's background colour | bottom sheet, swatch row, selected ring | default, selected | high |
| S06 | Font / text style picker | font button on S03 | set the note's font and size | bottom sheet, font list with previews, size steps | default, selected | medium |
| S07 | Reminder picker | bell button on S03/S04 | set a date and time to be reminded | date picker, time picker, repeat (none, daily, weekly), clear | none set, set, in the past, notification permission denied | medium |
| S08 | Folder picker / manager | folder button on S03, or drawer on S01 | put a note in a folder, create, rename or delete folders | list of folders with counts, "new folder" dialog, rename/delete actions | no folders, filled, delete confirm | medium |
| S09 | Search | search icon on S01 | find notes by text | search field, live results, highlighted match | empty query, results, no results | high |
| S10 | Note actions menu | "more" on S03/S04, or long-press a card on S01 | share, duplicate, move, delete | menu or bottom sheet, delete confirm dialog | default | medium |
| S11 | Trash | drawer or settings | recover deleted notes | list of deleted notes, restore, delete forever, empty trash | empty, filled | guess (not on the listing) |
| S12 | Settings | drawer or gear icon | app preferences | default view (grid/list), sort order, theme, backup section, about | default | medium |
| S13 | Backup and restore | S12 | back up to the cloud and restore | last backup time, "back up now", "restore", account or Drive link | never backed up, backed up, restoring, error (offline, no space) | medium |
| S14 | Reminder notification | system notification | open the note at the right time | notification with title and snippet, tap opens S03/S04 | delivered, tapped | high |

Not in this slice: ad screens and banners, the in-app purchase / premium
screen, and calendar or task-manager integration screens.

## Flows

```
F01 Write a quick text note
    S01 -> S02 -> S03 (type title and body, auto-saved) -> back to S01
    happy path taps: 3 (FAB, "text note", back), plus typing
    edge: back with nothing typed (discard, do not save an empty note),
          app killed mid-typing (must not lose text), very long note, emoji

F02 Make a to-do list and tick it off
    S01 -> S02 -> S04 (title, add rows) -> back ; later S01 -> S04 tick rows
    happy path taps: 3 to create, 1 per row to tick
    edge: empty rows, reorder, all items done, untick, very long item

F03 Colour and style a note
    S03 -> S05 pick colour -> S06 pick font -> back
    happy path taps: 4
    edge: colour readable in dark mode, card on S01 shows the same colour

F04 Organise notes into folders
    S03 -> S08 choose or create folder ; S01 filter by folder
    happy path taps: 3
    edge: delete a folder with notes in it (move to "All", not delete them),
          duplicate folder names, rename

F05 Find a note
    S01 -> S09 type -> tap result -> S03/S04
    happy path taps: 2, plus typing
    edge: no results, accents and case ("cafe" finds "Café"), match in
          checklist items, not only titles

F06 Get reminded
    S03/S04 -> S07 set date and time -> S14 fires -> tap -> note opens
    happy path taps: 4
    edge: notification permission denied, time in the past, phone rebooted
          (reminder must survive), time zone or daylight-saving change,
          note deleted before the reminder fires

F07 Share a note
    S03/S04 -> S10 share -> system share sheet
    happy path taps: 3
    edge: checklist shared as readable text ("☐ / ☑"), very long note

F08 Delete and recover
    S01 long-press -> S10 delete -> confirm ; S11 restore
    happy path taps: 3 to delete, 2 to restore
    edge: undo snackbar, empty trash forever, reminder cancelled on delete

F09 Back up and restore
    S12 -> S13 back up now ; new phone: S13 restore
    happy path taps: 3
    edge: offline, restore onto a phone that already has notes (merge or
          replace?), backup older than local data, very large backup
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Top app bar | home (title + actions), editor (back + actions) | default, scrolled | all |
| FAB | single, speed-dial (2 options) | default, pressed, expanded | S01 |
| Note card | text, checklist preview, with reminder badge, coloured | default, pressed, selected (long-press) | S01, S09, S11 |
| Folder chip / drawer item | all, folder, trash | default, selected | S01, S08 |
| Text field | title, body (multiline), search, dialog input | empty, focused, filled | S03, S04, S08, S09 |
| Checklist row | unchecked, checked | default, editing, dragging | S04 |
| Bottom sheet | colour, font, new item, actions | open, closed | S02, S05, S06, S10 |
| Colour swatch | each palette colour | default, selected | S05 |
| Date and time picker | date, time, repeat | default, set, invalid (past) | S07 |
| Dialog | confirm (delete), input (new folder) | default | S08, S10, S11 |
| Snackbar | info, undo | shown, hidden | S01, S03 |
| Empty state | no notes, no results, empty trash, no folders | default | S01, S08, S09, S11 |
| Settings row | toggle, choice, action | default, disabled | S12, S13 |

## Inferred data model

```
Note        id, type (text | checklist), title, body (text notes),
            color, font_family, font_size, folder_id (nullable),
            pinned (guess), created_at, updated_at, deleted_at (nullable, for trash)
            evidence: listing (notes, to-do lists, fonts, colours, folders)
            confidence: high for type/title/body/color/folder; medium for font fields;
                        guess for pinned and deleted_at

ChecklistItem  id, note_id, text, checked, position
            evidence: listing ("to-do lists")
            confidence: high

Folder      id, name, color (guess), position, created_at
            evidence: listing ("folders or categories")
            confidence: high for name; guess for color

Reminder    id, note_id, fire_at (UTC), repeat (none | daily | weekly | monthly),
            notification_id (the OS's scheduled id), done
            evidence: listing ("reminders")
            confidence: medium (repeat options are a guess)

Settings    view_mode (grid | list), sort (updated | created | title),
            theme (light | dark | system), last_backup_at
            evidence: category convention
            confidence: guess

Backup      a single export of all of the above (JSON), with app version and date
            evidence: listing ("automatic cloud backup")
            confidence: medium for what it holds; unknown where it goes
            (Google Drive is most likely on the original)
```

Relationships: Folder 1-n Note, Note 1-n ChecklistItem, Note 0-1 Reminder
(1-n if multiple reminders turn out to be allowed).

Storage: notes are almost certainly stored on the device (SQLite) with backup
on top, not in a server database. For your own use, that is also the right
default. No account is needed to use the app.

## Feature matrix

See `features.csv`. Must: 16, should: 10, could: 5, skip: 4.

## Out of scope (cannot or should not be cloned)

- **Ads and in-app purchases.** The clone is for your own use, so there is
  nothing to monetise.
- **Calendar and task-manager integrations.** These are outside the chosen
  slice. They can be added later with the official Google Calendar and
  Apple EventKit APIs.
- **The original's backup service.** It is their storage and their account
  link. Your version backs up to your own Google Drive or iCloud, or exports
  a file you control.
- **Its name, icon, colours and wording.** Rebuilt fresh, as always.

## Size

Screens 14, flows 9, entities 5 (plus settings).

Hard parts:
1. **Reminders that never get lost.** This means local notifications that
   survive a reboot, time zone changes, Android exact-alarm permissions, and
   cancelling a reminder when its note is deleted.
2. **Backup and restore.** You need to choose where backups live (Drive or
   iCloud vs. a sync backend) and decide what happens when you restore onto
   a phone that already has notes.
3. **An editor that never loses text.** That means autosave, the app being
   killed mid-edit, and fast search across thousands of notes.

Size: **S to M.** The core (F01-F05, F07, F08) fits in a weekend. Solid
reminders and backup add about one to two more weeks.
