import { NextRequest, NextResponse } from 'next/server';
import { getAblyRest } from '@/server/realtime';
import { ADMIN_COOKIE, isValidAdminSession } from '@/server/admin-auth';
import { CHANNELS, isValidClientId, type RealtimeRole } from '@/lib/realtime/protocol';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Long TTL keeps renewals (= Vercel invocations) to about one per tab per 12 hours.
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const CAPABILITIES: Record<RealtimeRole, Record<string, string[]>> = {
  // Screens listen and report their own state via presence; they can never publish commands.
  display: {
    [CHANNELS.control]: ['subscribe', 'presence'],
    [CHANNELS.content]: ['subscribe'],
  },
  // Admins publish commands and read screen presence; they don't enter presence themselves.
  admin: {
    [CHANNELS.control]: ['publish', 'subscribe'],
    [CHANNELS.content]: ['subscribe'],
  },
};

// Ably's SDK calls this through `authUrl` whenever it needs a fresh token.
export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get('role');
  const clientId = request.nextUrl.searchParams.get('clientId') || '';

  if (role !== 'display' && role !== 'admin') {
    return NextResponse.json({ error: 'role must be "display" or "admin"' }, { status: 400 });
  }
  if (!isValidClientId(role, clientId)) {
    return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
  }
  // 403 (not 401/503) on purpose: the Ably SDK treats only a 403 from authUrl as final.
  // Any other error makes every open tab retry this route every 15–30 s, forever.
  if (role === 'admin' && !(await isValidAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Admin sign-in required' }, { status: 403 });
  }

  const rest = getAblyRest();
  if (!rest) {
    return NextResponse.json({ error: 'Realtime is not configured (ABLY_ROOT_KEY is missing)' }, { status: 403 });
  }

  try {
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId,
      ttl: TOKEN_TTL_MS,
      capability: JSON.stringify(CAPABILITIES[role]),
    });
    return NextResponse.json(tokenRequest, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Token creation is local signing; a failure here means a bad key, which retrying won't fix.
    const message = error instanceof Error ? error.message : 'Failed to create realtime token';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
