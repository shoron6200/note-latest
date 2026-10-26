# Parity: Pocketleaf vs App Notes - Notebook, Notepad

Date 2026-10-19 · build ff5d76b · `python3 -I replica-tools/parity.py replica/features.csv`

## Verdict: **not shippable yet**, by the pack's rule

Two must-haves are only partly done:

- setting a reminder
- tapping a reminder to open its note

Both are built and tested in code. Neither has fired on a real phone yet, so
they count as half. There are no open S1 or S2 bugs: 8 found, 8 fixed (see
`bugs.md`).

In practice: once the phone checklist (P2–P4 in `test-plan.md`) passes and
those two rows flip to `yes`, the score becomes **97.5** with 16 of 16
must-haves, which counts as **shippable**. Nothing needs writing for that,
only checking on your device.

## Scores

| | score |
| --- | --- |
| **overall** | **92.5 / 100** (feature score only; see layout) |
| features | 92.5. 31 rows counted, must-haves 14 of 16 done, 2 partial |
| layout | **not measured**: no screenshots of the original exist (`replica/screens/` is empty) |

### By area, weakest first

| area | score | why |
| --- | --- | --- |
| reminders | 60 | three of four rows wait on a phone (delivery, tap-to-open, reboot) |
| search | 75 | match highlighting not built (a could-have) |
| backup | 90 | daily snapshots not verified on a phone |
| notes, home, checklists, styling, folders, sharing, settings | 100 | |

### Left out on purpose (not scored)

- **Ads and in-app purchases:** the app is for your own use.
- **Calendar and task-manager integration:** outside the scope you chose.

## Layout per screen

**Not measured.** The layout diff compares structure, not colour, between
two screenshots taken at the same size and in the same state. That needs the
original's screens, and nobody has captured them. The recon only had the Play
listing, whose screenshots couldn't be read.

To get layout scores:

1. Install the original on your phone. Screenshot S01, S03, S04, S07, S08 and
   S09 with similar content. (S01 is home with a few notes, S03 a text note,
   S04 a checklist, S07 the reminder picker, S08 folders, S09 search.)
2. Save them as `replica/screens/S01.png` and so on, and send them over.
3. Ask me to re-run this. Each screen is compared against
   `replica/clone-screens/S0x.png`, after re-shooting the clone at your
   phone's resolution with matching content.

Your version was designed without looking at the original, so expect low
layout scores in places. That is fine: the layout score is about whether
someone switching from the original feels at home, and the brand guide
deliberately avoids its look.

## Behaviour differences

The original has never been used side by side with the clone. The "original"
column below comes only from its Play listing, and every row says so. The
rest is checked in the clone.

| flow | original does (source) | clone does | fix or keep |
| --- | --- | --- | --- |
| F01 write a note | create notes quickly (listing) | 3 taps (New → Note → Back) plus typing; autosaves as you type; an empty note is discarded | keep. Click count of the original unknown |
| F02 to-do list | to-do lists (listing) | Enter adds an item, Backspace removes one, ticked items move to Done, drag to reorder | keep |
| F03 style | fonts and colours (listing) | 10 colours in light and dark versions, 4 fonts, 4 sizes | keep |
| F05 search | search by keywords or phrases (listing) | searches titles, bodies and list items; ignores accents and case | keep. Add highlighting (could) |
| F06 reminders | reminders (listing) | once, daily, weekly or monthly; DST-safe; resynced on every launch | verify on a phone |
| F07 share | share notes and lists (listing) | plain text via the share sheet, lists as ☐/☑ | keep |
| F09 backup | automatic cloud backup to its service (listing) | a file you save anywhere, plus 7 daily local copies picked up by the phone's own backup; no account | keep: no account is the point |
| deleting | "data cannot be deleted" (Play data-safety section) | "delete for good", empty trash and uninstall remove everything | keep: better than the original |
| ads and data | shows ads; may share data with third parties (listing) | no ads, no network, nothing shared | keep: better than the original |
| calendar | integrates with calendars and task managers (listing) | not built | out of scope; add later via official APIs if wanted |

## Top five things to build next

1. **Run the phone checklist** (P1–P10 in `test-plan.md`). It flips the two
   partial must-haves, plus the reboot and snapshot rows, from partial to
   yes, and takes parity to 97.5 and shippable. It needs a development APK
   on your Android phone.
2. **Screenshots of the original** in `replica/screens/`, for the layout
   scores. These are optional, because your version has its own look.
3. **Highlight matches in search results** (could): the matching word in bold
   on each card. About an hour of work.
4. **A real app icon** from the brand's logo brief. It's still the Expo
   placeholder. That's not a parity row, but it's the first thing you'll see
   on your phone.
5. **Run `/replica-entrepreneur`** on the original's 1,300+ reviews. It finds
   what its users hate, which turns parity into "better than the original".
   You already beat it on privacy and on deleting; the reviews may show more.
