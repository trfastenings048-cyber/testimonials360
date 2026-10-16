import { NextResponse } from 'next/server';
import { CloudinaryNotConfiguredError, createVideoUploadSignature } from '@/server/videos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns a short-lived signature so the browser can upload straight to Cloudinary.
export async function POST() {
  try {
    return NextResponse.json(createVideoUploadSignature(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof CloudinaryNotConfiguredError ? 503 : 500;
    const message = error instanceof Error ? error.message : 'Failed to sign upload';
    return NextResponse.json({ error: message }, { status });
  }
}
