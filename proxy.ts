import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, isAdminAuthBypassed, isAdminAuthConfigured, isValidAdminSession } from '@/server/admin-auth';

// Admin-only pages. Everything else (display, participant portal) stays public.
const ADMIN_PAGES = [/^\/admin(\/|$)/, /^\/server$/, /^\/certificate\/management$/];
const PUBLIC_ADMIN_PAGES = [/^\/admin\/login$/];

// Admin-only API calls, by method. Reads the display and portal need stay public.
const ADMIN_API_RULES: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^\/api\/images(\/upload|\/sign)?$/, methods: ['POST'] },
  { pattern: /^\/api\/images\/[^/]+$/, methods: ['PATCH', 'DELETE'] },
  { pattern: /^\/api\/certificates$/, methods: ['DELETE'] },
  { pattern: /^\/api\/certificates\/[^/]+$/, methods: ['PATCH', 'DELETE'] },
  { pattern: /^\/api\/videos(\/.*)?$/, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { pattern: /^\/api\/display-settings$/, methods: ['PATCH'] },
  { pattern: /^\/api\/summary$/, methods: ['GET'] },
];

const isAdminApiCall = (request: NextRequest) => {
  const { pathname, searchParams } = request.nextUrl;
  // The full submission list includes participant emails; the display only ever asks for
  // the approved subset (showOnDisplay=true), which stays public.
  if (pathname === '/api/certificates' && request.method === 'GET') {
    return searchParams.get('showOnDisplay') !== 'true';
  }
  return ADMIN_API_RULES.some((rule) => rule.pattern.test(pathname) && rule.methods.includes(request.method));
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const needsAdmin = isApi
    ? isAdminApiCall(request)
    : ADMIN_PAGES.some((page) => page.test(pathname)) && !PUBLIC_ADMIN_PAGES.some((page) => page.test(pathname));

  if (!needsAdmin || isAdminAuthBypassed()) return NextResponse.next();
  if (await isValidAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (isApi) {
    const error = isAdminAuthConfigured() ? 'Admin sign-in required' : 'Admin access is disabled: set ADMIN_ACCESS_KEY';
    return NextResponse.json({ error }, { status: isAdminAuthConfigured() ? 401 : 503 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

// On Vercel the proxy runs before the CDN cache on every matching request, so match only
// routes that can need an admin check. Public downloads, the Ably token route and the
// portal's upload never invoke it.
export const config = {
  matcher: [
    '/admin/:path*',
    '/server',
    '/certificate/management',
    '/api/images',
    '/api/images/:id',
    '/api/certificates',
    '/api/certificates/:id',
    '/api/videos/:path*',
    '/api/display-settings',
    '/api/summary',
  ],
};
