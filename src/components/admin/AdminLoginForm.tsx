'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Arches } from '@/components/shared/Arches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AdminLoginFormProps = {
  destination: string;
  /** Development with no ADMIN_ACCESS_KEY: admin is open, so just offer to continue. */
  bypassed: boolean;
  configured: boolean;
  /** Set when ADMIN_ACCESS_KEY is a numeric PIN: show one box per digit. */
  pinLength: number | null;
};

export function AdminLoginForm({ destination, bypassed, configured, pinLength }: AdminLoginFormProps) {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const signIn = async (code: string) => {
    if (!code || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: code }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error || 'Sign-in failed');
        // Clear the PIN so the next attempt starts fresh.
        setAccessKey('');
        inputRef.current?.focus();
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

  const onPinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, pinLength ?? 0);
    setAccessKey(digits);
    if (error) setError('');
    // Submit as soon as the last digit is entered.
    if (pinLength && digits.length === pinLength) void signIn(digits);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn(accessKey);
  };

  const errorId = `${inputId}-error`;

  return (
    <div className="theme-tr theme-admin relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-surface-page px-4 py-10">
      {/* The big screen's signature gradient panel behind the form. */}
      <div
        aria-hidden="true"
        className="bg-signature absolute inset-x-4 top-4 bottom-[45%] overflow-hidden rounded-[32px] sm:inset-x-8 sm:top-8"
      >
        <Arches className="h-[90%] text-white/50" />
      </div>
      <div className="surface-card relative w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-white p-1 ring-1 ring-border">
            <Image src="/tr-fastenings-logo.jpg" alt="" width={140} height={134} priority className="h-10 w-auto" />
          </span>
          <div>
            <p className="text-eyebrow text-muted-foreground">TR Fastenings</p>
            <h1 className="text-lg font-medium text-ink">360 Camera Admin</h1>
          </div>
        </div>

        {bypassed ? (
          <div className="space-y-4">
            <p className="rounded-2xl border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              Admin protection is off because <code className="font-mono">ADMIN_ACCESS_KEY</code> isn&apos;t set. This
              only works in development; production refuses admin access until it&apos;s set.
            </p>
            <Button className="h-10 w-full" onClick={() => router.replace(destination)}>
              Continue to admin
            </Button>
          </div>
        ) : !configured ? (
          <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Admin access is disabled. Set <code className="font-mono">ADMIN_ACCESS_KEY</code> in the server environment.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {pinLength ? (
              <div className="space-y-3">
                <Label htmlFor={inputId} className="block text-center">
                  Enter your {pinLength}-digit code
                </Label>
                {/* One real input (numeric keypad, paste, autofill) drawn as separate digit boxes. */}
                <div className="relative mx-auto w-fit">
                  <div className="flex gap-3" aria-hidden="true">
                    {Array.from({ length: pinLength }).map((_, index) => {
                      const filled = index < accessKey.length;
                      const isCurrent = isFocused && index === Math.min(accessKey.length, pinLength - 1);
                      return (
                        <div
                          key={index}
                          className={cn(
                            'surface-shadow flex size-14 items-center justify-center rounded-2xl border-2 bg-card font-display-mono text-2xl text-ink transition-colors',
                            error ? 'border-destructive/60' : isCurrent ? 'border-accent-blue ring-4 ring-accent-blue/20' : 'border-transparent',
                            filled && !error && 'border-ink/20'
                          )}
                        >
                          {filled ? '•' : ''}
                        </div>
                      );
                    })}
                  </div>
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={pinLength}
                    value={accessKey}
                    disabled={isSubmitting}
                    onChange={(event) => onPinChange(event.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    className="absolute inset-0 h-full w-full cursor-text opacity-0"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={inputId}>Passcode</Label>
                <Input
                  ref={inputRef}
                  id={inputId}
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  className="h-11"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
            )}

            {error && (
              <p id={errorId} role="alert" className="flex items-center justify-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={isSubmitting || !accessKey || (pinLength !== null && accessKey.length !== pinLength)}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
