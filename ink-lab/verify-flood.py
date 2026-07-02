#!/usr/local/bin/python3
"""SAFETY: flood-to-navigate must never break navigation. Test normal nav (both directions), back button, reduced-motion."""
from playwright.sync_api import sync_playwright
BASE = "http://localhost:4321"

def overlay_state(pg):
    return pg.evaluate("""() => { const s=document.querySelector('.gf-flood'); if(!s) return {none:true};
        return { opacity: getComputedStyle(s).opacity, d_len: (s.querySelector('.gf-flood-path').getAttribute('d')||'').length }; }""")

with sync_playwright() as pw:
    br = pw.chromium.launch(headless=True)

    # --- normal motion ---
    ctx = br.new_context(viewport={"width":1100,"height":950})
    pg = ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append("PAGEERR: "+str(e)))
    pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    pg.goto(BASE + "/", wait_until="networkidle"); pg.wait_for_timeout(400)
    print("start url:", pg.url)

    # nav: Shop(home) -> About
    pg.click('.site-header a[href="/about"]')
    pg.wait_for_url("**/about", timeout=6000); pg.wait_for_timeout(1200)
    about_ok = pg.locator("h1, h2").first.inner_text()[:30]
    print("-> /about reached:", pg.url.endswith("/about"), "| heading:", about_ok, "| overlay:", overlay_state(pg))

    # nav back the other way: About -> Shop (home)
    pg.click('.site-header a[href="/"]')
    pg.wait_for_url(lambda u: u.rstrip("/").endswith("4321"), timeout=6000); pg.wait_for_timeout(1200)
    print("-> / reached:", pg.url.rstrip("/").endswith("4321"), "| overlay:", overlay_state(pg))

    # nav to a PDP
    href = pg.eval_on_selector("a.card", "a=>a.getAttribute('href')")
    pg.click(f'a.card[href="{href}"]')
    pg.wait_for_url("**/shop/**", timeout=6000); pg.wait_for_timeout(1200)
    print("-> PDP reached:", "/shop/" in pg.url, "| overlay:", overlay_state(pg))

    # browser BACK button
    pg.go_back(); pg.wait_for_timeout(1400)
    print("-> back button:", pg.url, "| overlay:", overlay_state(pg))
    print("normal-motion errors:", errs or "NONE")
    ctx.close()

    # --- reduced motion: instant nav, no flood ---
    ctx = br.new_context(viewport={"width":1100,"height":950}, reduced_motion="reduce")
    pg = ctx.new_page(); pg.add_init_script("try{sessionStorage.setItem('gf-intro-seen','1')}catch(e){}")
    pg.goto(BASE + "/", wait_until="networkidle"); pg.wait_for_timeout(300)
    import time; t0=time.time()
    pg.click('.site-header a[href="/about"]'); pg.wait_for_url("**/about", timeout=6000)
    dt = round((time.time()-t0)*1000)
    pg.wait_for_timeout(300)
    print(f"REDUCED: /about reached in {dt}ms (should be fast, no 500ms cover) | overlay:", overlay_state(pg))
    ctx.close(); br.close()
