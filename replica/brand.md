# Brand: Pocketleaf

Written 2026-10-18. Your own notes and lists app, a clean-room rebuild of the
features of "App Notes - Notebook, Notepad" (by Security Lab). None of the
original's identity is used.

**The angle.** `replica/fixes.md` does not exist yet, because
`/replica-entrepreneur` has not run. So the angle comes from the scope you
chose and the gaps the recon found:

> A calm notes and lists app that is entirely yours: no ads, no account,
> everything stays on your phone, and "delete" really deletes.

## 1. The name

Twenty candidates across five styles. Each one cut is listed with the reason.

| style | candidates | cut because |
| --- | --- | --- |
| descriptive | Pagefold, Jotpad, Listleaf, Margin | Jotpad: "-pad" echoes the original's "Notepad". Listleaf: says lists only. Margin: generic finance word, crowded |
| compound | Pocketleaf, Quietpage, Leafline, Hearthpage, Tuckbox, Inkwell | Hearthpage: "Hearth" is a crowded app name (home tracker, family display). Tuckbox: awkward. Inkwell: likely crowded, not checked |
| invented | Brevi, Velo, Lumo, Taliq, Kalo | Lumo: Proton's AI assistant. Velo: bikes. Taliq: hard to spell after hearing it. Kalo: close to "kal" (mud) in Serbian |
| metaphor | Cairn, Nook, Satchel, Lantern, Almanac | Cairn: iOS journaling apps "Cairn Journal" and "Cairn: Reflect & Grow" exist (web check 2026-10-18). Nook: Barnes & Noble trademark in class 9. Satchel: school app. Lantern: VPN app. Almanac: docs startup |
| verb | Tuck, Jot | Tuck: "Tuck Voice – Memo Organizer" and "Tucky" notes apps exist (web check 2026-10-18). Jot: very crowded |

None of the five finalists below uses "note", "notes", "notebook" or
"notepad". The original's name is made of exactly those words, so that keeps
clear of it in sound, look and meaning.

**Recommended: Pocketleaf.** The idea is "a leaf of paper in your pocket": small,
private and always with you. It is spellable after hearing it once, and it
says "it's on your phone" without using the word.

### The checks

Results are the date a check was run. **to run** means nobody has run it.
A web search is a screen, not a clearance.

| check | Pocketleaf | Brevi | Leafline | Pagefold | Quietpage |
| --- | --- | --- | --- | --- | --- |
| the web, name + "app" | 2026-10-18: no app or product found | 2026-10-18: no notes app found (hits are the iBreviary prayer app) | 2026-10-18: an app called "Leafline" has a privacy policy dated Aug 2026, category unknown ⚠ | 2026-10-18: no exact match; iOS "Note Fold: Structured Notes" exists, a similar name in the same category ⚠ | 2026-10-18: a product called "QuietPages" exists ⚠ |
| App Store and Play, exact name | to run | to run | to run | to run | to run |
| US trademark (tmsearch.uspto.gov, classes 9 and 42) | to run | to run, and note **Brevi Milano**, a baby-goods brand (other classes) | to run | to run | to run |
| EU trademark (TMview / EUIPO eSearch) | to run | to run | to run | to run | to run |
| Canada (ised-isde.canada.ca) | to run | to run | to run | to run | to run |
| global (WIPO Global Brand Database) | to run | to run | to run | to run | to run |
| domain (pocketleaf.app, .com) | to run | to run | to run | to run | to run |
| handles (X, Instagram, TikTok, GitHub) | to run | to run | to run | to run | to run |

My workspace can't reach the trademark databases, whois or the stores
directly. Run those rows yourself before you print anything with the name on
it.

The app is for your own use and is not going to a store, so the risk is low.
If you ever publish it, a trademark lawyer should do a proper search first.

**Changing the name later** is three edits: `APP_NAME` in `src/copy.ts`, `name`
in `replica/brand.json`, and `name`/`slug`/`scheme` in `app.json`. Then re-run
the sweep.

## 2. Palette

The accent is **leaf green**. It is written into the same token roles
`/replica-design` set up, so no component changed.

| role | light | dark |
| --- | --- | --- |
| accent / focus | `#2f6b45` | `#8fd3a8` |
| on-accent | `#ffffff` | `#10241a` |
| snackbar action | `#a8e0bc` | `#2f6b45` |
| neutrals | warm paper greys (unchanged) | warm charcoal (unchanged) |
| note colours | 10 pastel / deep pairs (unchanged) | |

Contrast: `npm run contrast` checks **100 pairs, 0 AA failures**
(`replica/design/contrast-report.txt`).

**Original's colours: to measure.** Nobody has looked at the original's icon
or screens up close yet. The Play listing's images were shown to you in
chat. If its brand hue turns out to be green, tell me and the accent moves to
another family. Its colours also go into `brand.json` → `colors` so the sweep
catches any that survive.

## 3. Logo brief

- **Idea:** a single leaf tucked into a pocket. You see the rounded top edge
  of a pocket with a leaf peeking out at an angle.
- **Mark type:** symbol plus wordmark. The symbol works alone as the app icon
  and favicon.
- **Wordmark:** "Pocketleaf" in lowercase or sentence case, in an open font
  such as Inter Semibold or Manrope Bold. Tight but not cramped tracking.
- **Colour:** the leaf in accent green `#2f6b45`, the pocket line in text
  `#1c1b19`, on paper `#fbfaf8`. In dark mode, the leaf is `#8fd3a8` on
  `#151413`.
- **Must work at 16px:** at favicon size, drop the pocket and keep only the
  leaf, as a solid shape with one vein cut out.
- **Deliverables:**
  - SVG master
  - iOS app icon at 1024×1024 with no transparency
  - Android adaptive icon: a foreground leaf on a `#FBFAF8` background, plus
    a monochrome version
  - favicon set
  - a 1200×630 social image
- **Must not resemble the original's mark.**
  - No notepad with a folded corner, no spiral-bound pad, no pencil-on-paper:
    those are the category clichés and the most likely shapes of the original.
  - No shared colour pair. Put the original's Play icon next to every draft
    and check.
- **Status:** the app still uses Expo's default placeholder icons, in
  `assets/`. Replace them before you install the app on your phone for good.

## 4. Voice

Three words, each with what it does not mean:

- **Calm**, not sleepy. Unhurried, no exclamation marks, no urgency, no hype.
- **Plain**, not cold. Everyday words, written warmly, like a friend leaving
  you a note.
- **Brief**, not curt. One idea per sentence, and the reason when it helps.

| do | don't |
| --- | --- |
| "Moved to trash." | "Your note has been successfully deleted!" |
| "It stays on this phone." | "Your data is secured with enterprise-grade storage." |
| "That time has already gone by." | "Error: invalid date selected." |
| "Delete for good?" | "Are you sure you want to permanently delete this item? This action is irreversible!!" |
| "List" / "Note" | "Create a new to-do list item entry" |

The 10 most-seen strings, rewritten in this voice. They live in `src/copy.ts`,
and screens import from there.

| # | where | string |
| --- | --- | --- |
| 1 | home title | Pocketleaf |
| 2 | home empty state | **A blank page.** Tap + to start a note or a list. It stays on this phone. |
| 3 | new button and sheet | New → **Note** (Write it down) · **List** (Tick it off) |
| 4 | delete confirm | **Move to trash?** You can bring it back from the trash for 30 days. [Move to trash] |
| 5 | after delete | Moved to trash. [Undo] |
| 6 | delete forever | **Delete for good?** This removes it from your phone. It can't be undone. |
| 7 | search, no results | **Nothing found.** No notes mention "…". |
| 8 | reminder permission | Notifications are off for Pocketleaf, so reminders can't reach you. [Open settings] |
| 9 | reminder in the past | That time has already gone by. |
| 10 | folder name taken | There's already a folder with this name. |

Also in the copy file: the restore confirmation ("Notes from the backup are
added. Nothing on this phone is deleted.") and the exact-alarms warning.

There is no sign-up string, because the app has no accounts. The original's
listing tagline is not echoed anywhere.

## 5. The sweep

`replica/brand.json` holds:

- **avoid:** "App Notes", "Security Lab", and the original's package id in
  two forms
- **domains:** none (the original has no website)
- **colors:** still to measure

```
python3 -I replica-tools/sweep.py . --config replica/brand.json
Clean. Nothing of the original's name, domain or colours found.
```

`replica/` is skipped on purpose: it is the planning folder, where the
original's name belongs. The one file in it that will ship, `schema.sql` (the
first migration), had its header comment rewritten.

### By-eye checks

| item | result |
| --- | --- |
| page and app title | "Pocketleaf" |
| home screen | the name and new copy, in both themes |
| app name, slug, scheme, bundle and package ids in `app.json` | Pocketleaf / `pocketleaf` / `app.pocketleaf.notes` |
| app icon, favicon and splash | **still Expo placeholders.** Not the original's, but not yours yet. Replace them from the logo brief |
| email templates and OG image | none exist (no email, no website) |

## Next

- **`/replica-launch`** is mostly not needed for an app only you use. Its
  store-listing lint is only relevant if you publish.
- For your own install, the useful next steps are:
  - **`/replica-build`**, to build the actual screens
  - then **`/replica-test`**
  - then a personal install via **`/replica-deploy`**: an Android APK, or
    TestFlight on iOS
