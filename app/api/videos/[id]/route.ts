import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { publishContent, publishModeChanged } from '@/server/realtime';
import { deleteVideoResource } from '@/server/videos';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const existing = await prisma.video.findUnique({ where: { id: decodeURIComponent(id) } });
    if (!existing) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const video = await prisma.video.update({ where: { id: existing.id }, data: { title } });
    return NextResponse.json(video);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update video';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({ where: { id: decodeURIComponent(id) } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    await deleteVideoResource(video.publicId).catch((error) => {
      // Still remove the record; an orphaned Cloudinary asset is better than a broken row.
      console.error('Failed to delete video from Cloudinary:', error);
    });
    await prisma.video.delete({ where: { id: video.id } });

    // Never leave the big screen pointing at a video that no longer exists.
    const cleared = await prisma.displaySettings.updateMany({
      where: { videoUrl: video.url },
      data: { videoUrl: null },
    });
    await publishContent('video.deleted', { id: video.id });
    if (cleared.count > 0) {
      const settings = await prisma.displaySettings.findUnique({ where: { id: 'default' } });
      if (settings) {
        await publishModeChanged({
          mode: settings.mode === 'video' ? 'video' : 'testimonials',
          video: null,
          testimonialAutoPlay: settings.testimonialAutoPlay,
          testimonialDurationMs: settings.testimonialDurationMs,
        });
      }
    }

    return NextResponse.json({ success: true, clearedFromDisplay: cleared.count > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete video';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
