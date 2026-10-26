import re
from playwright.sync_api import sync_playwright
URL = "http://127.0.0.1:8765"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    pg.goto(f"{URL}/?demo=1", wait_until="networkidle"); pg.wait_for_timeout(2500)
    pg.get_by_role("button", name=re.compile("^Groceries")).filter(visible=True).last.click(); pg.wait_for_timeout(800)
    texts = lambda: [pg.get_by_label("Item text").filter(visible=True).nth(i).input_value() for i in range(6)]
    print("before:", texts())
    h = pg.get_by_label("Move Oat milk", exact=True).filter(visible=True).last.bounding_box()
    x, y = h["x"] + h["width"] / 2, h["y"] + h["height"] / 2
    pg.mouse.move(x, y); pg.mouse.down()
    for k in range(1, 21):
        pg.mouse.move(x, y + k * 5); pg.wait_for_timeout(15)
        if k == 10:
            pg.screenshot(path="/tmp/claude-0/-home-claude/81c3d813-17de-545e-9e2c-2be7f5a1b2e5/scratchpad/middrag.png")
            print("transform:", pg.evaluate("[...document.querySelectorAll('[role=listitem]')].map(e => getComputedStyle(e).transform).slice(0,3)"))
    pg.mouse.up(); pg.wait_for_timeout(800)
    print("after drag:", texts())
    pg.get_by_role("button", name="Back", exact=True).filter(visible=True).last.click(); pg.wait_for_timeout(800)
    pg.get_by_role("button", name=re.compile("^Groceries")).filter(visible=True).last.click(); pg.wait_for_timeout(800)
    print("reopened:", texts())
    b.close()
