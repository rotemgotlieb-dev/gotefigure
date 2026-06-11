// Boiling lines (owner request): the hand-drawn frames "simmer" — the line redraws
// itself ~6fps, classic squigglevision. Implementation is one html attribute stepping
// 0→1→2; every RoughFrame's CSS picks its variant. No filters, no per-element JS.
// Pauses when the tab is hidden; off entirely under reduced motion.
import { defineModule } from './core';

const STEP_MS = 165; // ~6fps — the animator's boil rate

defineModule('boil', ({ reduced }) => {
  if (reduced) return; // static variant 0 remains — drawn, just not simmering
  if (!document.querySelector('.rough-frame')) return;

  let i = 0;
  let timer = 0;

  const tick = () => {
    i = (i + 1) % 3;
    document.documentElement.dataset.boil = String(i);
  };
  const start = () => { if (!timer) timer = window.setInterval(tick, STEP_MS); };
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };

  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  start();

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVis);
    delete document.documentElement.dataset.boil;
  };
});
