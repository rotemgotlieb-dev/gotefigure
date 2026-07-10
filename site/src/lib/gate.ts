// Hard server-side gate for /store — the signed-cookie design from the Safe Backend
// Doctrine critic panel (2026-07-09): the cookie payload carries a SERVER-VERIFIED
// expiry + nonce and an HMAC, so it can never become a forever-bearer token (cookie
// Max-Age alone is client-advisory). Verification is constant-time by construction:
// the MAC check goes through crypto.subtle.verify, and the login-code comparison is
// double-HMAC (compare digests of both sides, never the secrets themselves).
//
// Cookie value format: `${expUnixSeconds}.${nonceHex}.${macHex}`
//   mac = HMAC-SHA256(GATE_SIGNING_KEY, `${exp}.${nonce}`)

const enc = new TextEncoder();

export const GATE_COOKIE = 'gf_gate';
export const GATE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days, server-enforced via `exp`

export async function importGateKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array | null => {
  if (!/^[0-9a-f]+$/.test(hex) || hex.length % 2) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export async function hmacHex(key: CryptoKey, message: string): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Mint a fresh signed gate token: exp + random 128-bit nonce + MAC. */
export async function signGateToken(key: CryptoKey, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + GATE_TTL_SECONDS;
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const mac = await hmacHex(key, `${exp}.${nonce}`);
  return `${exp}.${nonce}.${mac}`;
}

/** Verify a gate token: shape, MAC (constant-time via subtle.verify), THEN expiry. */
export async function verifyGateToken(key: CryptoKey, token: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, macHex] = parts;
  if (!/^\d{1,12}$/.test(expStr) || nonce.length !== 32) return false;
  const macBytes = fromHex(macHex);
  if (!macBytes || macBytes.length !== 32) return false;
  const valid = await crypto.subtle.verify('HMAC', key, macBytes as unknown as BufferSource, enc.encode(`${expStr}.${nonce}`));
  if (!valid) return false;
  return Number(expStr) > Math.floor(nowMs / 1000); // server-enforced expiry, after MAC
}
