import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createAdminSession,
  isAdminAuthConfigured,
  isCorrectAccessKey,
} from '@/server/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Admin access is not configured: set ADMIN_ACCESS_KEY' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const candidate = typeof body.accessKey === 'string' ? body.accessKey : '';

  if (!(await isCorrectAccessKey(candidate))) {
    // Small fixed delay slows down guessing without needing a rate-limit store.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
  }

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
