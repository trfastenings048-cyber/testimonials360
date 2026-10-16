import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { publishContent } from '@/server/realtime';
import { describeCloudinaryError, fetchImageResource } from '@/server/cloudinary-direct';

export const runtime = 'nodejs';

const IMAGE_FOLDER = 'content';

// Called after the browser has uploaded the photo directly to Cloudinary. Only the
// Cloudinary id arrives here; the file itself never passes through this function.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';
    const groupName = typeof body.groupName === 'string' ? body.groupName.trim().slice(0, 120) : '';

    if (!publicId.startsWith(`${IMAGE_FOLDER}/`)) {
      return NextResponse.json({ error: 'A Cloudinary image publicId is required' }, { status: 400 });
    }

    // Trust Cloudinary's record, not the client, for the final URL.
    const resource = await fetchImageResource(publicId);
    const image = await prisma.eventImage.create({
      data: { url: resource.url, groupName: groupName || 'General', timestamp: Date.now(), isVisible: true },
    });

    await publishContent('image.updated', image);
    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    const { status, message } = describeCloudinaryError(error, 'Failed to save image');
    return NextResponse.json({ error: message }, { status });
  }
}
