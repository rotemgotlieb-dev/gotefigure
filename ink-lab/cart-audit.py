#!/usr/local/bin/python3
"""Audit the real Astro store cart drawer + nav. Test manual open first, then add-auto-open."""
import urllib.request
from playwright.sync_api import sync_playwright
BASE = "http://localhost:4321"

def dstate(pg):
    return pg.evaluate("""() => { const d=document.getElementById('cart-drawer'); const r=d.getBoundingClientRect();
        return { open:d.classList.contains('open'), hidden:d.hidden, onScreen:r.left < innerWidth-50,
                 lines:document.querySelectorAll('#cart-lines .line').length }; }""")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1100, "height": 950}, device_scale_factor=2)
    pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    pg.goto(BASE + "/shop/alien-logo-tee/", wait_until="networkidle")
    pg.wait_for_timeout(400)

    # 1. manual open from clean (empty) state
    pg.locator("#cart-open").click()
    pg.wait_for_timeout(450)
    print("1. manual open (empty):", dstate(pg))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(450)
    print("2. after ESC:", dstate(pg))

    # 3. add an item -> does it auto-open with the line?
    pg.locator("[data-add-btn]").first.click()
    pg.wait_for_timeout(700)
    s = dstate(pg)
    print("3. after add:", s)
    pg.screenshot(path="/tmp/cart-open.png", clip={"x": 1100-440, "y": 0, "width": 440, "height": 720})

    # 4. close via backdrop click (top-left, away from drawer)
    if s["open"]:
        pg.mouse.click(60, 400); pg.wait_for_timeout(450)
        print("4. after backdrop click:", dstate(pg))

    # 5. nav resolves
    hrefs = pg.eval_on_selector_all(".site-header a", "els => [...new Set(els.map(a => a.getAttribute('href')))]")
    print("5. nav hrefs:", hrefs)
    for h in hrefs:
        if not h or not h.startswith("/"): continue
        try: code = urllib.request.urlopen(BASE + h, timeout=5).getcode()
        except Exception as e: code = "ERR " + str(e)[:30]
        print(f"     {h} -> {code}")
    print("ERRORS:", [e for e in errs if 'Outdated' not in e and 'xray' not in e] or "NONE")
    b.close()
