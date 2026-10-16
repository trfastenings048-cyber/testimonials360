import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { publishContent } from '@/server/realtime';
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
    await publishContent('testimonial.updated', certificate);
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
    // Only the participant's own PDF is removed. `imageUrl` is the shared group photo that
    // other submissions and the big screen still use, so it must never be deleted here.
    if (certificate?.certificateUrl) {
      await deleteStoredObject(certificate.certificateUrl).catch((err) =>
        console.error('Failed to delete certificate PDF from Cloudinary:', err)
      );
    }

    const deleted = await prisma.certificate.deleteMany({ where: { id: trimmedId } });
    await publishContent('testimonial.deleted', { ids: [trimmedId] });
    return NextResponse.json({ success: true, deleted: deleted.count > 0, count: deleted.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete certificate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
