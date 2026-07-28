import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { broadcastUpdate } from '@/server/realtime';
import { deleteStoredObject } from '@/server/uploads';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { showOnDisplay, groupName } = await request.json();
    const data: { showOnDisplay?: boolean; groupName?: string } = {};

    if (showOnDisplay !== undefined) data.showOnDisplay = showOnDisplay;
    if (groupName !== undefined) data.groupName = groupName;

    const certificate = await prisma.certificate.update({ where: { id }, data });
    broadcastUpdate('content-updated', { action: 'cert-updated' });
    return NextResponse.json(certificate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update certificate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!id?.trim()) {
      return NextResponse.json({ error: 'Certificate id is required' }, { status: 400 });
    }

    const trimmedId = id.trim();
    const certificate = await prisma.certificate.findUnique({ where: { id: trimmedId } });
    if (certificate) {
      if (certificate.certificateUrl) {
        await deleteStoredObject(certificate.certificateUrl).catch((err) =>
          console.error('Failed to delete certificate PDF from Cloudinary:', err)
        );
      }
      if (certificate.imageUrl) {
        await deleteStoredObject(certificate.imageUrl).catch((err) =>
          console.error('Failed to delete certificate image from Cloudinary:', err)
        );
      }
    }

    const deleted = await prisma.certificate.deleteMany({ where: { id: trimmedId } });
    broadcastUpdate('content-updated', { action: 'cert-deleted' });
    return NextResponse.json({ success: true, deleted: deleted.count > 0, count: deleted.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete certificate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
