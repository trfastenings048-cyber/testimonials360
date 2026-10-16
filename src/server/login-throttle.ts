import { prisma } from '@/server/prisma';

// Lockouts that make a short numeric PIN safe enough for the admin login. Counters live in
// Postgres (AdminLoginAttempt) because serverless instances share no memory.
//
// - Per IP: 5 wrong attempts in 15 minutes locks that address for 15 minutes.
// - Global: 20 wrong attempts in 15 minutes (from anywhere) locks new sign-ins for 15 minutes,
//   so spreading guesses across many addresses doesn't help.
// Signed-in admins keep working; only new sign-ins wait.
//
// At most 20 guesses per 15 minutes, finding a 4-digit PIN takes ~60 hours on average.

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const IP_LIMIT = 5;
const GLOBAL_LIMIT = 20;
const GLOBAL_KEY = 'global';

export function clientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip') || 'unknown';
}

/** Returns the time the caller may retry, or null if sign-in is allowed now. */
export async function lockedUntil(ip: string): Promise<Date | null> {
  const rows = await prisma.adminLoginAttempt.findMany({ where: { key: { in: [`ip:${ip}`, GLOBAL_KEY] } } });
  const now = Date.now();
  const active = rows
    .map((row) => row.lockedUntil)
    .filter((date): date is Date => Boolean(date) && date!.getTime() > now)
    .sort((a, b) => b.getTime() - a.getTime());
  return active[0] ?? null;
}

async function bump(key: string, limit: number) {
  const now = new Date();
  const row = await prisma.adminLoginAttempt.findUnique({ where: { key } });
  const windowExpired = !row || now.getTime() - row.windowStart.getTime() > WINDOW_MS;
  const failures = windowExpired ? 1 : row.failures + 1;
  const lockedUntil = failures >= limit ? new Date(now.getTime() + LOCK_MS) : null;

  await prisma.adminLoginAttempt.upsert({
    where: { key },
    create: { key, failures, windowStart: now, lockedUntil },
    update: {
      failures: lockedUntil ? 0 : failures,
      windowStart: windowExpired || lockedUntil ? now : row!.windowStart,
      lockedUntil,
    },
  });
}

export async function recordFailure(ip: string) {
  await Promise.all([bump(`ip:${ip}`, IP_LIMIT), bump(GLOBAL_KEY, GLOBAL_LIMIT)]);
}

export async function recordSuccess(ip: string) {
  await prisma.adminLoginAttempt.deleteMany({ where: { key: `ip:${ip}` } });
}
