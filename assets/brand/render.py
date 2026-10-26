"""Render the Pocketleaf mark to every icon size Expo needs.

    python3 assets/brand/render.py      (needs Python Playwright + Chromium)
"""
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
ASSETS = HERE.parent
svg = (HERE / "mark.svg").read_text()
inner = svg[svg.index(">") + 1 : svg.rindex("</svg>")]
leaf_only = inner.split('<g id="pocket">')[0]


def page_for(size, body, bg):
    return (
        f'<html><body style="margin:0;background:{bg}">'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 100 100">{body}</svg>'
        "</body></html>"
    )


def mono(s):
    """One colour (the system tints it); the vein and stitching stay cut out."""
    return (
        s.replace('fill="#2f6b45"', 'fill="#000"')
        .replace('fill="#fbfaf8"', 'fill="#fff"')
        .replace('stroke="#1c1b19"', 'stroke="#000"')
        .replace('stroke="#fbfaf8"', 'stroke="#fff"')
    )


def scaled(s, k, dy=0, dx=0):
    """Shrink the mark around the centre (adaptive icons keep the middle 66%)."""
    return f'<g transform="translate({50 - 50 * k + dx} {50 - 50 * k + dy}) scale({k})">{s}</g>'


JOBS = [
    # name, size, svg body, background, transparent
    ("icon.png", 1024, scaled(inner, 0.82), "#fbfaf8", False),  # iOS: no transparency
    ("splash-icon.png", 1024, scaled(inner, 0.9), "", True),
    ("android-icon-foreground.png", 512, scaled(inner, 0.62), "", True),
    ("android-icon-background.png", 512, "", "#fbfaf8", False),
    ("android-icon-monochrome.png", 432, scaled(mono(inner), 0.62), "", True),
    ("favicon.png", 48, scaled(leaf_only, 1.05, dy=8, dx=4), "", True),  # leaf only at tiny sizes
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, size, body, bg, transparent in JOBS:
        page = browser.new_page(viewport={"width": size, "height": size})
        page.set_content(page_for(size, body, "transparent" if transparent else bg))
        page.screenshot(path=str(ASSETS / name), omit_background=transparent)
        page.close()
        print("wrote", name, size)
    browser.close()
