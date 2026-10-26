# Deploy checklist: Pocketleaf

- **Date:** 2026-10-19
- **Commit:** see the last commit in the project
- **Go from user:** **not yet**. Nothing gets built on your Expo account,
  installed or published without your say-so.

**What "deploy" means here.** Pocketleaf is for your own use. It is offline
and has no server, accounts or payments. So deploying is:

1. a signed Android APK, installed on your phone
2. iPhone through TestFlight, only if you get an Apple Developer account

There is no domain, host, DNS, email, Stripe or OAuth. Those sections of the
pack's checklist are marked N/A below, with the reason.

## Preflight

| check | result |
| --- | --- |
| e2e suite green | **61 / 61** (Playwright, phone + desktop; re-run 2026-10-19 after the last changes) |
| data tests | **34 / 34** (`npm test`) |
| typecheck, lint | pass |
| no open S1 or S2 bugs | **pass**: 8 found, 8 fixed (`bugs.md`) |
| parity: all must-haves done | **14 / 16, feature score 92.5**. The two partial ones (reminders fire, tap opens the note) can only be verified on a phone, which is what this build is for |
| rebrand sweep clean | **pass**: `sweep.py` exit 0, "Clean. Nothing of the original's name, domain or colours found." |
| store listing (`listing.py`) | N/A: not going to a store |
| production build | **pass for config**. `expo prebuild --platform android` generated the native project with package `app.pocketleaf.notes`, the `SCHEDULE_EXACT_ALARM` permission and `allowBackup="true"`. The web export builds. A full native compile needs EAS or Android Studio (not in this workspace) |
| `expo-doctor` | 18 / 20. The 2 failures are only "couldn't reach Expo's servers" (blocked here). Re-run `npx expo-doctor` on your machine |
| privacy policy and terms | N/A for your own install: nothing is collected or sent anywhere. Needed only if you publish (the About screen already says what happens to your data) |
| account deletion works | N/A: no accounts. "Delete for good", "Empty trash" and uninstalling remove everything (tested) |
| icon, splash, favicon, titles are yours | **pass**: the Pocketleaf mark replaces Expo's placeholders; the title is "Pocketleaf"; the sweep is clean |

**Verdict:** every check that can run here passes. Ready for **a personal test build**. It is **not** ready to
call done, because 2 must-haves wait on your phone. Running this build *is*
the way to close them.

## App icon

The mark comes from the brand brief: a leaf tucked into a pocket. It is drawn
as SVG in `assets/brand/mark.svg`, and `python3 assets/brand/render.py`
renders every size from it:

- `icon.png`, 1024, opaque, for iOS and the store
- the Android adaptive foreground, background and monochrome layers
- `splash-icon.png`
- `favicon.png`, which uses the leaf only, so it reads at 48 px

It has no notepad, folded corner, spiral or pencil, so nothing shares a
shape with the category clichés. **Your check:** put it next to the
original's Play icon and make sure they don't look alike. I can't see that
image.

## Build and install on Android (you run these; they need your Expo login)

```bash
npm install
npx expo install --fix          # re-checks package versions against SDK 58 (blocked in my workspace)
npx eas-cli@latest login        # your free Expo account
npx eas-cli@latest build:configure   # links the project; keep the existing eas.json
npx eas-cli@latest build --platform android --profile preview
```

1. EAS builds in the cloud and gives a link and a QR code to an `.apk`.
2. Open it on your phone and allow "install unknown apps" for your browser
   once.
3. EAS creates and stores the signing key the first time. Keep it: updates
   must be signed with the same key.

**No Expo account?** Build locally with Android Studio installed:
`npx expo run:android --variant release`.

## iPhone (optional)

- You need an Apple Developer account ($99 a year).
- Then run `npx eas-cli@latest build --platform ios --profile production`
  and `npx eas-cli@latest submit --platform ios`, and install through
  TestFlight.
- A free Apple ID can run it from Xcode, but that install expires after 7
  days.

## Production, domain, monitoring

| section | status |
| --- | --- |
| production database | N/A: SQLite on the phone. Migrations run on launch (`PRAGMA user_version` 2) |
| env vars | N/A: there are no keys or secrets |
| Stripe, OAuth, email domain | N/A |
| domain, DNS, HTTPS | N/A: no website |
| error tracking, uptime, analytics | N/A: deliberately none, since "no tracking" is in the About screen. If something breaks, `adb logcat` shows it |

## First week on your phone

The phone checklist from `test-plan.md`. Tick each one and tell me what
happened:

- [ ] **P2:** set a reminder 2 min out. Does it fire with the app open? Then
  with it closed?
- [ ] **P3:** tap the notification. Does the note open?
- [ ] **P4:** set one 10 min out and reboot the phone. Does it still fire?
- [ ] **P5:** deny notifications and look for the banner. On Android 14,
  allow exact reminders from the banner.
- [ ] **P6:** type, then swipe the app away immediately. Is the text there
  when you reopen?
- [ ] **P7:** share a list into a chat app. Does the text arrive intact?
- [ ] **P8:** Back up now → Drive, uninstall, reinstall, Restore. Is
  everything back?
- [ ] **P9:** TalkBack: make a list, tick an item, move an item.
- [ ] **P10:** set the largest font size. Are the home, editor and sheets
  readable?

- [ ] **P11:** in a note, tap the photo button. Take a photo with the camera,
  then pick 3 from the gallery. Do they show in the note and on its card?
- [ ] **P12:** Settings → Telegram backup: make a bot with @BotFather, tap
  Start in it, paste the token, Connect. Does the hello message arrive?
- [ ] **P13:** add a video over 20 MB, then Back up now. In the chat, is it
  split into `.part01of0N` files, with the manifest pinned at the end?
- [ ] **P14:** uninstall, reinstall, connect the same bot, Restore from
  Telegram. Do the notes, the photos and the big video come back and play?

When P2–P4 pass, the two partial must-haves become `yes`. Parity is then
97.5 with 16 of 16 must-haves.
