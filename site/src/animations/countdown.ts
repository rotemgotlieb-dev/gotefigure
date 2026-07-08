// Next-drop countdown — ticks every [data-count-*] group from the page's data-next-drop.
// Runs a 1s interval only while counters exist on the page (killed on swap by core).
import { defineModule } from './core';

defineModule('countdown', () => {
  const host = document.querySelector<HTMLElement>('[data-next-drop]');
  const dds = document.querySelectorAll<HTMLElement>('[data-count-dd]');
  if (!host || !dds.length) return;
  const target = Date.parse(host.dataset.nextDrop || '') || Date.now() + 23 * 864e5;
  const two = (n: number) => String(n).padStart(2, '0');

  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const dd = two(Math.floor(diff / 864e5));
    const hh = two(Math.floor(diff / 36e5) % 24);
    const mm = two(Math.floor(diff / 6e4) % 60);
    const ss = two(Math.floor(diff / 1e3) % 60);
    document.querySelectorAll<HTMLElement>('[data-count-dd]').forEach((el) => { el.textContent = dd; });
    document.querySelectorAll<HTMLElement>('[data-count-hh]').forEach((el) => { el.textContent = hh; });
    document.querySelectorAll<HTMLElement>('[data-count-mm]').forEach((el) => { el.textContent = mm; });
    document.querySelectorAll<HTMLElement>('[data-count-ss]').forEach((el) => { el.textContent = ss; });
  };
  tick();
  const t = setInterval(tick, 1000);
  return () => clearInterval(t);
});
