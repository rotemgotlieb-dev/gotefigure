#!/usr/local/bin/python3
import sys, pathlib
from playwright.sync_api import sync_playwright

def test(p, path, label, hover_first=True):
    f = pathlib.Path(path).resolve()
    pg = p.chromium.launch(headless=True).new_page(viewport={"width":1120,"height":920})
    errs=[]
    pg.on("pageerror", lambda e: errs.append("PAGEERR: "+str(e)))
    pg.on("console", lambda m: errs.append(m.type+": "+m.text) if m.type=="error" else None)
    pg.goto(f.as_uri()); pg.wait_for_timeout(800)
    env = pg.evaluate("""() => ({
        hasInst: !!window.__inkInst,
        ctrls: (window.__inkInst && window.__inkInst.ctrls) ? window.__inkInst.ctrls.length : 'n/a',
        buttons: document.querySelectorAll('[data-ink-btn]').length,
        canHover: matchMedia('(hover:hover) and (pointer:fine)').matches,
        xdcScriptType: (document.querySelector('script[data-dc-script]')||{}).type || 'none'
    })""")
    print(f"\n=== {label} ===")
    print("env:", env)
    if hover_first and env["buttons"]:
        btn = pg.locator('[data-ink-btn]').first
        box = btn.bounding_box()
        pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2)
        pg.wait_for_timeout(1300)
        state = btn.evaluate("""el => ({
            fillLen: (el.querySelector('.gf-fill')||{}).getAttribute ? (el.querySelector('.gf-fill').getAttribute('d')||'').length : -1,
            drips: el.querySelectorAll('.gf-drips path').length
        })""")
        print("after hover -> ", state, "(fillLen>0 means it filled)")
    print("console/page errors:", errs[:8] if errs else "NONE")

with sync_playwright() as p:
    test(p, sys.argv[1], "ink-fill-button.html (standalone)")
    test(p, sys.argv[2], "Ink-Fill Button.dc.html (Design file, opened raw)")
