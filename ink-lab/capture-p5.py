#!/usr/local/bin/python3
"""Film the Phase-05 'global auto flow-around' demo: hover the button, watch drips weave around untagged boxes."""
import sys, pathlib
from playwright.sync_api import sync_playwright

html = pathlib.Path(sys.argv[1]).resolve(); prefix = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1120, "height": 920}, device_scale_factor=2)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(f"{m.type}:{m.text}") if m.type == "error" else None)
    pg.goto(html.as_uri()); pg.wait_for_timeout(700)
    pg.evaluate("""() => { const g=document.querySelector('div[style*=\"mix-blend-mode:multiply\"]'); if(g) g.style.display='none'; }""")

    sec = pg.locator('[data-screen-label=\"Phase 05 global\"]')
    sec.scroll_into_view_if_needed(); pg.wait_for_timeout(150)
    btn = sec.locator('[data-ink-btn]')
    box = btn.bounding_box()
    pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2)
    for ms, name in [(900,"01-fill"),(1700,"02-weave"),(2700,"03-drape"),(3500,"04-held")]:
        pg.wait_for_timeout(ms - (0 if name=="01-fill" else 0));
        sec.screenshot(path=f"{prefix}-{name}.png");
    # report obstacle detection + run paths
    info = pg.evaluate("""() => {
        const sec = document.querySelector('[data-screen-label=\"Phase 05 global\"]');
        const g = sec.querySelector('.gf-drips');
        return { drips: g ? g.querySelectorAll('path').length : -1,
                 nonEmpty: g ? [...g.querySelectorAll('path')].filter(p=>(p.getAttribute('d')||'').length>10).length : -1 };
    }""")
    print("INFO:", info)
    # leave -> recoil -> rest
    pg.mouse.move(box["x"]+box["width"]/2, box["y"]-400)
    pg.wait_for_timeout(900); sec.screenshot(path=f"{prefix}-05-rest.png")
    print("ERRORS:", errs[:12])
    b.close()
