import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { fetchStoredObject } from '@/server/uploads';

type Params = { params: Promise<{ id: string }> };

function safeCertificateName(userName: string) {
  const baseName = userName.trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'certificate';
  return `Certificate_${baseName}.pdf`;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const certificate = await prisma.certificate.findUnique({ where: { id } });

    if (!certificate?.certificateUrl) {
      return NextResponse.json({ error: 'Certificate PDF not found' }, { status: 404 });
    }

    const storedResponse = await fetchStoredObject(certificate.certificateUrl);
    if (!storedResponse) {
      return NextResponse.json({ error: 'Stored certificate URL is not downloadable' }, { status: 422 });
    }
    if (!storedResponse.ok) {
      return NextResponse.json({ error: 'Unable to retrieve the stored certificate PDF' }, { status: 502 });
    }

    const pdfBuffer = Buffer.from(await storedResponse.arrayBuffer());

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': storedResponse.headers.get('content-type') || 'application/pdf',
        'Content-Length': String(pdfBuffer.length),
        'Content-Disposition': `attachment; filename="${safeCertificateName(certificate.userName)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download certificate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
