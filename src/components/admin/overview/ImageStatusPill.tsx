import { Dot, Pill, type DotTone } from '@/components/shared/Pill';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ImageStatus, ImageStatusInfo } from './imageStatus';

export const STATUS_LABEL: Record<ImageStatus, string> = { 'on-screen': 'On screen', replaced: 'Replaced', hidden: 'Hidden' };
const STATUS_TONE: Record<ImageStatus, DotTone> = { 'on-screen': 'live', replaced: 'muted', hidden: 'paused' };

export const formatDay = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
export const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** On screen (pulsing green) · Replaced (muted, tooltip names the photo shown instead) · Hidden (amber). */
export function ImageStatusPill({ info }: { info: ImageStatusInfo }) {
  const pill = (
    <Pill className="h-6 px-2.5 text-xs">
      <Dot tone={STATUS_TONE[info.status]} pulse={info.status === 'on-screen'} className="size-1.5" />
      {STATUS_LABEL[info.status]}
    </Pill>
  );
  if (info.status !== 'replaced' || !info.shownInstead) return pill;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" />}>
        {pill}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60">
        The screen shows the newer photo from {formatDay(info.shownInstead.timestamp)} {formatTime(info.shownInstead.timestamp)}
      </TooltipContent>
    </Tooltip>
  );
}
