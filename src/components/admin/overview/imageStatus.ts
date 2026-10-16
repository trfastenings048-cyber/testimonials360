import type { EventImage } from '@/types';
import { getDisplayGroupImages, normalizeGroupName } from '@/lib/display-groups';

/**
 * - `on-screen`: visible and the newest visible photo of its group, so the big screen shows it.
 * - `replaced`: visible, but a newer visible photo of the same group is shown instead.
 * - `hidden`: switched off.
 */
export type ImageStatus = 'on-screen' | 'replaced' | 'hidden';

export type ImageStatusInfo = { status: ImageStatus; shownInstead?: EventImage };

const byNewest = (a: EventImage, b: EventImage) => b.timestamp - a.timestamp;

/** Status per image id, using the same grouping rule as /display. */
export function getImageStatuses(images: EventImage[]): Map<string, ImageStatusInfo> {
  const visible = images.filter((image) => image.isVisible).sort(byNewest);
  const shownByGroup = new Map(getDisplayGroupImages(visible).map((image) => [normalizeGroupName(image.groupName), image]));

  const statuses = new Map<string, ImageStatusInfo>();
  images.forEach((image) => {
    if (!image.isVisible) {
      statuses.set(image.id, { status: 'hidden' });
      return;
    }
    const shown = shownByGroup.get(normalizeGroupName(image.groupName));
    statuses.set(
      image.id,
      shown && shown.id !== image.id ? { status: 'replaced', shownInstead: shown } : { status: 'on-screen' }
    );
  });
  return statuses;
}

/** How a new upload under `groupName` relates to what's already there. */
export function groupNameImpact(images: EventImage[], groupName: string): 'replaces' | 'joins-hidden' | 'new' {
  const key = normalizeGroupName(groupName);
  if (!key) return 'new';
  const inGroup = images.filter((image) => normalizeGroupName(image.groupName) === key);
  if (inGroup.some((image) => image.isVisible)) return 'replaces';
  return inGroup.length ? 'joins-hidden' : 'new';
}

export const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "2 minutes ago", "yesterday", … */
export function timeAgo(timestamp: number, now = Date.now()) {
  const seconds = Math.round((timestamp - now) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}
