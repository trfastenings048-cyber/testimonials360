import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The rounded, inset frame that holds the photo slideshow or the video. */
export function StageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      aria-label="Big screen stage"
      className={cn(
        'relative isolate min-h-0 overflow-hidden rounded-[28px] border border-slate-300/60 bg-gradient-to-br from-display-stage-from to-display-stage-to',
        className
      )}
    >
      {children}
    </section>
  );
}
