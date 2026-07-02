#!/usr/local/bin/python3
"""Verify the ink CTA honors reduced-motion, touch, and keyboard focus."""
from playwright.sync_api import sync_playwright
BASE = "http://localhost:4321/shop/alien-logo-tee/"

def fill_len(loc):
    return loc.evaluate("el => { const p = el.querySelector('svg path[fill=\"#111111\"]'); return p ? (p.getAttribute('d')||'').length : -1; }")
def drip_count(loc):
    return loc.evaluate("el => el.querySelectorAll('.gf-drips path').length")

with sync_playwright() as b:
    br = b.chromium.launch(headless=True)

    # 1) REDUCED MOTION: hover should fill INSTANTLY with NO drips, leave clears
    ctx = br.new_context(viewport={"width":1100,"height":950}, reduced_motion="reduce")
    pg = ctx.new_page(); pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(300)
    btn = pg.locator("[data-ink][data-add-btn]").first; box = btn.bounding_box()
    pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2); pg.wait_for_timeout(180)  # << fill duration; instant if reduced
    print("REDUCED: fill@180ms =", fill_len(btn), "(>0 = instant fill OK)  drips =", drip_count(btn), "(want 0)")
    pg.mouse.move(20,20); pg.wait_for_timeout(200)
    print("REDUCED: fill after leave =", fill_len(btn), "(want -1/empty)")
    ctx.close()

    # 2) KEYBOARD: focusing the button fills it (focus -> onEnter)
    ctx = br.new_context(viewport={"width":1100,"height":950})
    pg = ctx.new_page(); pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(300)
    btn = pg.locator("[data-ink][data-add-btn]").first
    btn.focus(); pg.wait_for_timeout(1100)
    print("KEYBOARD: fill on focus =", fill_len(btn), "(>0 = focus fills OK)")
    ctx.close()

    # 3) TOUCH (no hover): tap fills + drips, then auto-drains ~900ms
    ctx = br.new_context(viewport={"width":390,"height":820}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    pg.goto(BASE, wait_until="networkidle"); pg.wait_for_timeout(400)
    env = pg.evaluate("() => ({canHover: matchMedia('(hover:hover) and (pointer:fine)').matches})")
    btn = pg.locator("[data-ink][data-add-btn]").first
    try:
        btn.tap(); pg.wait_for_timeout(700)
        print("TOUCH: canHover =", env["canHover"], "| fill after tap =", fill_len(btn), "drips =", drip_count(btn))
        pg.wait_for_timeout(1400)
        print("TOUCH: fill after auto-drain =", fill_len(btn), "(want -1/empty)")
    except Exception as e:
        print("TOUCH error:", str(e)[:120])
    ctx.close(); br.close()
