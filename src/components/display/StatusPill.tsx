import { WifiOff } from 'lucide-react';
import { Dot, Pill } from '@/components/shared/Pill';

export type StatusPillState = 'live' | 'paused' | 'offline';

const LABELS: Record<StatusPillState, string> = {
  live: 'Autoplay',
  paused: 'Paused',
  offline: 'Reconnecting…',
};

/** Top-left pill: is the slideshow running, paused, or is the screen offline? */
export function StatusPill({ state, liveLabel }: { state: StatusPillState; liveLabel?: string }) {
  return (
    <Pill role="status" className="gap-[0.5em] px-[1.1em] py-[0.6em] text-[clamp(11px,0.85vw,16px)]">
      {state === 'offline' ? (
        <WifiOff className="size-[1.1em] text-ink-muted" aria-hidden="true" />
      ) : (
        <Dot tone={state === 'live' ? 'live' : 'paused'} className="size-[0.5em]" />
      )}
      {state === 'live' && liveLabel ? liveLabel : LABELS[state]}
    </Pill>
  );
}
