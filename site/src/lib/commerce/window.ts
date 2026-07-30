// Pre-sale window state machine (docs/PRESALE-WINDOW-DESIGN.md). Pure and config-driven:
// three honest phases derived from content/drop.json, no countdowns, no numeric scarcity.
// Decisions of record: $40 list / $35 waitlist (vault Projects/GoteFigure.md:27, 2026-07-23,
// "if you join the waitlist, you get it for $35", never percent-off framing); window is
// T-0 through T+13; post-window sells what remains at list until gone, then vaults; sold-out
// copy only when true (boolean flag, never a synthetic count - WNM Plan line 87).
//
// CALL PHASE PER REQUEST. The gated store pages render on the Worker (prerender=false); a
// long-lived isolate must not cache a phase across the opensAt/closesAt boundaries, so pages
// call windowPhase(...) in frontmatter, never import a module-scope constant.

export type WindowPhase = 'pre' | 'open' | 'post';

export interface WindowConfig {
  /** ISO-8601 with explicit offset, or null while T-0 is honestly unpicked. */
  opensAt: string | null;
  /** ISO-8601 with explicit offset; required whenever opensAt is set. */
  closesAt: string | null;
}

export interface Pricing {
  list: number;
  waitlist: number;
}

/**
 * Validate the owner-edited config, failing the VERIFY SUITE loudly on dishonest
 * states (fail-loud ethos, same as the provider seam's own guards). Measured
 * 2026-07-29: astro build alone prints per-page errors but exits 0 with zero-byte
 * pages, so the deploy script runs vitest first; the test suite is the real gate.
 */
export function validateWindowConfig(raw: unknown): WindowConfig {
  const cfg = (raw ?? {}) as Partial<WindowConfig>;
  const opensAt = cfg.opensAt ?? null;
  const closesAt = cfg.closesAt ?? null;
  if (opensAt === null && closesAt === null) return { opensAt, closesAt };
  if (opensAt === null || closesAt === null) {
    throw new Error(
      'drop.json window: opensAt and closesAt must be set TOGETHER (the decided window is T-0 through T+13) - see docs/PRESALE-WINDOW-DESIGN.md',
    );
  }
  const open = Date.parse(opensAt);
  const close = Date.parse(closesAt);
  if (Number.isNaN(open) || Number.isNaN(close)) {
    throw new Error('drop.json window: opensAt/closesAt must be ISO-8601 datetimes with an explicit offset');
  }
  if (close <= open) {
    throw new Error('drop.json window: closesAt must be after opensAt');
  }
  return { opensAt, closesAt };
}

export function validatePricing(raw: unknown): Pricing {
  const p = (raw ?? {}) as Partial<Pricing>;
  if (typeof p.list !== 'number' || typeof p.waitlist !== 'number' || p.list <= 0 || p.waitlist <= 0) {
    throw new Error('drop.json pricing: list and waitlist must be positive numbers (decided: 40 / 35, Projects/GoteFigure.md:27)');
  }
  return { list: p.list, waitlist: p.waitlist };
}

/** The three honest states. opensAt unset = pre (nothing is claimed, nothing is sold). */
export function windowPhase(cfg: WindowConfig, nowMs: number = Date.now()): WindowPhase {
  if (cfg.opensAt === null || cfg.closesAt === null) return 'pre';
  const open = Date.parse(cfg.opensAt);
  const close = Date.parse(cfg.closesAt);
  if (nowMs < open) return 'pre';
  if (nowMs < close) return 'open';
  return 'post';
}

/** Is a piece purchasable in this phase? Boolean sold-out only; counts never exist here. */
export function purchasable(phase: WindowPhase, soldOut: boolean): boolean {
  if (soldOut) return false;
  return phase === 'open' || phase === 'post';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Plain date label ("Aug 12") or null when the date is honestly unset. Never a ticker. */
export function dateLabel(iso: string | null): string | null {
  if (iso === null) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * The honesty-critical copy lines, centralized so tests pin them: the waitlist price is said
 * loudly and in dollars (never percent-off), sold-out language exists only behind the flag,
 * and no line contains countdown language.
 */
export function windowCopy(phase: WindowPhase, cfg: WindowConfig, pricing: Pricing) {
  const opens = dateLabel(cfg.opensAt);
  const closes = dateLabel(cfg.closesAt);
  const waitlistLine = `join the waitlist, you get it for $${pricing.waitlist}`;
  if (phase === 'pre') {
    return {
      headline: opens ? `The window opens ${opens}` : 'The window opens when the ink is ready',
      status: opens ? `pre-order window opens ${opens}` : 'pre-order window opens soon',
      waitlistLine,
      priceLine: `$${pricing.list} list. ${waitlistLine}.`,
    };
  }
  if (phase === 'open') {
    return {
      headline: closes ? `The window is open through ${closes}` : 'The window is open',
      status: closes ? `pre-order window open, closes ${closes}` : 'pre-order window open',
      waitlistLine,
      priceLine: `$${pricing.list} list. ${waitlistLine}.`,
    };
  }
  return {
    headline: 'The window has closed',
    status: 'window closed, selling what remains',
    waitlistLine,
    priceLine: `$${pricing.list} while it lasts. then it is vaulted.`,
  };
}

/** Per-piece scarcity line: true states only, no numbers ever. */
export function scarcityLine(phase: WindowPhase, soldOut: boolean): string {
  if (soldOut) return 'sold out. vaulted, never reprinted';
  if (phase === 'pre') return 'the window has not opened yet';
  if (phase === 'open') return 'pre-order window open. the window sets the run, never reprinted';
  return 'the window closed. what remains sells until it is gone, then it is vaulted';
}
