#!/usr/local/bin/python3
"""Capture the real PDP ink add-to-cart at idle / mid-fill / full, wide enough to judge border alignment."""
from playwright.sync_api import sync_playwright
BASE = "http://localhost:4321"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1100, "height": 950}, device_scale_factor=2)
    pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    pg.on("console", lambda m: errs.append("err: " + m.text) if m.type == "error" else None)
    pg.goto(BASE + "/shop/alien-logo-tee/", wait_until="networkidle")
    pg.wait_for_timeout(500)
    btn = pg.locator("[data-ink][data-add-btn]").first
    box = btn.bounding_box()
    clip = {"x": max(0, box["x"]-30), "y": box["y"]-22, "width": box["width"]+60, "height": box["height"]+200}
    # idle (move mouse far away first)
    pg.mouse.move(40, 40); pg.wait_for_timeout(300)
    pg.screenshot(path="/tmp/pol-idle.png", clip={"x": max(0,box["x"]-30), "y": box["y"]-22, "width": box["width"]+60, "height": box["height"]+30})
    # mid-fill
    pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2); pg.wait_for_timeout(430)
    pg.screenshot(path="/tmp/pol-mid.png", clip={"x": max(0,box["x"]-30), "y": box["y"]-22, "width": box["width"]+60, "height": box["height"]+30})
    # full + drips
    pg.wait_for_timeout(1500)
    pg.screenshot(path="/tmp/pol-full.png", clip=clip)
    print("box w,h:", round(box["width"]), round(box["height"]))
    print("ERRORS:", [e for e in errs if "Outdated Optimize" not in e and "xray" not in e][:6] or "NONE (ink-related)")
    b.close()
