'use client';

import { Dot, Pill, type DotTone } from '@/components/shared/Pill';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminData, type ConnectionStatus } from './AdminDataProvider';

type Tone = 'muted' | 'success' | 'warning' | 'danger';

export type LiveStatus = {
  tone: Tone;
  label: string;
  shortLabel: string;
  detail: string;
};

export function getLiveStatus(connection: ConnectionStatus, displayCount: number): LiveStatus {
  if (connection === 'connecting') {
    return { tone: 'muted', label: 'Connecting…', shortLabel: 'Connecting', detail: 'Connecting to live updates.' };
  }
  if (connection === 'reconnecting') {
    return {
      tone: 'warning',
      label: 'Reconnecting…',
      shortLabel: 'Reconnecting',
      detail: 'Live updates dropped and are retrying. Changes may not reach the big screen yet.',
    };
  }
  if (connection === 'offline') {
    return {
      tone: 'danger',
      label: 'Offline',
      shortLabel: 'Offline',
      detail: "Live updates are down. Changes won't reach the big screen until this reconnects.",
    };
  }
  if (displayCount === 0) {
    return {
      tone: 'warning',
      label: 'No screen connected',
      shortLabel: 'No screen',
      detail: 'Live updates are on, but no big screen is connected. Open /display on the screen.',
    };
  }
  const screens = `${displayCount} screen${displayCount === 1 ? '' : 's'}`;
  return {
    tone: 'success',
    label: `Live · ${screens}`,
    shortLabel: 'Live',
    detail: `${screens} connected and receiving changes.`,
  };
}

export const toneDotClasses: Record<Tone, string> = {
  muted: 'bg-ink-muted',
  success: 'bg-live',
  warning: 'bg-paused',
  danger: 'bg-destructive',
};

const toneDots: Record<Tone, DotTone> = {
  muted: 'muted',
  success: 'live',
  warning: 'paused',
  danger: 'danger',
};

/** Live-updates pill in the navbar: white with a coloured dot, the same pill the big screen shows. */
export function StatusPill() {
  const { connection, screens } = useAdminData();
  const status = getLiveStatus(connection, screens.length);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Pill tabIndex={0} />}
        className="h-9 cursor-default px-3.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Dot tone={toneDots[status.tone]} pulse={status.tone === 'success'} className="size-2" />
        <span role="status" aria-live="polite">
          <span className="sm:hidden">{status.shortLabel}</span>
          <span className="hidden sm:inline">{status.label}</span>
          <span className="sr-only">. {status.detail}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {status.detail}
      </TooltipContent>
    </Tooltip>
  );
}
