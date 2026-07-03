// Store UI glue (design store logic, lines 1893-2018): size pills + pick-a-size guard,
// add-to-bag flows for hero/PDP ink CTAs, seal, tabs filter, PDP view thumbs, notify/subscribe.
import { defineModule } from './core';
import { satchel } from '../lib/satchel';

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
        if (!sizeSel) { errEls.forEach((el) => { el.hidden = false; }); return; }
        satchel.add('tee', sizeSel);
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

  // ---- notify / subscribe forms (prototype: success state only)
  for (const [formSel, doneSel] of [['[data-notify]', '[data-notified]'], ['[data-subscribe]', '[data-subscribed]']] as const) {
    const form = document.querySelector<HTMLFormElement>(formSel);
    const done = document.querySelector<HTMLElement>(doneSel);
    if (form && done) {
      const onSubmit = (e: Event) => { e.preventDefault(); form.hidden = true; done.hidden = false; };
      form.addEventListener('submit', onSubmit);
      destroys.push(() => form.removeEventListener('submit', onSubmit));
    }
  }

  return () => destroys.forEach((d) => d());
});
