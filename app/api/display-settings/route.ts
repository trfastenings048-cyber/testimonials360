import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { publishModeChanged } from '@/server/realtime';
import { PARTS_SET_NAME, type DisplayVideo } from '@/lib/realtime/protocol';
import { buildModeChanged, loadPartsPlaylist, parseVideoSet, resolvePlaylist } from '@/server/display';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const defaults = {
  id: 'default', heading: 'Testimonials', subtitle: '', mode: 'testimonials',
  videoUrl: null, videoAutoplay: true, videoLoop: true, videoMuted: false, videoVolume: 68, videoSet: 'single',
  testimonialAutoPlay: true, testimonialDurationMs: 5000,
};

// A plain read (one round trip). The old upsert ran a write transaction on every GET,
// which made this the slowest route; the row only needs creating once.
async function loadSettings() {
  const existing = await prisma.displaySettings.findUnique({ where: { id: 'default' } });
  if (existing) return existing;
  try {
    return await prisma.displaySettings.create({ data: defaults });
  } catch {
    // Another request created it first.
    return prisma.displaySettings.findUniqueOrThrow({ where: { id: 'default' } });
  }
}

// Read once by the display on load (and by the admin); live changes then arrive over Ably.
export async function GET() {
  const settings = await loadSettings();
  const playlist = await resolvePlaylist(settings);
  return NextResponse.json(
    { ...settings, video: playlist[0] ?? null, playlist },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * Partial update. Switching to `mode: 'video'` plays the latest uploaded video unless a
 * specific `videoId` is given. Saved state is then pushed to every screen as `mode.changed`.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.mode !== undefined) {
      if (body.mode !== 'video' && body.mode !== 'testimonials') {
        return NextResponse.json({ error: 'mode must be "testimonials" or "video"' }, { status: 400 });
      }
      data.mode = body.mode;
    }

    let playlist: DisplayVideo[] | undefined;
    if (body.mode === 'video') {
      if (body.videoSet === 'parts') {
        playlist = await loadPartsPlaylist();
        if (playlist.length === 0) {
          return NextResponse.json({ error: 'Upload the video parts first' }, { status: 409 });
        }
        data.videoSet = 'parts';
      } else {
        // Video 1 is the latest standalone upload unless a specific one is asked for.
        const video =
          typeof body.videoId === 'string' && body.videoId
            ? await prisma.video.findUnique({ where: { id: body.videoId } })
            : await prisma.video.findFirst({ where: { setName: null }, orderBy: { createdAt: 'desc' } });
        if (!video) {
          return NextResponse.json(
            { error: body.videoId ? 'That video no longer exists' : 'Upload a video first' },
            { status: body.videoId ? 404 : 409 }
          );
        }
        data.videoUrl = video.url;
        data.videoSet = 'single';
        playlist = [{ id: video.id, url: video.url, title: video.title }];
      }
    } else if (body.videoSet !== undefined) {
      data.videoSet = parseVideoSet(body.videoSet);
    }

    if (typeof body.heading === 'string') data.heading = body.heading.trim() || 'Testimonials';
    if (typeof body.subtitle === 'string') data.subtitle = body.subtitle.trim();
    if (typeof body.videoAutoplay === 'boolean') data.videoAutoplay = body.videoAutoplay;
    if (typeof body.videoLoop === 'boolean') data.videoLoop = body.videoLoop;
    if (typeof body.videoMuted === 'boolean') data.videoMuted = body.videoMuted;
    if (body.videoVolume !== undefined) {
      data.videoVolume = Math.max(0, Math.min(100, Math.round(Number(body.videoVolume) || 0)));
    }
    if (typeof body.testimonialAutoPlay === 'boolean') data.testimonialAutoPlay = body.testimonialAutoPlay;
    if (body.testimonialDurationMs !== undefined) {
      data.testimonialDurationMs = Math.max(1000, Math.min(60000, Number(body.testimonialDurationMs) || 5000));
    }

    // The row almost always exists, so a single UPDATE; create only on the very first save.
    let settings;
    try {
      settings = await prisma.displaySettings.update({ where: { id: 'default' }, data });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2025') throw error;
      settings = await prisma.displaySettings.create({ data: { ...defaults, ...data } });
    }
    // Only a mode switch to video already knows its playlist; anything else resolves it from the row.
    const resolved = body.mode === 'video' ? playlist : undefined;
    const payload = await buildModeChanged(settings, resolved);
    await publishModeChanged(payload);

    return NextResponse.json({ ...settings, video: payload.video, playlist: payload.playlist });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save display settings' },
      { status: 500 }
    );
  }
}
