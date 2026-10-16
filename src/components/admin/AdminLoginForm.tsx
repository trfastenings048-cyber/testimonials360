'use client';

import { useId, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AdminLoginFormProps = {
  destination: string;
  /** Development with no ADMIN_ACCESS_KEY: admin is open, so just offer to continue. */
  bypassed: boolean;
  configured: boolean;
};

export function AdminLoginForm({ destination, bypassed, configured }: AdminLoginFormProps) {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error || 'Sign-in failed');
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="theme-tr flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-brand-navy to-brand-navy-deep px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-md bg-white p-1 shadow-sm ring-1 ring-border">
            <Image src="/tr-fastenings-logo.jpg" alt="" width={140} height={134} priority className="h-10 w-auto" />
          </span>
          <div>
            <p className="text-eyebrow text-secondary">TR Fastenings</p>
            <h1 className="text-lg font-bold text-primary">360 Camera Admin</h1>
          </div>
        </div>

        {bypassed ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              Admin protection is off because <code className="font-mono">ADMIN_ACCESS_KEY</code> isn&apos;t set. This
              only works in development; production refuses admin access until it&apos;s set.
            </p>
            <Button className="h-10 w-full" onClick={() => router.replace(destination)}>
              Continue to admin
            </Button>
          </div>
        ) : !configured ? (
          <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Admin access is disabled. Set <code className="font-mono">ADMIN_ACCESS_KEY</code> in the server environment.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={inputId}>Passcode</Label>
              <Input
                id={inputId}
                type="password"
                autoComplete="current-password"
                autoFocus
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                className="h-11"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${inputId}-error` : undefined}
              />
            </div>
            {error && (
              <p id={`${inputId}-error`} role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={isSubmitting || !accessKey}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              Sign in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
