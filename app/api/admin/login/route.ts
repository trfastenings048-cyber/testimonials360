import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createAdminSession,
  isAdminAuthConfigured,
  isCorrectAccessKey,
} from '@/server/admin-auth';
import { clientIp, lockedUntil, recordFailure, recordSuccess } from '@/server/login-throttle';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Admin access is not configured: set ADMIN_ACCESS_KEY' }, { status: 503 });
  }

  const ip = clientIp(request.headers);
  const locked = await lockedUntil(ip);
  if (locked) {
    const minutes = Math.max(1, Math.ceil((locked.getTime() - Date.now()) / 60_000));
    return NextResponse.json(
      { error: `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(minutes * 60) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  // Trimmed like the stored key, so a pasted code with a stray space or newline still works.
  const candidate = typeof body.accessKey === 'string' ? body.accessKey.trim() : '';

  if (!(await isCorrectAccessKey(candidate))) {
    await recordFailure(ip);
    return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
  }

  await recordSuccess(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  });
  return response;
}
