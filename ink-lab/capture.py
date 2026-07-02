#!/usr/local/bin/python3
"""Capture a frame series of the Ink-Fill Button Phase-4 hero animating.
Usage: capture.py <html_path> <out_prefix>
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

html = pathlib.Path(sys.argv[1]).resolve()
prefix = sys.argv[2]
url = html.as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1120, "height": 920}, device_scale_factor=2)
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))
    page.goto(url)
    page.wait_for_timeout(700)  # fonts + component mount

    # report environment the script sees
    env = page.evaluate("""() => ({
        canHover: matchMedia('(hover:hover) and (pointer:fine)').matches,
        reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
        hasInst: !!window.__inkInst,
        obstacles: document.querySelectorAll('[data-ink-obstacle]').length,
        heroBtn: !!document.querySelector('[data-ink-hero]'),
    })""")
    print("ENV:", env)

    # neutralize the fixed grain overlay (mix-blend multiply) that blacks out captures
    page.evaluate("""() => {
        const g = document.querySelector('div[style*="mix-blend-mode:multiply"]');
        if (g) g.style.display = 'none';
    }""")

    hero = page.locator('[data-hero]')
    hero.scroll_into_view_if_needed()
    page.wait_for_timeout(150)

    btn = page.locator('[data-ink-hero]')
    box = btn.bounding_box()
    # move real mouse onto the button to fire pointerenter
    page.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2)

    # frame series during the pour
    times = [(350, "01-fill"), (1100, "02-full"), (1900, "03-pour"),
             (2700, "04-drape"), (3600, "05-held")]
    last = 0
    for ms, name in times:
        page.wait_for_timeout(ms - last); last = ms
        hero.screenshot(path=f"{prefix}-{name}.png")
        print("shot", name)

    # leave -> two-stage recoil
    page.mouse.move(box["x"] + box["width"]/2, box["y"] - 400)
    for ms, name in [(180, "06-recoil-a"), (520, "07-recoil-b"), (1100, "08-rest")]:
        page.wait_for_timeout(ms)
        hero.screenshot(path=f"{prefix}-{name}.png")
        print("shot", name)

    # dump generated hero run path geometry for numeric inspection
    geo = page.evaluate("""() => {
        const g = document.querySelector('.gf-hero-runs');
        if (!g) return null;
        return [...g.querySelectorAll('path')].map(p => {
            const d = p.getAttribute('d') || '';
            return { len: d.length, head: d.slice(0, 80) };
        });
    }""")
    print("HERO_PATHS:", geo)
    print("LOGS:", logs[:20])
    browser.close()
