// Motion core (§7.6.6 lifecycle): every module registers init() that returns destroy().
// init runs on astro:page-load; ALL destroys run on astro:before-swap. With ClientRouter,
// module scripts execute once per session — this manager is what keeps animations alive
// and leak-free across client-side navigations.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const EASE_TRAVERSE = 'cubic-bezier(0.77, 0, 0.175, 1)';
export const EASE_ARRIVE = 'cubic-bezier(0.23, 1, 0.32, 1)';

type Destroy = () => void;
type Init = (ctx: { reduced: boolean }) => Destroy | void;

const modules: { id: string; init: Init }[] = [];
let destroys: Destroy[] = [];

export function defineModule(id: string, init: Init) {
  modules.push({ id, init });
}

export const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initAll() {
  const reduced = prefersReduced();
  for (const m of modules) {
    try {
      const d = m.init({ reduced });
      if (d) destroys.push(d);
    } catch (e) {
      console.error(`[gf-motion] ${m.id} init failed`, e);
    }
  }
}

function destroyAll() {
  for (const d of destroys.splice(0)) {
    try { d(); } catch { /* never block navigation */ }
  }
  ScrollTrigger.getAll().forEach((st) => st.kill());
}

export function startMotion() {
  initAll(); // first load (astro:page-load already fired or about to — guard below)
  document.addEventListener('astro:page-load', () => { destroyAll(); initAll(); });
  document.addEventListener('astro:before-swap', destroyAll);
}

// Loop gate (portfolio canon #8): run loops only when visible AND tab focused.
export function gateLoop(el: Element, start: () => void, stop: () => void): Destroy {
  let inView = false;
  const update = () => (inView && !document.hidden ? start() : stop());
  const io = new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    update();
  });
  io.observe(el);
  const onVis = () => update();
  document.addEventListener('visibilitychange', onVis);
  return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); stop(); };
}
