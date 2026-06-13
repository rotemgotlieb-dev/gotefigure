# GoteFigure — Vision prompt for Claude Design
*Paste this as the opening prompt. Attach: the art SVGs/scans, DESIGN-BRIEF.md, and the reference screenshots.*

---

Build a storefront that makes someone say "I've never seen this before." Not through gimmicks — through one committed idea executed obsessively:

**THE SITE BEHAVES LIKE WET INK ON PAPER. The whole page is a living sketchbook.**

This is an art-led clothing brand. The art is genuinely hand-drawn by one person. The site must feel hand-made, alive, and a little unpredictable — the opposite of a clean Shopify template. If it could be mistaken for a theme, it has failed.

## The through-line (apply everywhere)
- The background is cream paper (#F2F1EA), never white. It has subtle grain.
- Black ink (#111111) is the dominant voice. Amber (#F0A028) only for CTAs, teal (#2AA79B) for accents. (Pink #F27C8D is reserved — only on 2020 "OG archive" pieces.)
- Frames, underlines, and borders are **rough, jittery, hand-drawn** (rough.js style) and subtly *boil* — they're never perfectly straight.
- Headings are in a hand-lettered display voice. Prices, sizes, and buttons are clean mono — buying never gets hard to read.

## The signature moments (make these extraordinary)
1. **Scroll draws the page in.** As you scroll, line art doesn't fade in — it *draws itself* stroke by stroke (DrawSVG), like a pen moving across paper. Sections arrive like ink blooming when a wet brush touches the page (organic spread, not a fade).
2. **The cursor leaves ink.** A faint, fast-drying ink trail follows the cursor on desktop. The art reacts to presence.
3. **The art is the hero, huge.** Use the actual uploaded drawings at large scale as the centerpiece of the homepage — the nine-heads lineup, the silhouette, the rabbit. Not decoration around products — the art *is* the page.
4. **Product pages feel like museum placards.** A drawing presented like a gallery exhibit: max white space, the macro ink texture visible, a handwritten-style story of how it was made, price as a quiet number. Premium, reverent, never a retail grid.

## Hard rules
- transform/opacity-based motion only; every animation has a calm static version for reduced-motion users. Motion is garnish, never a gate to buying.
- Mobile-first — probe at 375px. The ink magic must degrade gracefully, never break the layout or push the buy button off-screen.
- No generic AI aesthetics: no Inter/Roboto, no purple gradients, no stock component patterns. Everything should look drawn, not generated.

## What I want to feel
Quiet confidence of a gallery + the warmth and imperfection of a sketchbook someone actually drew in. Surprising, tactile, human. When the page loads I want a small involuntary "oh — *this is cool*."

Start with the **homepage hero + one product page**. Show me the ink-draw-on-scroll and the placard PDP first — those carry the whole feeling.
