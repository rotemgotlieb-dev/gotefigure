// Scroll reveals (design _onIO/_reveal/_checkReveals): [data-rv="fade"] rises in,
// [data-rv="soak"] = the hero art clip-path pour. data-rv-d = per-element delay ms.
// IO threshold .16 plus a manual 88%-viewport pass (design parity).
import { defineModule } from './core';

defineModule('reveals', ({ reduced }) => {
  const els = new Set<HTMLElement>(document.querySelectorAll<HTMLElement>('[data-rv]'));
  if (!els.size) return;

  const reveal = (el: HTMLElement) => {
    if (el.dataset.rvDone) return;
    el.dataset.rvDone = '1';
    const kind = el.getAttribute('data-rv'), d = +(el.getAttribute('data-rv-d') || 0);
    const apply = () => {
      if (kind === 'soak') el.style.clipPath = 'inset(-3% -3% -3% -3%)';
      else { el.style.opacity = '1'; el.style.transform = 'none'; }
    };
    if (reduced || d === 0) setTimeout(apply, d);
    else setTimeout(apply, d);
    io.unobserve(el);
    els.delete(el);
  };

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) reveal(en.target as HTMLElement);
  }, { threshold: 0.16 });

  const check = () => {
    if (!els.size) return;
    const vh = innerHeight;
    for (const el of [...els]) {
      if (!el.isConnected) { els.delete(el); continue; }
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.88 && r.bottom > -40) reveal(el);
    }
  };

  if (reduced) { [...els].forEach(reveal); return; }

  els.forEach((el) => io.observe(el));
  const onScroll = () => check();
  addEventListener('scroll', onScroll, { passive: true });
  check();
  const t = setTimeout(check, 250);

  return () => {
    io.disconnect();
    removeEventListener('scroll', onScroll);
    clearTimeout(t);
  };
});
