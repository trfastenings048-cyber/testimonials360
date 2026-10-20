// Uploads the encoded clips to Cloudinary and registers them as the ordered "Video 2" playlist.
//
//   DATABASE_URL=… CLOUDINARY_NAME=… CLOUDINARY_API_KEY=… CLOUDINARY_API_SECRET=… \
//     npx tsx scripts/upload-video-parts.ts ~/Videos/tr-fastening-parts
//
// Safe to re-run: each clip is upserted by its Cloudinary public id, so nothing is duplicated.
import { readdirSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { cloudinary } from '@/lib/cloudinary';
import { PARTS_SET_NAME } from '@/lib/realtime/protocol';
import { VIDEO_FOLDER, fetchVideoResource } from '@/server/videos';

async function main() {
  const directory = resolve(process.argv[2] ?? '');
  if (!process.argv[2] || !statSync(directory).isDirectory()) {
    throw new Error('Usage: npx tsx scripts/upload-video-parts.ts <folder with tr-fastening-part-NN.mp4 files>');
  }
  // The app's Prisma client falls back to a built-in database URL; refuse to rely on that here.
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL explicitly so the target database is deliberate.');
  const { prisma } = await import('@/server/prisma');

  const files = readdirSync(directory)
    .filter((name) => /^tr-fastening-part-\d+\.mp4$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length === 0) throw new Error(`No tr-fastening-part-NN.mp4 files found in ${directory}`);

  for (const [index, name] of files.entries()) {
    const position = index + 1;
    const publicId = `${VIDEO_FOLDER}/${basename(name, extname(name))}`;
    console.log(`[${position}/${files.length}] uploading ${name}…`);
    await cloudinary.uploader.upload_large(join(directory, name), {
      resource_type: 'video',
      public_id: basename(name, extname(name)),
      folder: VIDEO_FOLDER,
      overwrite: true,
      chunk_size: 20_000_000,
    });

    const resource = await fetchVideoResource(publicId);
    const title = `TR Fastening · Part ${position} of ${files.length}`;
    await prisma.video.upsert({
      where: { publicId: resource.publicId },
      create: { ...resource, title, setName: PARTS_SET_NAME, position },
      update: { ...resource, title, setName: PARTS_SET_NAME, position },
    });
  }
  console.log(`Done: ${files.length} parts registered as the "${PARTS_SET_NAME}" playlist.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
