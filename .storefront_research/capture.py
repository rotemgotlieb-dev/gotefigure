#!/usr/bin/env python3
"""Capture homepage + product page screenshots of artist storefronts at 1280px and 375px."""
import sys, os, json, time, re
from playwright.sync_api import sync_playwright

OUT = os.path.dirname(os.path.abspath(__file__)) + "/shots"
os.makedirs(OUT, exist_ok=True)

SITES = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

CLOSE_SELECTORS = [
    "[aria-label*='lose' i]", ".klaviyo-close-form", "button.needsclick[aria-label]",
    ".popup-close", ".modal__close", "[data-micromodal-close]",
    "button:has-text('No thanks')", "button:has-text('Close')", "button:has-text('×')",
    "button:has-text('Accept')", "button:has-text('I agree')", "button:has-text('Enter')",
]

def dismiss_popups(page):
    try:
        page.keyboard.press("Escape")
    except Exception:
        pass
    for sel in CLOSE_SELECTORS:
        try:
            els = page.locator(sel)
            n = min(els.count(), 3)
            for i in range(n):
                el = els.nth(i)
                if el.is_visible(timeout=300):
                    el.click(timeout=800)
                    page.wait_for_timeout(300)
        except Exception:
            pass

def lazy_scroll(page, steps=6, dy=800):
    for _ in range(steps):
        try:
            page.mouse.wheel(0, dy)
            page.wait_for_timeout(450)
        except Exception:
            break
    try:
        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(800)
    except Exception:
        pass

def find_product_url(page, base):
    patterns = [r"/products/[^\"']+", r"/product/[^\"']+", r"/shop/p/[^\"']+", r"/collections/[^\"']+/products/[^\"']+"]
    try:
        hrefs = page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
    except Exception:
        return None
    for pat in patterns:
        for h in hrefs:
            if re.search(pat, h) and base.split("//")[1].split("/")[0].replace("www.","") in h:
                return h
    # fallback: try a /collections or /shop link, then re-scan
    for h in hrefs:
        if re.search(r"/(collections|shop|store)(/|$)", h):
            try:
                page.goto(h, timeout=25000, wait_until="domcontentloaded")
                page.wait_for_timeout(2500)
                hrefs2 = page.eval_on_selector_all("a[href]", "els => els.map(e => e.href)")
                for pat in patterns:
                    for h2 in hrefs2:
                        if re.search(pat, h2):
                            return h2
            except Exception:
                pass
            break
    return None

def shoot(page, path, full=False, clip_h=None):
    try:
        if clip_h:
            page.screenshot(path=path, full_page=True, clip={"x":0,"y":0,"width":page.viewport_size["width"],"height":clip_h})
        else:
            page.screenshot(path=path, full_page=full)
        return True
    except Exception as e:
        try:
            page.screenshot(path=path)  # last resort viewport shot
            return True
        except Exception:
            print(f"  SHOT FAIL {path}: {e}")
            return False

def run_site(p, name, url):
    print(f"=== {name} ({url})")
    results = {"name": name, "url": url}
    browser = p.chromium.launch(headless=True)
    try:
        # ---- desktop
        ctx = browser.new_context(viewport={"width":1280, "height":900}, user_agent=UA, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(url, timeout=40000, wait_until="domcontentloaded")
        page.wait_for_timeout(4500)
        dismiss_popups(page)
        page.wait_for_timeout(800)
        shoot(page, f"{OUT}/{name}_home_desktop_fold.png")            # first viewport
        lazy_scroll(page)
        dismiss_popups(page)
        shoot(page, f"{OUT}/{name}_home_desktop_full.png", clip_h=3200)  # top 3200px
        prod = find_product_url(page, url)
        results["product_url"] = prod
        if prod:
            page.goto(prod, timeout=40000, wait_until="domcontentloaded")
            page.wait_for_timeout(3500)
            dismiss_popups(page)
            shoot(page, f"{OUT}/{name}_product_desktop.png", clip_h=2200)
        ctx.close()
        # ---- mobile
        ctx = browser.new_context(viewport={"width":375, "height":812}, user_agent=UA.replace("Macintosh; Intel Mac OS X 10_15_7","iPhone; CPU iPhone OS 17_0 like Mac OS X"), is_mobile=True, has_touch=True, device_scale_factor=2)
        page = ctx.new_page()
        page.goto(url, timeout=40000, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        dismiss_popups(page)
        shoot(page, f"{OUT}/{name}_home_mobile.png", clip_h=2400)
        if prod:
            page.goto(prod, timeout=40000, wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            dismiss_popups(page)
            shoot(page, f"{OUT}/{name}_product_mobile.png", clip_h=2000)
        ctx.close()
        print(f"  OK  product={prod}")
    except Exception as e:
        print(f"  ERROR {name}: {e}")
        results["error"] = str(e)
    finally:
        browser.close()
    return results

def main():
    all_results = []
    with sync_playwright() as p:
        for name, url in SITES:
            all_results.append(run_site(p, name, url))
    print(json.dumps(all_results, indent=1))

if __name__ == "__main__":
    main()
