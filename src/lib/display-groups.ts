import type { EventImage } from '@/types';

/** Group names match case- and whitespace-insensitively ("Riya " and "riya" are one group). */
export const normalizeGroupName = (groupName?: string) => groupName?.trim().toLowerCase() || '';

/**
 * What the big screen cycles through: the newest photo of each group, groups in natural
 * order. `images` must be sorted newest first.
 */
export const getDisplayGroupImages = (images: EventImage[]) => {
  const newestImageByGroup = new Map<string, EventImage>();

  images.forEach((image) => {
    const groupKey = normalizeGroupName(image.groupName);
    if (groupKey && !newestImageByGroup.has(groupKey)) {
      newestImageByGroup.set(groupKey, image);
    }
  });

  return Array.from(newestImageByGroup.values()).sort((a, b) =>
    a.groupName.localeCompare(b.groupName, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
};
