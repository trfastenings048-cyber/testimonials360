// Minimal admin protection: one shared passcode (ADMIN_ACCESS_KEY) exchanged for an
// HMAC-signed, httpOnly session cookie. Uses Web Crypto so it runs in the proxy and in
// route handlers alike. Changing ADMIN_ACCESS_KEY invalidates every existing session.

export const ADMIN_COOKIE = 'tr_admin_session';
export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

const accessKey = () => process.env.ADMIN_ACCESS_KEY?.trim() || '';

/** With no passcode configured, development stays open; production refuses admin access. */
export const isAdminAuthBypassed = () => !accessKey() && process.env.NODE_ENV !== 'production';
export const isAdminAuthConfigured = () => Boolean(accessKey());

/** When ADMIN_ACCESS_KEY is a short all-digit code (e.g. "4826"), its length; otherwise null. */
export const adminPinLength = () => (/^\d{4,8}$/.test(accessKey()) ? accessKey().length : null);

const toBase64Url = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function sign(message: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(accessKey()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compares HMACs rather than raw strings so timing doesn't leak the passcode. */
export async function isCorrectAccessKey(candidate: string) {
  if (!accessKey()) return false;
  return constantTimeEqual(await sign(`login:${candidate}`), await sign(`login:${accessKey()}`));
}

export async function createAdminSession() {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  return `${expiresAt}.${await sign(`session:${expiresAt}`)}`;
}

export async function isValidAdminSession(value: string | undefined) {
  if (isAdminAuthBypassed()) return true;
  if (!accessKey() || !value) return false;
  const [expiresAtText, signature] = value.split('.');
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !signature) return false;
  return constantTimeEqual(signature, await sign(`session:${expiresAt}`));
}
