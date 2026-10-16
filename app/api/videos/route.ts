import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { publishContent } from '@/server/realtime';
import {
  CloudinaryNotConfiguredError,
  VIDEO_FOLDER,
  fetchVideoResource,
  parseVideoListQuery,
} from '@/server/videos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Paginated, sortable, searchable list.
export async function GET(request: NextRequest) {
  try {
    const { page, pageSize, sort, order, q } = parseVideoListQuery(request.nextUrl.searchParams);
    const where = q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { format: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      prisma.video.count({ where }),
      prisma.video.findMany({
        where,
        // Secondary key keeps paging stable when the primary values tie. Only duration is
        // nullable, and Prisma rejects a nulls option on required columns.
        orderBy: [sort === 'duration' ? { duration: { sort: order, nulls: 'last' } } : { [sort]: order }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json(
      { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), sort, order, q },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Called after the browser finishes its direct upload to Cloudinary.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';

    if (!publicId.startsWith(`${VIDEO_FOLDER}/`)) {
      return NextResponse.json({ error: 'A Cloudinary video publicId is required' }, { status: 400 });
    }

    const resource = await fetchVideoResource(publicId);
    const video = await prisma.video.upsert({
      where: { publicId: resource.publicId },
      create: { ...resource, title: title || resource.publicId.split('/').pop() || 'Untitled video' },
      update: { ...resource, ...(title ? { title } : {}) },
    });

    await publishContent('video.created', video);
    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    if (error instanceof CloudinaryNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // The Cloudinary SDK rejects with a plain object ({ error: { message, http_code } }).
    const cloudinaryError = (error as { error?: { message?: string; http_code?: number } })?.error;
    if (cloudinaryError?.http_code === 404) {
      return NextResponse.json({ error: 'That video was not found on Cloudinary' }, { status: 404 });
    }
    const message = cloudinaryError?.message || (error instanceof Error ? error.message : 'Failed to save video');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
