#!/usr/local/bin/python3
"""Verify: (1+2) drip tip is convex/smooth, (3) ink-trail canvas CSS size == viewport (retina offset fixed)."""
from playwright.sync_api import sync_playwright
BASE = "http://localhost:4321"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1100, "height": 950}, device_scale_factor=2)  # dpr=2 reproduces the retina bug
    pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    pg.goto(BASE + "/shop/alien-logo-tee/", wait_until="networkidle")
    pg.wait_for_timeout(400)

    # (3) ink-trail canvas: move the mouse so the trail module is active, then measure
    pg.mouse.move(200, 200); pg.mouse.move(360, 300, steps=8); pg.wait_for_timeout(120)
    trail = pg.evaluate("""() => {
        const c = document.querySelector('canvas[aria-hidden=\"true\"]');
        if (!c) return {found:false};
        const r = c.getBoundingClientRect();
        return { found:true, cssW: Math.round(r.width), cssH: Math.round(r.height),
                 innerW: innerWidth, innerH: innerHeight, bitmapW: c.width, dpr: devicePixelRatio };
    }""")
    print("INK-TRAIL canvas:", trail)
    if trail.get("found"):
        ok = abs(trail["cssW"] - trail["innerW"]) <= 2
        print("  -> cursor offset FIXED" if ok else "  -> STILL OFFSET (cssW != innerW)")

    # (1+2) drips: hover add-to-cart, let runs grow, zoom the tips
    btn = pg.locator("[data-ink][data-add-btn]").first
    box = btn.bounding_box()
    pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2)
    pg.wait_for_timeout(1900)
    clip = {"x": box["x"]+40, "y": box["y"]+box["height"]-8, "width": 200, "height": 130}
    pg.screenshot(path="/tmp/fix-drip-tips.png", clip=clip)
    print("drip tip close-up -> /tmp/fix-drip-tips.png")
    b.close()
