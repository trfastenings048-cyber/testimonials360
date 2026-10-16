'use client';

import { cn } from '@/lib/utils';
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
  muted: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

const tonePillClasses: Record<Tone, string> = {
  muted: 'border-border bg-muted text-muted-foreground',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
};

export function StatusPill() {
  const { connection, screens } = useAdminData();
  const status = getLiveStatus(connection, screens.length);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        className={cn(
          'inline-flex h-8 cursor-default items-center gap-2 rounded-full border px-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
          tonePillClasses[status.tone]
        )}
      >
        <span className="relative flex size-2" aria-hidden="true">
          {status.tone === 'success' && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
          )}
          <span className={cn('relative inline-flex size-2 rounded-full', toneDotClasses[status.tone])} />
        </span>
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
