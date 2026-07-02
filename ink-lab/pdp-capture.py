#!/usr/local/bin/python3
"""Film the real PDP 'Add to cart' ink button on the running Astro dev server, and verify the buy flow still works."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4321"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1100, "height": 950}, device_scale_factor=2)
    pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")  # skip the Wink intro
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    pg.on("console", lambda m: errs.append("console.error: " + m.text) if m.type == "error" else None)

    pg.goto(BASE, wait_until="networkidle")
    # first product card -> PDP
    href = pg.eval_on_selector("a.card", "a => a.getAttribute('href')")
    print("PDP:", href)
    pg.goto(BASE + href, wait_until="networkidle")
    pg.wait_for_timeout(500)

    btn = pg.locator("[data-ink][data-add-btn]")
    n = btn.count()
    print("ink add-btn found:", n)
    if n:
        box = btn.first.bounding_box()
        info = btn.first.evaluate("""el => ({
            hasFill: !!el.querySelector('svg path[fill=\"#111111\"]'),
            paperClone: !![...el.querySelectorAll('span')].find(s => s.getAttribute('aria-hidden')==='true'),
            disabled: el.disabled
        })""")
        print("button layers:", info)
        # hover and hold -> fill + drips
        pg.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
        pg.wait_for_timeout(1500)
        clip = {"x": max(0, box["x"]-40), "y": box["y"]-120, "width": box["width"]+80, "height": box["height"]+220}
        pg.screenshot(path="/tmp/pdp-ink-hover.png", clip=clip)
        filled = btn.first.evaluate("el => { const p = el.querySelector('svg path[fill=\"#111111\"]'); return p ? (p.getAttribute('d')||'').length : -1; }")
        print("fill path length after hover (>0 = filled):", filled)

        # verify buy flow: cart count before/after clicking add
        before = pg.evaluate("() => (document.querySelector('.cart-btn')||document.body).textContent")
        pg.mouse.move(box["x"]+box["width"]/2, box["y"]-300)  # leave so hover state clears
        pg.wait_for_timeout(300)
        btn.first.click()
        pg.wait_for_timeout(900)
        after = pg.evaluate("() => (document.querySelector('.cart-btn')||document.body).textContent")
        print("cart text before:", repr(before.strip()[:40]), "| after add:", repr(after.strip()[:40]))

    print("ERRORS:", errs[:10] if errs else "NONE")
    b.close()
