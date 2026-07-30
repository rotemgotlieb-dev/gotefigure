// Store UI glue (design store logic, lines 1893-2018): size pills + pick-a-size guard,
// add-to-bag flows for hero/PDP ink CTAs, seal, tabs filter, PDP view thumbs, and the REAL
// waitlist capture (the old notify/subscribe handlers faked success and stored nothing,
// the same silent email-loss class this repo paid for twice; now they post to
// /api/subscribe through the shared hardened helper, source 'drops').
import { defineModule } from './core';
import { satchel } from '../lib/satchel';
import { wireEmailCapture } from '../lib/email-capture';

defineModule('store-ui', () => {
  const destroys: (() => void)[] = [];
  let sizeSel: string | null = null;

  // ---- size pills
  const sizeWraps = [...document.querySelectorAll<HTMLElement>('[data-sizes]')];
  for (const wrap of sizeWraps) {
    const onClick = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-size]');
      if (!b) return;
      sizeSel = b.dataset.size || null;
      wrap.querySelectorAll('[data-size]').forEach((el) => el.setAttribute('aria-pressed', el === b ? 'true' : 'false'));
      document.querySelectorAll<HTMLElement>('[data-size-error]').forEach((el) => { el.hidden = true; });
    };
    wrap.addEventListener('click', onClick);
    destroys.push(() => wrap.removeEventListener('click', onClick));
  }

  // ---- add / seal on ink CTAs
  const onDocClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-ink-btn]');
    if (!btn) return;
    const add = btn.getAttribute('data-add');
    if (add) {
      const errEls = document.querySelectorAll<HTMLElement>('[data-size-error]');
      if (add === 'hero') {
        // The hero piece id is data-driven (data-hero-id on the page), never hardcoded:
        // the old literal 'tee' broke the moment the real catalog landed.
        const heroId = document.querySelector<HTMLElement>('[data-hero-id]')?.dataset.heroId;
        if (!heroId) return;
        if (!sizeSel) { errEls.forEach((el) => { el.hidden = false; }); return; }
        satchel.add(heroId, sizeSel);
      } else if (add === 'pdp') {
        const page = document.querySelector<HTMLElement>('[data-piece-page]');
        const id = page?.dataset.pieceId || '';
        const sized = page?.dataset.sized === '1';
        if (sized && !sizeSel) { errEls.forEach((el) => { el.hidden = false; }); return; }
        satchel.add(id, sized ? sizeSel : null);
      } else {
        satchel.add(add);
      }
      satchel.open();
    } else if (btn.hasAttribute('data-seal')) {
      dispatchEvent(new CustomEvent('gf:sealed'));
    }
  };
  document.addEventListener('click', onDocClick);
  destroys.push(() => document.removeEventListener('click', onDocClick));

  // ---- tabs filter (click active tab again = show all)
  const tabs = document.querySelector<HTMLElement>('[data-tabs]');
  if (tabs) {
    let filter: 'all' | 'wear' | 'paper' = 'all';
    const applyFilter = () => {
      tabs.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === filter ? 'true' : 'false'));
      document.querySelectorAll<HTMLElement>('.cell[data-cat]').forEach((c) => {
        c.hidden = filter !== 'all' && c.dataset.cat !== filter;
      });
    };
    const onTab = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (!b) return;
      const f = b.dataset.tab as 'wear' | 'paper';
      filter = filter === f ? 'all' : f;
      applyFilter();
    };
    tabs.addEventListener('click', onTab);
    destroys.push(() => tabs.removeEventListener('click', onTab));
  }

  // ---- PDP view thumbs
  const thumbs = document.querySelector<HTMLElement>('[data-thumbs]');
  if (thumbs) {
    const onThumb = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-thumb]');
      if (!b) return;
      const view = b.dataset.thumb;
      thumbs.querySelectorAll<HTMLElement>('[data-thumb]').forEach((el) => el.setAttribute('aria-pressed', el === b ? 'true' : 'false'));
      document.querySelectorAll<HTMLElement>('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== view; });
    };
    thumbs.addEventListener('click', onThumb);
    destroys.push(() => thumbs.removeEventListener('click', onThumb));
  }

  // ---- waitlist / knock forms: REAL capture through /api/subscribe (server-side Turnstile
  // + gf_hp honeypot + allowlisted source; done-state only on a true {ok:true}). Same
  // storage key as the /about form so one signup reads as done across surfaces.
  document.querySelectorAll<HTMLElement>('[data-store-capture]').forEach((root) => {
    destroys.push(wireEmailCapture(root, { source: 'drops', storageKey: 'gf-drops-email' }));
  });

  return () => destroys.forEach((d) => d());
});
