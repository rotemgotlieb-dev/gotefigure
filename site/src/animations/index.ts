// Single motion entry — imported once by the Layout. Modules self-register; the core
// manager wires astro:page-load/before-swap lifecycles (§7.6.6).
import { startMotion } from './core';
import './the-wink';
import './scroll-life';
import './micro';

startMotion();
