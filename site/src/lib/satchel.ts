// The Satchel — design-exact bag store (GoteFigure Store.dc.html store logic, lines 1894-1913).
// localStorage 'gf3-cart'; rows {key,id,size,qty}. Events: 'gf:cart' on change, 'gf:drawer' open/close.
// Mock-mode "Seal the order" clears the bag → sealed ritual (prototype — nothing is charged).
// Fourthwall flip later: seal() redirects to hosted checkout instead (adapter in lib/commerce/).

export interface SatchelRow { key: string; id: string; size: string | null; qty: number; }

const KEY = 'gf3-cart';

function read(): SatchelRow[] {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(c) ? c : [];
  } catch { return []; }
}
function write(rows: SatchelRow[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* private mode */ }
  dispatchEvent(new CustomEvent('gf:cart', { detail: rows }));
}

export const satchel = {
  rows: read,
  count: () => read().reduce((a, r) => a + r.qty, 0),

  add(id: string, size?: string | null) {
    const key = id + (size ? ':' + size : '');
    const rows = read().map((r) => ({ ...r }));
    const hit = rows.find((r) => r.key === key);
    if (hit) hit.qty += 1; else rows.push({ key, id, size: size ?? null, qty: 1 });
    write(rows);
  },
  inc(key: string) { write(read().map((r) => (r.key === key ? { ...r, qty: r.qty + 1 } : r))); },
  dec(key: string) { write(read().map((r) => (r.key === key ? { ...r, qty: r.qty - 1 } : r)).filter((r) => r.qty > 0)); },
  remove(key: string) { write(read().filter((r) => r.key !== key)); },
  seal() { write([]); },

  open() { dispatchEvent(new CustomEvent('gf:drawer', { detail: 'open' })); },
  close() { dispatchEvent(new CustomEvent('gf:drawer', { detail: 'close' })); },
};
