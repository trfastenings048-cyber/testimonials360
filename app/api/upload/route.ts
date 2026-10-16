import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { publishContent } from '@/server/realtime';
import { ADMIN_COOKIE, isValidAdminSession } from '@/server/admin-auth';
import { saveUploadedFile } from '@/server/uploads';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const folder = String(formData.get('folder') || 'uploads');
    const uid = formData.get('uid');
    const groupNameValue = formData.get('groupName');
    const saveToDb = formData.get('saveToDb');
    const createsDisplayImage = Boolean(groupNameValue) || saveToDb === 'true';

    // Plain uploads (certificate PDFs from the portal) stay public; creating a big-screen
    // image is an admin action.
    if (createsDisplayImage && !(await isValidAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))) {
      return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
    }

    const { url } = await saveUploadedFile(file, folder, uid ? String(uid) : undefined);

    if (createsDisplayImage) {
      const groupName = String(groupNameValue || '').trim() || 'Uploaded Image';
      const image = await prisma.eventImage.create({
        data: { url, groupName, timestamp: Date.now(), isVisible: true },
      });
      await publishContent('image.updated', image);
      return NextResponse.json({ url, image }, { status: 201 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
