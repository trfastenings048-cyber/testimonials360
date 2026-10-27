import type { DisplaySettings } from '@/generated/prisma';
import { prisma } from '@/server/prisma';
import { PARTS_SET_NAME, type DisplayVideo, type ModeChangedData, type VideoSetKind } from '@/lib/realtime/protocol';

const toDisplayVideo = (video: { id: string; url: string; title: string }): DisplayVideo => ({
  id: video.id,
  url: video.url,
  title: video.title,
});

export const parseVideoSet = (value: unknown): VideoSetKind => (value === 'parts' ? 'parts' : 'single');

/** The clips of the ordered playlist, first to last. */
export async function loadPartsPlaylist(): Promise<DisplayVideo[]> {
  const parts = await prisma.video.findMany({
    where: { setName: PARTS_SET_NAME },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, url: true, title: true },
  });
  return parts.map(toDisplayVideo);
}

/** Resolves what video mode plays for the saved settings. */
export async function resolvePlaylist(settings: Pick<DisplaySettings, 'videoSet' | 'videoUrl'>): Promise<DisplayVideo[]> {
  if (parseVideoSet(settings.videoSet) === 'parts') return loadPartsPlaylist();
  if (!settings.videoUrl) return [];
  const video = await prisma.video.findFirst({
    where: { url: settings.videoUrl },
    select: { id: true, url: true, title: true },
  });
  // A URL set before the video library existed still plays; it just has no title.
  return [video ? toDisplayVideo(video) : { id: '', url: settings.videoUrl, title: 'Video' }];
}

/** The `mode.changed` payload for saved settings (pass `playlist` when it is already known). */
export async function buildModeChanged(settings: DisplaySettings, playlist?: DisplayVideo[]): Promise<ModeChangedData> {
  const resolved = playlist ?? (await resolvePlaylist(settings));
  return {
    mode: settings.mode === 'video' ? 'video' : 'testimonials',
    video: resolved[0] ?? null,
    playlist: resolved,
    videoSet: parseVideoSet(settings.videoSet),
    videoAutoplay: settings.videoAutoplay,
    videoLoop: settings.videoLoop,
    videoMuted: settings.videoMuted,
    videoVolume: settings.videoVolume,
    testimonialAutoPlay: settings.testimonialAutoPlay,
    testimonialDurationMs: settings.testimonialDurationMs,
  };
}
