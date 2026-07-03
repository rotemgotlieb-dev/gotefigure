# Fable 5 design import brief — owner decisions (2026-07-02)

Source of truth for receiving the Claude Design (Fable 5) redesign into code.
Design project: https://claude.ai/design/p/c04d240a-ffe4-4b6e-aa7e-627d63f39b6e?file=GoteFigure+Store.dc.html
Scope for now: **the GoteFigure Store page only** (the main page). Other screens later.

## Goal

Get the design from Claude Design into code **perfectly 1:1** — layout, styling, button UIs,
and ALL animation behavior including the screen-to-screen transition animations. The design
mocks are the spec; code makes the motion real (HANDOFF.md division of labor still holds:
keep + reuse ink-button.ts / flood-nav.ts wherever they map onto the design's interactions).

## Design toggle settings (the .dc.html has variant switches — lock them as follows)

Owner gave the settings twice (2026-07-02, dictated) with two readings — CONFIRMED items are
consistent across both; CONFLICT items must be reconciled against the file's actual toggle
names and confirmed with the owner before implementing:

| Toggle in design | Setting | Status |
|---|---|---|
| Level 1 / Level 2 | **Level 2** | CONFIRMED (both messages) |
| Drip Style (button UI) | **ALWAYS ON, mode = STRAIGHT** — never "flow" | CONFIRMED (both messages) |
| Drop state | **LIVE** (the live-drop variant is the current/default state) | from msg 2 |
| Style: hand drawn | msg 1: "hand drawn, off" · msg 2: "style: hand drawn… on level 2" | CONFLICT — confirm |
| Live Art / Live Drawing | msg 1: "always off, not refined" · msg 2: "live drawing kept hand drawn" | CONFLICT — confirm |

Implement only the locked variants; the toggle machinery itself does NOT ship — the site is
built at these settings. (Keep the unused variants' code out of the bundle.) Exception: the
drop state (live / in-between) is not a design toggle to strip — it's a real runtime state the
owner switches via config.

## Drop-state model (new, must be built into the site)

The design has two site states: **LIVE DROP** and **IN-BETWEEN DROPS**. The website must
support both, switchable by the owner (content/config-driven, e.g. drops.json — no backend).
This is the monthly-cadence rarity model made concrete: during a drop the store sells; between
drops the site holds the room (tease/next-drop/vault energy per the design).

## Catalog control (owner requirement)

- Launching with **posters first**; shirts later (none made yet). Quality over quantity.
- The owner must have **explicit control over what products show and how many items are in
  the store** — curation is manual, never "render everything Fourthwall returns."
  Implementation direction: the overlay/content layer is an allowlist — a product appears
  only if the owner lists it (order + visibility owner-controlled).

## Import status

- 2026-07-02: DesignSync fetch blocked on claude.ai login (design scopes); no local .dc.html
  copy exists. Waiting on owner auth (/login in this workspace) or a manual export of
  `GoteFigure Store.dc.html` dropped into the repo.
