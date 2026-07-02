#!/usr/local/bin/python3
"""Capture button drips on a WIDE vs NARROW button to confirm count scales with width."""
import sys, pathlib
from playwright.sync_api import sync_playwright

html = pathlib.Path(sys.argv[1]).resolve()
prefix = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1120, "height": 920}, device_scale_factor=2)
    pg.goto(html.as_uri()); pg.wait_for_timeout(700)
    pg.evaluate("""() => { const g=document.querySelector('div[style*=\"mix-blend-mode:multiply\"]'); if(g) g.style.display='none'; }""")

    def shoot(sel, name):
        loc = pg.locator(sel).first
        box = loc.bounding_box()
        pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2)
        pg.wait_for_timeout(2600)  # fill + runs grow
        info = loc.evaluate("""el => ({ w: Math.round(el.clientWidth), drips: el.querySelectorAll('.gf-drips path').length })""")
        clip = {"x": max(0, box["x"]-30), "y": box["y"]-10, "width": box["width"]+60, "height": box["height"]+170}
        pg.screenshot(path=f"{prefix}-{name}.png", clip=clip)
        print(f"{name}: width={info['w']}px  drips={info['drips']}")
        pg.mouse.move(box["x"]+box["width"]/2, box["y"]-300); pg.wait_for_timeout(900)

    # Screen A wide button
    shoot('[data-screen=\"A\"] [data-ink-btn]', "wide-shopdrop")
    # reveal Screen B, then narrow Back + wide Add
    pg.evaluate("""() => { document.querySelector('[data-screen=\"A\"]').style.display='none'; document.querySelector('[data-screen=\"B\"]').style.display='flex'; }""")
    pg.wait_for_timeout(200)
    shoot('[data-screen=\"B\"] [data-nav=\"A\"]', "narrow-back")
    shoot('[data-screen=\"B\"] [data-ink-btn]:not([data-nav])', "wide-satchel")
    b.close()
