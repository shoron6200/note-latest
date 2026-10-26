# Web checks

The flow tests now live in `e2e/*.spec.ts` (`npx playwright test`). These scripts remain for screenshots and a quick drag check.

Quick checks of the web build (real SQLite in the browser). They do not replace
testing on a phone: reminders, notifications and the share sheet only work there.

```bash
npx expo export --platform web
python3 -I e2e/web/spa.py "$PWD/dist" 8765 &                  # serves with the isolation headers expo-sqlite needs
python3 e2e/web/drag.py                                       # drag to reorder
python3 e2e/web/screens.py replica/clone-screens              # screenshots at 390 and 1440
```

Needs Python Playwright (`pip install playwright && playwright install chromium`).
