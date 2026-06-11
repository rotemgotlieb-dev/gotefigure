# Phase 2 — Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. NOTE: owner protocol overrides the subagent default — execute manually.

**Goal:** `site/public/art/` populated with production, animation-ready art (SVGs + cleaned rasters + curated photos), each verified against its §4.1 technique (stroke-draw vs mask-wipe).

**Architecture:** Trace from existing PNGs/PDF (interim quality — every traced asset is re-exported when the .ai sources surface, tracked in `.claude/rules/assets.md`). Filled art → vtracer; B/W line art → potrace via PIL threshold; tiny decorative art (glyphs, eyes) → hand-authored SVG; photos → PIL fixes + copy into `site/src/assets/photos/` for Astro's build-time derivatives. SVGO everything in `public/art/`.

**Tech Stack:** potrace + pdf2svg (brew), vtracer (Python binding via pip — NO brew formula exists), PIL/Pillow 12, sips (macOS), SVGO v4 (pinned devDependency), vitest for asset-contract tests.

**Known trap (verified):** the root screenshot filenames contain a narrow no-break space (U+202F) before "AM" — typed ASCII paths will NOT match. Task 1 copies them to safe names; all later tasks use only the safe names.

**Spec:** `System_Architecture.md` §4.1–4.2, §7, §3.3. Source paths below are relative to repo root; commands run from repo root unless stated.

---

## Chunk 1: Toolchain, workbench, the two flagship SVGs

### Task 1: Install + verify toolchain, stage safe-named sources

- [ ] **Step 1: Install tools**

```bash
brew install potrace pdf2svg   # no-ops if present
pip3 install vtracer            # Python binding; the CLI has no brew formula
```

- [ ] **Step 2: Confirm tools**

Run: `potrace --version | head -1 && pdf2svg 2>&1 | head -1 && python3 -c "import vtracer, PIL; print('vtracer py OK, PIL', PIL.__version__)"`
Expected: potrace version, pdf2svg usage line, `vtracer py OK, PIL 12.x`. If anything missing, STOP and report.

- [ ] **Step 3: Create workbench + output dirs; stage screenshot sources under safe names (U+202F trap)**

```bash
mkdir -p assets-source/work site/public/art site/src/assets/photos
printf '\nassets-source/work/\n' >> .gitignore
python3 - <<'EOF'
import glob, shutil
for pat, dst in [('Screenshot*12.32.28*.png', 'nine-heads-src.png'),
                 ('Screenshot*12.31.14*.png', 'mandala-src.png')]:
    src = glob.glob(pat)[0]
    shutil.copy(src, f'assets-source/work/{dst}')
    print(dst, '<-', repr(src))
EOF
```

Expected: both copies print. (`assets-source/work/` = intermediates, never committed; `site/public/art/` = production files served as-is; `site/src/assets/photos/` = photos Astro optimizes at build.)

- [ ] **Step 4: Commit**

```bash
git add .gitignore && git commit -m "chore: asset workbench dirs, ignore intermediates"
```

### Task 2: Pink silhouette → `art/silhouette.svg` (mask-wipe class)

Source: `for NEW site/designs/double pink fig reflection.png` (single salmon color, transparent bg).

- [ ] **Step 1: Binarize alpha then trace single color**

```bash
python3 - <<'EOF'
from PIL import Image
im = Image.open('for NEW site/designs/double pink fig reflection.png')
# alpha → black art on white: potrace-ready bitmap
bg = Image.new('L', im.size, 255)
bg.paste(0, mask=im.getchannel('A').point(lambda a: 255 if a > 128 else 0))
bg.save('assets-source/work/silhouette.pbm')
EOF
potrace assets-source/work/silhouette.pbm -s -o site/public/art/silhouette.svg --flat -t 8
```

Expected: `silhouette.svg` exists. (`-s` SVG, `--flat` single <path>, `-t 8` speckle suppression.)

- [ ] **Step 2: Recolor + verify structure**

```bash
python3 - <<'EOF'
import re
p = 'site/public/art/silhouette.svg'
s = open(p).read()
s = s.replace('fill="#000000"', 'fill="currentColor"')  # recolorable via CSS (§3.3 marquee recolors per section)
open(p, 'w').write(s)
print('paths:', s.count('<path'), '| currentColor:', 'currentColor' in s, '| viewBox:', 'viewBox' in s)
EOF
```

Expected: paths ≥ 1, currentColor True, viewBox True.

- [ ] **Step 3: Commit**

```bash
git add site/public/art/silhouette.svg && git commit -m "feat(art): silhouette SVG (currentColor, mask-wipe class)"
```

### Task 3: Nine-head lineup → `art/nine-heads.svg` (hero; mask-wipe class, centerline = stretch)

Source: `Screenshot 2026-06-11 at 12.32.28 AM.png` (black ink on white, ~960px — interim until .ai).

- [ ] **Step 1: Threshold + trace**

```bash
python3 - <<'EOF'
from PIL import Image
im = Image.open('assets-source/work/nine-heads-src.png').convert('L')
im.point(lambda v: 0 if v < 160 else 255).save('assets-source/work/nine-heads.pbm')
EOF
potrace assets-source/work/nine-heads.pbm -s -o site/public/art/nine-heads.svg -t 4
```

Note: this is a FILLED trace + mask-wipe class — a recorded deviation from ROADMAP's "centerline/stroke" wording (true centerline tracing needs the .ai sources or autotrace experimentation = stretch goal). Task 8 Step 5 records this in assets.md and rewords the ROADMAP box when checking it.

Expected: file exists; potrace exits 0.

- [ ] **Step 2: Verify trace quality programmatically**

```bash
python3 - <<'EOF'
s = open('site/public/art/nine-heads.svg').read()
n = s.count('<path')
print('paths:', n, '| bytes:', len(s))
assert n >= 1 and len(s) < 400_000, 'unexpected structure'
EOF
```

Expected: prints counts; no assertion error. (Right-edge ear crop noted in §4.1 — acceptable interim; flag stays in assets.md.)

- [ ] **Step 3: Eyeball once in browser (≤1 screenshot), commit**

Open the SVG file directly in a Playwright page, screenshot element-scoped, confirm the nine heads read cleanly at 1200px wide. Then:

```bash
git add site/public/art/nine-heads.svg && git commit -m "feat(art): nine-head lineup SVG (interim trace, hero source)"
```

## Chunk 2: Logo set, hand-authored minis, figure 2, photos, verification

### Task 4: Alien logo → flat SVG + favicon + textured raster

Source: `for NEW site/designs/alien LOGO.profile-01.png` (multicolor, scribble fill, transparent).

- [ ] **Step 1: Color trace for the flat SVG (downscale first — 22.7MP is too heavy for vtracer; then add the missing viewBox: vtracer emits only width/height)**

```bash
python3 - <<'EOF'
from PIL import Image
import vtracer, re

im = Image.open('for NEW site/designs/alien LOGO.profile-01.png')
im.thumbnail((1800, 1800))
im.save('assets-source/work/alien-1800.png')
vtracer.convert_image_to_svg_py('assets-source/work/alien-1800.png', 'site/public/art/alien.svg',
                                colormode='color', mode='spline', filter_speckle=8)

def add_viewbox(p):  # vtracer emits width/height only — viewBox is the scaling contract
    s = open(p).read()
    m = re.search(r'width="(\d+)" height="(\d+)"', s)
    if 'viewBox' not in s and m:
        s = s.replace(m.group(0), f'{m.group(0)} viewBox="0 0 {m.group(1)} {m.group(2)}"', 1)
        open(p, 'w').write(s)
    return s

s = add_viewbox('site/public/art/alien.svg')
print('paths:', s.count('<path'), '| bytes:', len(s), '| viewBox:', 'viewBox' in s)
assert s.count('<path') >= 3 and 'viewBox' in s
EOF
```

Expected: multi-path color SVG with viewBox, size sane (<300KB pre-SVGO).

- [ ] **Step 2: Favicon — simplified flat version (same viewBox post-process)**

```bash
python3 - <<'EOF'
from PIL import Image
import vtracer, re
im = Image.open('for NEW site/designs/alien LOGO.profile-01.png')
im.thumbnail((128, 128))
im.save('assets-source/work/alien-128.png')
vtracer.convert_image_to_svg_py('assets-source/work/alien-128.png', 'site/public/favicon.svg',
                                colormode='color', mode='polygon', filter_speckle=4)
s = open('site/public/favicon.svg').read()
m = re.search(r'width="(\d+)" height="(\d+)"', s)
if 'viewBox' not in s and m:
    open('site/public/favicon.svg', 'w').write(
        s.replace(m.group(0), f'{m.group(0)} viewBox="0 0 {m.group(1)} {m.group(2)}"', 1))
print('favicon ok')
EOF
```

Expected: `site/public/favicon.svg` overwritten with the alien mark + viewBox (Layout already links /favicon.svg).

- [ ] **Step 3: Textured display raster (keeps the scribble charm §4.1)**

```bash
python3 - <<'EOF'
from PIL import Image
im = Image.open('for NEW site/designs/alien LOGO.profile-01.png')
im.thumbnail((1600, 1600))
im.save('site/public/art/alien-textured.webp', quality=88)
EOF
```

- [ ] **Step 4: Commit**

```bash
git add site/public/art/alien.svg site/public/art/alien-textured.webp site/public/favicon.svg
git commit -m "feat(art): alien logo — flat SVG, alien favicon, textured raster"
```

### Task 5: Hand-authored minis — stitch glyphs, rabbit eyes, mandala spinner

- [ ] **Step 1: Stitch glyph set (stroked → true DrawSVG class)**

Create `site/public/art/glyphs.svg` (symbol sprite, stroked paths, hand-wobble in the geometry):

```xml
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="g-plus" viewBox="0 0 24 24"><path d="M12.3 4.2 Q11.8 12 12.1 19.8 M4.4 12.2 Q12 11.6 19.6 12.1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="g-equal" viewBox="0 0 24 24"><path d="M5 9.2 Q12 8.7 19.2 9.1 M4.8 15.1 Q12 14.6 19 15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="g-hash" viewBox="0 0 24 24"><path d="M9.2 4.5 Q8.8 12 9 19.5 M15.1 4.3 Q14.7 12 14.9 19.6 M4.5 9.3 Q12 8.9 19.5 9.1 M4.3 15 Q12 14.7 19.6 14.9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
  <symbol id="g-x" viewBox="0 0 24 24"><path d="M5.5 5.8 Q12 11.6 18.6 18.3 M18.2 5.4 Q11.9 12 5.7 18.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="g-dot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1" fill="currentColor"/></symbol>
</svg>
```

- [ ] **Step 2: Rabbit eyes (interactive component source — pupils are separate elements for cursor tracking §7.5)**

Create `site/public/art/rabbit-eyes.svg`: two mismatched white ellipses with ink outlines (left larger, both hand-wobbled), each containing a `<circle class="pupil">` (ink fill, off-center). Reference palette: whites #FFFFFF, outline #111111, per OG rabbit art. Keep ids `eye-l`, `eye-r`, `pupil-l`, `pupil-r`.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 110">
  <g id="eye-l"><ellipse cx="62" cy="56" rx="44" ry="48" fill="#fff" stroke="#111" stroke-width="5"/><circle id="pupil-l" class="pupil" cx="74" cy="62" r="15" fill="#111"/></g>
  <g id="eye-r"><ellipse cx="150" cy="52" rx="36" ry="42" fill="#fff" stroke="#111" stroke-width="5"/><circle id="pupil-r" class="pupil" cx="142" cy="44" r="11" fill="#111"/></g>
</svg>
```

- [ ] **Step 3: Mandala spinner (loading, §4.1: snapped 90° rotation)**

```bash
python3 - <<'EOF'
import vtracer, re
vtracer.convert_image_to_svg_py('assets-source/work/mandala-src.png', 'site/public/art/mandala.svg',
                                colormode='color', mode='spline', filter_speckle=4)
p = 'site/public/art/mandala.svg'; s = open(p).read()
m = re.search(r'width="(\d+)" height="(\d+)"', s)
if 'viewBox' not in s and m:
    s = s.replace(m.group(0), f'{m.group(0)} viewBox="0 0 {m.group(1)} {m.group(2)}"', 1)
    open(p, 'w').write(s)
assert s.count('<path') >= 2 and 'viewBox' in s; print('ok, bytes:', len(s))
EOF
```

(Low-res source is fine — spinner renders ≤96px.)

- [ ] **Step 4: Commit**

```bash
git add site/public/art/glyphs.svg site/public/art/rabbit-eyes.svg site/public/art/mandala.svg
git commit -m "feat(art): stitch glyph sprite, interactive rabbit eyes, mandala spinner"
```

### Task 6: figure 2 — true vector extraction + poster preview

- [ ] **Step 1: PDF → SVG (real vectors, no tracing)**

```bash
pdf2svg "figure 2.pdf" site/public/art/figure-2.svg 1
python3 -c "s=open('site/public/art/figure-2.svg').read(); print('bytes:', len(s), '| paths:', s.count('<path'))"
```

Expected: vector SVG with many paths. If pdf2svg emits font/raster fallbacks, note it and keep — display quality is what matters.

- [ ] **Step 2: Raster poster preview (for shop card / PDP until Fourthwall mockups)**

```bash
sips -s format png --resampleWidth 1600 "figure 2.pdf" --out assets-source/work/figure-2.png >/dev/null
python3 - <<'EOF'
from PIL import Image
Image.open('assets-source/work/figure-2.png').save('site/src/assets/photos/figure-2-poster.webp', quality=88)
EOF
```

- [ ] **Step 3: Commit**

```bash
git add site/public/art/figure-2.svg site/src/assets/photos/figure-2-poster.webp
git commit -m "feat(art): figure 2 — true vector SVG + poster preview"
```

### Task 7: Photo prep (PIL fixes + curated copies)

- [ ] **Step 1: Web Hero 3 — bake EXIF rotation; OG Rabbit 02 — crop cleanups**

```bash
python3 - <<'EOF'
from PIL import Image, ImageOps
# Web Hero 3: bake orientation (EXIF orientation 6 → upright PORTRAIT 3024x4032, verified)
im = ImageOps.exif_transpose(Image.open('for NEW site/marketing/Web Hero 3.jpg'))
im.save('site/src/assets/photos/hero-sunset-marina.webp', quality=86)
print('hero size:', im.size)
# OG Rabbit 02 defects (§4.1): gold scribble overlaps the left ear, so a band crop would
# amputate ear tips (verified) — remove gold by COLOR in the top-left region instead;
# crop only the bottom black bar.
r = Image.open('for NEW site/designs/OG Rabbit 02.png').convert('RGBA')
w, h = r.size
px = r.load()
for y in range(int(h*0.18)):
    for x in range(int(w*0.55)):
        pr, pg, pb, pa = px[x, y]
        if pa > 0 and pr > 140 and pg > 100 and pb < 110 and pr > pb + 60:  # gold/ochre strokes
            px[x, y] = (0, 0, 0, 0)
r.crop((0, 0, w, h - int(h*0.02))).save('site/public/art/rabbit-stipple.png')
print('rabbit cleaned, gold removed in top-left region')
EOF
```

Expected: hero size prints **(3024, 4032) — upright portrait**; rabbit written. **Eyeball both once** (≤2 views): gold scribble gone with ear tips intact, bottom bar gone, marina photo upright. If the gold threshold misses strokes, widen the color window and re-run.

- [ ] **Step 2: Curate remaining photos (§4.2 keep-list)**

```bash
python3 - <<'EOF'
from PIL import Image, ImageOps
keep = {
  'for NEW site/marketing/profile pic.jpg': 'hero-nine-eyes-sunset.webp',
  'for NEW site/marketing/post 2.jpg': 'alien-tee-duo-cliffs.webp',
  'for NEW site/marketing/Alien tee-2.jpg': 'alien-tee-boat.webp',
  'for NEW site/marketing/trippy tee 01.jpg': 'swirl-tee-lake.webp',
  'for NEW site/marketing/mushroom tee 02.jpg': 'mushroom-tee-sea.webp',
  'for NEW site/marketing/boat 1-3.jpg': 'boatday-1.webp',
  'for NEW site/marketing/boat 2-2.jpg': 'boatday-2.webp',
  'for NEW site/marketing/Web Hero 2.jpg': 'trail-walk-duo.webp',
}
for src, dst in keep.items():
    im = ImageOps.exif_transpose(Image.open(src))
    im.thumbnail((2400, 2400))
    im.save(f'site/src/assets/photos/{dst}', quality=86)
    print(dst, im.size)

# IMG_3126-2: §4.2 keep with "crop above waist" — keep the upper ~62% (prints + canyon)
im = ImageOps.exif_transpose(Image.open('for NEW site/marketing/IMG_3126-2.jpg'))
im = im.crop((0, 0, im.width, int(im.height * 0.62)))
im.thumbnail((2400, 2400))
im.save('site/src/assets/photos/boatday-prints.webp', quality=86)
print('boatday-prints.webp', im.size)

# OG Rabbit pink cameo (§4.1 about/cameo art): display raster
im = Image.open('for NEW site/designs/OG rabbit pink backround.png')
im.thumbnail((1600, 1600))
im.save('site/public/art/rabbit-cameo.webp', quality=88)
print('rabbit-cameo.webp', im.size)

# "Gote" handwritten signature (§4.2 extract → §3.2 logotype source): crop bottom-right
# of the stock mockup; tracing to SVG logotype happens with the hand-lettering work (Phase 5)
im = Image.open('for NEW site/marketing/pullover-hoodie-mockup-of-a-young-woman-wearing-jeans-2827-el1.png')
im.crop((int(im.width*0.55), int(im.height*0.86), im.width, im.height)).save('assets-source/gote-signature-crop.png')
print('gote-signature-crop.png saved (source extract, not production)')
EOF
```

Expected: 9 webp photos + rabbit-cameo.webp + the signature source crop (booty.png + mirror selfies excluded per §4.2; the mockup is used ONLY for the signature extract). **Eyeball the signature crop once** — if the crop window missed the handwriting, adjust percentages and re-run.

- [ ] **Step 3: Commit**

```bash
git add site/src/assets/photos site/public/art/rabbit-stipple.png
git commit -m "feat(art): photo prep — hero rotation baked, rabbit cleanup, curated webp set"
```

### Task 8: SVGO pass + asset-contract tests + docs

- [ ] **Step 1: SVGO the TRACED SVGs only (pin svgo; v4 config; NEVER run it on the hand-authored minis)**

Verified hazard: svgo's preset-default wipes `glyphs.svg` to 0 bytes (display:none root + unreferenced symbols → removed entirely). The hand-authored files (`glyphs.svg`, `rabbit-eyes.svg`) are already minimal — optimize only the traced ones, per file.

```bash
cd site && npm install -D svgo && cd ..
```

Create `site/svgo.config.mjs` (v4: viewBox is kept by default; only ids need protecting):

```js
export default {
  multipass: true,
  plugins: [
    { name: 'preset-default', params: { overrides: { cleanupIds: false } } },
  ],
};
```

Run:
```bash
cd site && for f in silhouette nine-heads alien mandala figure-2; do npx svgo public/art/$f.svg; done && npx svgo public/favicon.svg && cd ..
```
Expected: size reductions reported per file, no errors, no file reduced to ~0 bytes.

- [ ] **Step 2: Write asset-contract tests — `site/tests/assets.test.ts`**

```ts
// §4.1 contract: every production asset exists, parses, and matches its animation class.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const art = (f: string) => join(__dirname, '..', 'public', 'art', f);
const read = (f: string) => readFileSync(art(f), 'utf8');

describe('production art exists and is non-trivial', () => {
  it.each(['silhouette.svg', 'nine-heads.svg', 'alien.svg', 'glyphs.svg',
           'rabbit-eyes.svg', 'mandala.svg', 'figure-2.svg', 'rabbit-stipple.png',
           'rabbit-cameo.webp', 'alien-textured.webp'])('%s', (f) => {
    expect(existsSync(art(f))).toBe(true);
    expect(statSync(art(f)).size).toBeGreaterThan(200); // floor catches silent optimizer wipes
  });
});

describe('animation-class contracts (§4.1)', () => {
  it('glyphs are STROKED (true DrawSVG class)', () => {
    const s = read('glyphs.svg');
    expect(s).toContain('stroke="currentColor"');
    expect(s).toContain('fill="none"');
  });
  it('silhouette is filled currentColor (mask-wipe class, recolorable)', () => {
    const s = read('silhouette.svg');
    expect(s).toContain('currentColor');
    expect(s).not.toContain('fill="none"');
  });
  it('rabbit eyes expose pupil ids for cursor tracking (§7.5)', () => {
    const s = read('rabbit-eyes.svg');
    for (const id of ['pupil-l', 'pupil-r', 'eye-l', 'eye-r']) expect(s).toContain(`id="${id}"`);
  });
  it('every svg keeps its viewBox (scaling contract)', () => {
    for (const f of ['silhouette.svg', 'nine-heads.svg', 'alien.svg', 'mandala.svg',
                     'figure-2.svg', 'glyphs.svg', 'rabbit-eyes.svg'])
      expect(read(f)).toContain('viewBox');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd site && npm run verify; cd ..`
Expected: smoke + asset tests all PASS.

- [ ] **Step 4: Update `.claude/rules/assets.md`** — append the per-file inventory (path, source, class: stroke/mask-wipe/raster, interim-vs-final status) in ≤12 lines, INCLUDING the recorded deviation: nine-heads shipped as filled trace + mask-wipe (centerline = stretch pending .ai).

- [ ] **Step 5: Check Phase-2 boxes in ROADMAP.md — first reword its line "nine-head lineup (centerline/stroke)" to "nine-head lineup (filled trace + mask-wipe; centerline stretch)" so the checked box states what was actually built; commit**

```bash
git add site/tests/assets.test.ts site/svgo.config.mjs site/public/art .claude/rules/assets.md docs/superpowers/plans/ROADMAP.md
git commit -m "feat(art): SVGO pass, asset-contract tests, inventory docs — Phase 2 complete"
```

**Phase 2 exit (§11):** `public/art/` populated AND each asset matches its animation class per the contract tests + one browser eyeball of the two flagship SVGs. Items deferred with reasons recorded in assets.md: doodle-camo + wiggle-blob traces (too low-res for production — wait for .ai/re-export), teal pattern tile extraction (needs vector source), stipple-rabbit CONTOUR stroke path (hand-authored over the cleaned raster in Phase 4, where its scroll-draw is built), "Gote" signature tracing to logotype (Phase 5, with the owner's hand-lettering batch), figure-2.svg is 1.3MB — poster/PDP lazy-load only, never inlined in hero/layout, per-SKU product art for ⚠️ rows (§5 fallback at Fourthwall setup).
