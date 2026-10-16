import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { publishModeChanged } from '@/server/realtime';
import type { DisplayVideo } from '@/lib/realtime/protocol';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const defaults = {
  id: 'default', heading: 'Testimonials', subtitle: '', mode: 'testimonials',
  videoUrl: null, videoAutoplay: true, videoLoop: true,
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

async function videoForUrl(url: string | null): Promise<DisplayVideo | null> {
  if (!url) return null;
  const video = await prisma.video.findFirst({ where: { url }, select: { id: true, url: true, title: true } });
  // A URL set before the video library existed still plays; it just has no title.
  return video ?? { id: '', url, title: 'Video' };
}

// Read once by the display on load (and by the admin); live changes then arrive over Ably.
export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json(
    { ...settings, video: await videoForUrl(settings.videoUrl) },
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

    let chosenVideo: DisplayVideo | null = null;
    if (body.mode === 'video') {
      const video =
        typeof body.videoId === 'string' && body.videoId
          ? await prisma.video.findUnique({ where: { id: body.videoId } })
          : await prisma.video.findFirst({ orderBy: { createdAt: 'desc' } });
      if (!video) {
        return NextResponse.json(
          { error: body.videoId ? 'That video no longer exists' : 'Upload a video first' },
          { status: body.videoId ? 404 : 409 }
        );
      }
      data.videoUrl = video.url;
      chosenVideo = { id: video.id, url: video.url, title: video.title };
    }

    if (typeof body.heading === 'string') data.heading = body.heading.trim() || 'Testimonials';
    if (typeof body.subtitle === 'string') data.subtitle = body.subtitle.trim();
    if (typeof body.videoAutoplay === 'boolean') data.videoAutoplay = body.videoAutoplay;
    if (typeof body.videoLoop === 'boolean') data.videoLoop = body.videoLoop;
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
    // Reuse the video we just looked up instead of querying for it again.
    const video = chosenVideo ?? (await videoForUrl(settings.videoUrl));

    await publishModeChanged({
      mode: settings.mode === 'video' ? 'video' : 'testimonials',
      video,
      testimonialAutoPlay: settings.testimonialAutoPlay,
      testimonialDurationMs: settings.testimonialDurationMs,
    });

    return NextResponse.json({ ...settings, video });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save display settings' },
      { status: 500 }
    );
  }
}
