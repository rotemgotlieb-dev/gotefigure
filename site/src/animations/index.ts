// Single motion entry — imported once by the Layout. Modules self-register; the core
// manager wires astro:page-load/before-swap lifecycles (§7.6.6).
import { startMotion } from './core';
import { initFloodNav } from './flood-nav';
import './the-wink';
import './scroll-life';
import './micro';
import './ink-trail';
import './ink-button';
import './boil';
import './scroll-draw';

startMotion();
initFloodNav();
