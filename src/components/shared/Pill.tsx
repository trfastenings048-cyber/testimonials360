import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type DotTone = 'live' | 'paused' | 'danger' | 'muted';

const dotTones: Record<DotTone, string> = {
  live: 'bg-live',
  paused: 'bg-paused',
  danger: 'bg-destructive',
  muted: 'bg-ink-muted',
};

/** Small status dot; size it with `size-*` (defaults to 6px, or 0.5em inside an em-sized pill). */
export function Dot({ tone, pulse = false, className }: { tone: DotTone; pulse?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative inline-flex size-1.5 shrink-0', className)}>
      {pulse && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', dotTones[tone])} />}
      <span className={cn('relative inline-flex size-full rounded-full', dotTones[tone])} />
    </span>
  );
}

/** White, fully rounded pill with a soft shadow, as on the big screen. */
export function Pill({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'surface-shadow inline-flex items-center gap-2 rounded-full bg-white font-medium whitespace-nowrap text-ink',
        className
      )}
      {...props}
    />
  );
}
