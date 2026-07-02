# GoteFigure — Asset Kit + Integration Prompt for Claude Design
*Everything recovered/available, what to upload, and a high-level prompt for weaving it into the new site. 2026-06-13.*

## What to upload into your Design session (drag these in)
| File (in this repo) | What it is | Role in the new site |
|---|---|---|
| `assets-source/gotefigure-wordmark-clean.svg` | **The logo** — handwritten "Gote Figure", vectorized, transparent, infinitely scalable | Header logo; the hero mark that **draws itself in** on load |
| `assets-source/gotefigure-wordmark-ORIGINAL-transparent.png` | Same logo, raster (1046×492, transparent) | Fallback / quick reference if SVG misbehaves |
| `assets-source/gote-signature-CLEAN.png` | Short "Gote" signature (off the OG hoodie) | Casual signature mark, footer, packaging, sign-offs |
| `assets-source/og-2020-products/og-2020-contact-sheet.jpg` | **All 11 OG 2020 products in one image** | The "BACK FROM 2020" archive — design the era system around these |
| `assets-source/og-2020-products/og-product-*.jpg` | Individual OG product mockups (1024²) | Product cards for the OG era |
| Current art SVGs (`for NEW site/designs/`, repo `public/art/`) | nine-heads, silhouette, alien, rabbit, figure-2, mandala, glyphs | The living art — heroes, dividers, the category wall |

## The recovered OG 2020 catalog (your brand history, now usable)
These came back from the dead Shopify store's CDN. Several are designs that existed **nowhere else in the project** — treat them as recovered IP for the era system:
1. Rabbit/hare face — **pink** hoodie (this is the OG-pink context the spec reserves `#F27C8D` for)
2. Melted figures + teal monogram field — the `figure-2` flagship, OG version
3. Photo-print, two figures — *new*
4. Mushroom/toadstool ink
5. Alien creature head (teal/amber)
6. **The "Gote Figure" wordmark printed on an olive hoodie** — logo-as-product
7. Figure in an amber oval
8. Single continuous-line face — *new*
9. Photo-print, two figures (hoodie) — *new*
10. Two tribal mask faces — *new*
11. Blue cat + Abrabanel street sign — *new*

Note the recurring **teal monogram tile** (the repeating "GF" pattern behind #2) — extract it as a standalone background texture; it's a free brand pattern.

## Paste this as the integration prompt in Design
> I'm giving you the recovered original GoteFigure assets. Integrate them into the site like this, in priority order:
>
> 1. **Logo (gotefigure-wordmark-clean.svg):** Use as the header wordmark. On first load, make it **draw itself in stroke by stroke** (DrawSVG-style), like a pen writing on paper — not a fade. It's hand-drawn dry-brush; preserve that texture, never replace it with a clean font.
> 2. **OG 2020 archive:** Build a "BACK FROM 2020 / The Archive" section using the 11 recovered products (contact sheet attached). Present them as a *hall of past exhibitions* — gallery framing, era badge in the reserved pink (#F27C8D), several marked as history. This is the brand's origin story made visible, and it doubles as social proof.
> 3. **Era system:** Treat OG (2020) and New (2026) as a first-class, filterable attribute. OG pieces get the pink accent; new pieces get amber/teal. The melted-figure + teal-monogram design is the flagship that bridges both eras.
> 4. **Monogram texture:** Extract the repeating teal "GF" tile (behind the melted-figures design) and use it as a subtle, sparse background pattern that drifts on scroll — paper-grain energy, never loud.
> 5. **The art itself, big:** The current SVG drawings (nine-heads, silhouette, alien, rabbit, figure poster) are the heroes — show them at large scale as the centerpiece of pages, with ink-draw-on-scroll. Products are framed *by* the art, not the other way around.
>
> Keep everything on cream paper (#F2F1EA), ink black (#111111), amber CTAs (#F0A028), teal accents (#2AA79B). Pink (#F27C8D) ONLY on 2020-era contexts. Hand voice for headers, clean mono for prices/sizes. Start by showing me the header logo draw-in and the OG archive section.

## Notes
- The wordmark SVG comes in two cuts: `-clean` (smoother, 8 paths — use this, better for animation) and the textured 21-path version (`gotefigure-wordmark.svg`) if you ever want maximum brush grit.
- Originals on a hard drive (layered/vector) would still beat these traces for print — keep them. For web + animation, these are ready now.
