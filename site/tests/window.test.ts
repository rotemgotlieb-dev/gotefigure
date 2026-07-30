// Pre-sale window state machine tests (docs/PRESALE-WINDOW-DESIGN.md). Boundary-exact:
// T-0 inclusive, closesAt exclusive-at-the-instant, null config = honest pre state.
import { describe, expect, it } from 'vitest';
import {
  dateLabel,
  purchasable,
  scarcityLine,
  validatePricing,
  validateWindowConfig,
  windowCopy,
  windowPhase,
  type WindowConfig,
} from '../src/lib/commerce/window';

const OPEN = '2026-08-10T10:00:00-07:00';
const CLOSE = '2026-08-24T10:00:00-07:00'; // T-0 + 14 days = through T+13
const CFG: WindowConfig = { opensAt: OPEN, closesAt: CLOSE };
const NULL_CFG: WindowConfig = { opensAt: null, closesAt: null };
const PRICING = { list: 40, waitlist: 35 };
const EM_DASH = String.fromCharCode(0x2014); // asserted absent everywhere (hard standing rule)

describe('validateWindowConfig', () => {
  it('accepts the honest unset state (both null)', () => {
    expect(validateWindowConfig({ opensAt: null, closesAt: null })).toEqual(NULL_CFG);
  });
  it('accepts a valid pair', () => {
    expect(validateWindowConfig(CFG)).toEqual(CFG);
  });
  it('rejects opensAt without closesAt (and the reverse)', () => {
    expect(() => validateWindowConfig({ opensAt: OPEN, closesAt: null })).toThrow(/TOGETHER/);
    expect(() => validateWindowConfig({ opensAt: null, closesAt: CLOSE })).toThrow(/TOGETHER/);
  });
  it('rejects unparseable datetimes', () => {
    expect(() => validateWindowConfig({ opensAt: 'someday', closesAt: CLOSE })).toThrow(/ISO-8601/);
  });
  it('rejects a window that closes before (or when) it opens', () => {
    expect(() => validateWindowConfig({ opensAt: CLOSE, closesAt: OPEN })).toThrow(/after/);
    expect(() => validateWindowConfig({ opensAt: OPEN, closesAt: OPEN })).toThrow(/after/);
  });
});

describe('validatePricing', () => {
  it('accepts the decided 40/35', () => {
    expect(validatePricing(PRICING)).toEqual(PRICING);
  });
  it('rejects missing or non-positive prices', () => {
    expect(() => validatePricing({})).toThrow(/positive/);
    expect(() => validatePricing({ list: 40, waitlist: 0 })).toThrow(/positive/);
  });
});

describe('windowPhase boundaries', () => {
  const t = (iso: string) => Date.parse(iso);
  it('null config is pre (nothing claimed, nothing sold)', () => {
    expect(windowPhase(NULL_CFG, t(OPEN))).toBe('pre');
  });
  it('one millisecond before opensAt is pre', () => {
    expect(windowPhase(CFG, t(OPEN) - 1)).toBe('pre');
  });
  it('exactly opensAt (T-0) is open', () => {
    expect(windowPhase(CFG, t(OPEN))).toBe('open');
  });
  it('one millisecond before closesAt is open', () => {
    expect(windowPhase(CFG, t(CLOSE) - 1)).toBe('open');
  });
  it('exactly closesAt is post', () => {
    expect(windowPhase(CFG, t(CLOSE))).toBe('post');
  });
});

describe('purchasable', () => {
  it('pre-window: never purchasable', () => {
    expect(purchasable('pre', false)).toBe(false);
  });
  it('open window: purchasable unless sold out', () => {
    expect(purchasable('open', false)).toBe(true);
    expect(purchasable('open', true)).toBe(false);
  });
  it('post-window: sells what remains until the flag flips', () => {
    expect(purchasable('post', false)).toBe(true);
    expect(purchasable('post', true)).toBe(false);
  });
});

describe('copy honesty (the loud waitlist framing, no countdowns, no percent-off)', () => {
  const phases = ['pre', 'open', 'post'] as const;
  it('the waitlist price is dollars, loud, in pre and open', () => {
    for (const phase of ['pre', 'open'] as const) {
      const c = windowCopy(phase, NULL_CFG, PRICING);
      expect(c.waitlistLine).toContain('$35');
      expect(c.priceLine).toContain('$40');
      expect(c.priceLine).toContain(c.waitlistLine);
    }
  });
  it('never percent-off framing, anywhere', () => {
    for (const phase of phases) {
      const c = windowCopy(phase, CFG, PRICING);
      for (const line of Object.values(c)) {
        expect(line).not.toMatch(/%|percent|off\b/i);
      }
    }
  });
  it('never countdown language, anywhere', () => {
    for (const phase of phases) {
      const c = windowCopy(phase, CFG, PRICING);
      for (const line of Object.values(c)) {
        expect(line).not.toMatch(/countdown|hurry|\d+\s*(sec|min|hr|hours|days)\s*(left|remaining)/i);
      }
    }
  });
  it('dates render as plain labels, or honest unset copy', () => {
    expect(windowCopy('pre', CFG, PRICING).headline).toBe('The window opens Aug 10');
    expect(windowCopy('open', CFG, PRICING).headline).toBe('The window is open through Aug 24');
    expect(windowCopy('pre', NULL_CFG, PRICING).headline).toBe('The window opens when the ink is ready');
  });
  it('no em dash in any shipped line (hard standing rule)', () => {
    for (const phase of phases) {
      for (const line of Object.values(windowCopy(phase, CFG, PRICING))) {
        expect(line).not.toContain(EM_DASH);
      }
      expect(scarcityLine(phase, false)).not.toContain(EM_DASH);
    }
  });
});

describe('scarcityLine (true states only, no numbers)', () => {
  it('sold-out copy exists ONLY behind the flag', () => {
    expect(scarcityLine('post', true)).toMatch(/sold out/);
    for (const phase of ['pre', 'open', 'post'] as const) {
      expect(scarcityLine(phase, false)).not.toMatch(/sold out/);
    }
  });
  it('carries no numeric scarcity claim', () => {
    for (const phase of ['pre', 'open', 'post'] as const) {
      expect(scarcityLine(phase, false)).not.toMatch(/\d/);
    }
  });
});

describe('dateLabel', () => {
  it('formats a plain label and refuses garbage', () => {
    expect(dateLabel(OPEN)).toBe('Aug 10');
    expect(dateLabel(null)).toBeNull();
    expect(dateLabel('nope')).toBeNull();
  });
});
