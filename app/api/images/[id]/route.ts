import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { broadcastUpdate } from '@/server/realtime';
import { deleteStoredObject } from '@/server/uploads';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Image id is required' }, { status: 400 });
    }

    const trimmedId = decodeURIComponent(id.trim());
    const { isVisible } = await request.json();

    const existing = await prisma.eventImage.findUnique({ where: { id: trimmedId } });
    if (!existing) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const image = await prisma.eventImage.update({
      where: { id: trimmedId },
      data: { isVisible: Boolean(isVisible) },
    });

    broadcastUpdate('content-updated', { action: 'image-updated' });
    return NextResponse.json(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Image id is required' }, { status: 400 });
    }

    const trimmedId = decodeURIComponent(id.trim());
    const image = await prisma.eventImage.findUnique({ where: { id: trimmedId } });
    if (image?.url) {
      await deleteStoredObject(image.url).catch((err) =>
        console.error('Failed to delete image from Cloudinary:', err)
      );
    }

    const deleted = await prisma.eventImage.deleteMany({ where: { id: trimmedId } });
    broadcastUpdate('content-updated', { action: 'image-deleted' });
    return NextResponse.json({ success: true, deleted: deleted.count > 0, count: deleted.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

