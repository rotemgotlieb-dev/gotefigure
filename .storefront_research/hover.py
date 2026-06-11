#!/usr/bin/env python3
"""Hover over the first product card and screenshot before/after."""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.dirname(os.path.abspath(__file__)) + "/shots"
SITES = [
    ("onlineceramics", "https://online-ceramics.com", "a[href*='/products/']"),
    ("carpetcompany", "https://www.carpetco.us", "a[href*='/products/']"),
    ("braindead", "https://wearebraindead.com", "a[href*='/products/']"),
]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, url, sel in SITES:
        try:
            ctx = browser.new_context(viewport={"width":1280,"height":900}, user_agent=UA)
            page = ctx.new_page()
            page.goto(url, timeout=40000, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)
            page.keyboard.press("Escape")
            cards = page.locator(sel)
            card = None
            for i in range(min(cards.count(), 12)):
                c = cards.nth(i)
                try:
                    box = c.bounding_box()
                    if box and box["width"] > 120 and box["height"] > 120:
                        card = c; break
                except Exception:
                    continue
            if not card:
                print(f"{name}: no sizable card found"); ctx.close(); continue
            box = card.bounding_box()
            card.scroll_into_view_if_needed()
            page.wait_for_timeout(800)
            box = card.bounding_box()
            clip = {"x":max(box["x"]-20,0), "y":max(box["y"]-20,0), "width":min(box["width"]+40,1280), "height":min(box["height"]+80,900)}
            page.screenshot(path=f"{OUT}/{name}_card_normal.png", clip=clip)
            card.hover()
            page.wait_for_timeout(1200)
            page.screenshot(path=f"{OUT}/{name}_card_hover.png", clip=clip)
            print(f"{name}: hover pair captured ({int(box['width'])}x{int(box['height'])})")
            ctx.close()
        except Exception as e:
            print(f"{name}: ERROR {e}")
    browser.close()
