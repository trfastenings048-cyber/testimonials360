import { NextResponse } from 'next/server';
import { createUploadSignature, describeCloudinaryError } from '@/server/cloudinary-direct';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Must match the folder /api/images/upload accepts.
const IMAGE_FOLDER = 'content';

// Short-lived signature so the admin's browser can upload a group photo straight to Cloudinary.
export async function POST() {
  try {
    return NextResponse.json(createUploadSignature(IMAGE_FOLDER), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = describeCloudinaryError(error, 'Failed to sign upload');
    return NextResponse.json({ error: message }, { status });
  }
}
