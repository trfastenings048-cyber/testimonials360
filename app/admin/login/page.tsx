import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_COOKIE,
  adminPinLength,
  isAdminAuthBypassed,
  isAdminAuthConfigured,
  isValidAdminSession,
} from '@/server/admin-auth';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const metadata: Metadata = { title: 'Sign in · Admin · TR Fastenings' };

// Only allow redirects back into the admin, never to another site.
const safeNext = (next: string | undefined) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin/overview';

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;

  if (isAdminAuthConfigured() && (await isValidAdminSession(session))) redirect(destination);

  return (
    <AdminLoginForm
      destination={destination}
      bypassed={isAdminAuthBypassed()}
      configured={isAdminAuthConfigured()}
      pinLength={adminPinLength()}
    />
  );
}
