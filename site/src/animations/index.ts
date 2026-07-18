// Single motion entry — imported once by the Layout. Modules self-register; core wires
// astro:page-load / astro:before-swap lifecycles (§7.6.6).
// v3 set (Fable 5 store): arrival intro, ink buttons, scroll brush-stroke, reveals, tiles,
// countdown, store UI. flood-nav binds once at import (global nav behavior).
// live-art.ts exists but is NOT imported — owner: Live Art stays off until refined.
import { startMotion } from './core';
import { initFloodNav } from './flood-nav';
import './arrival';
import './ink-button';
import './scroll-line';
import './reveals';
import './tiles';
import './countdown';
import './store-ui';
import './after-hours'; // no-ops unless the page has [data-room-stage] (the After Hours salon)
import './scroll-choreography'; // no-ops unless the page has [data-lights-up] (the Lights Up storefront)

startMotion();
initFloodNav();
