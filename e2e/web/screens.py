"""Screenshot every recon screen at 390x844 and 1440x900, with the sample notes."""
import re
import sys

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8765"
OUT = sys.argv[1]

with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h, suffix in [(390, 844, ""), (1440, 900, "-1440")]:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 500 else 1)
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.set_default_timeout(8000)
        btn = lambda name: pg.get_by_role("button", name=name, exact=True).filter(visible=True).last
        card = lambda title: pg.get_by_role("button", name=re.compile("^(Pinned\\., )?" + re.escape(title))).filter(visible=True).last

        def shot(sid):
            pg.wait_for_timeout(700)
            pg.screenshot(path=f"{OUT}/{sid}{suffix}.png")

        def home():
            pg.goto(URL, wait_until="networkidle")
            pg.wait_for_timeout(900)

        pg.goto(f"{URL}/?demo=1", wait_until="networkidle")
        pg.wait_for_timeout(2500)
        shot("S01")
        btn("New").click()
        shot("S02")
        pg.keyboard.press("Escape")
        btn("Close").click() if btn("Close").count() else None

        home()
        card("Ideas for the weekend").click()
        shot("S03")
        btn("Colour").click()
        shot("S05")
        pg.keyboard.press("Escape")
        btn("Font and size").click()
        shot("S06")
        pg.keyboard.press("Escape")
        btn("Remind me").click()
        shot("S07")
        pg.keyboard.press("Escape")
        btn("More").click()
        shot("S10")
        btn("Move to folder").click()
        shot("S08-picker")
        pg.keyboard.press("Escape")

        home()
        card("Groceries").click()
        shot("S04")

        home()
        pg.goto(f"{URL}/folders", wait_until="networkidle")
        shot("S08")
        pg.goto(f"{URL}/search", wait_until="networkidle")
        pg.wait_for_timeout(600)
        pg.get_by_label("Search your notes").filter(visible=True).last.fill("bread")
        shot("S09")
        pg.goto(f"{URL}/trash", wait_until="networkidle")
        shot("S11")
        pg.goto(f"{URL}/settings", wait_until="networkidle")
        shot("S12")
        pg.goto(f"{URL}/settings/backup", wait_until="networkidle")
        shot("S13")
        print(w, "errors:", errs[:5])
        ctx.close()

    # States: empty home, dark home, long title.
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme="dark")
    pg = ctx.new_page()
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{OUT}/state-S01-empty-dark.png")
    ctx.close()
    b.close()
