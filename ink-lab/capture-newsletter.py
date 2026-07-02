#!/usr/local/bin/python3
"""Verify the newsletter (teal, paper-label) ink button: idle teal, hover ink-flood with readable label."""
from playwright.sync_api import sync_playwright
BASE = "http://localhost:4321"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1100, "height": 950}, device_scale_factor=2)
    pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    pg.on("console", lambda m: errs.append("err: " + m.text) if m.type == "error" else None)
    pg.goto(BASE + "/", wait_until="networkidle")
    pg.wait_for_timeout(500)
    btn = pg.locator("[data-newsletter] button[data-ink]").first
    n = btn.count()
    print("newsletter ink button found:", n)
    if n:
        btn.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        box = btn.bounding_box()
        clip = {"x": max(0, box["x"]-20), "y": box["y"]-16, "width": box["width"]+40, "height": box["height"]+120}
        pg.mouse.move(20, 20); pg.wait_for_timeout(300)
        pg.screenshot(path="/tmp/nl-idle.png", clip={"x": max(0,box["x"]-20), "y": box["y"]-16, "width": box["width"]+40, "height": box["height"]+24})
        pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2); pg.wait_for_timeout(1500)
        pg.screenshot(path="/tmp/nl-hover.png", clip=clip)
        filled = btn.evaluate("el => { const p = el.querySelector('svg path[fill=\"#111111\"]'); return p ? (p.getAttribute('d')||'').length : -1; }")
        print("fill length on hover (>0 = ok):", filled)
    print("ERRORS:", [e for e in errs if 'Outdated' not in e and 'xray' not in e] or "NONE")
    b.close()
