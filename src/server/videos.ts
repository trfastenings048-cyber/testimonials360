import { cloudinary } from '@/lib/cloudinary';
import { createUploadSignature, getCloudinaryCredentials } from './cloudinary-direct';

export const VIDEO_FOLDER = 'videos';

export const VIDEO_SORT_FIELDS = ['title', 'createdAt', 'duration', 'bytes', 'format'] as const;
export type VideoSortField = (typeof VIDEO_SORT_FIELDS)[number];
export const VIDEO_PAGE_SIZES = [10, 25, 50] as const;

export { CloudinaryNotConfiguredError, getCloudinaryCredentials } from './cloudinary-direct';

/** Signs a direct browser → Cloudinary video upload into the videos folder. */
export function createVideoUploadSignature() {
  return createUploadSignature(VIDEO_FOLDER);
}

/** Reads authoritative metadata from Cloudinary instead of trusting what the browser reports. */
export async function fetchVideoResource(publicId: string) {
  getCloudinaryCredentials();
  const resource = await cloudinary.api.resource(publicId, { resource_type: 'video' });
  const thumbnailUrl = cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    secure: true,
    transformation: [{ start_offset: '1', width: 320, height: 180, crop: 'fill' }],
  });

  return {
    publicId: resource.public_id as string,
    url: resource.secure_url as string,
    thumbnailUrl,
    format: String(resource.format || ''),
    bytes: Number(resource.bytes) || 0,
    duration: typeof resource.duration === 'number' ? resource.duration : null,
    width: typeof resource.width === 'number' ? resource.width : null,
    height: typeof resource.height === 'number' ? resource.height : null,
  };
}

export async function deleteVideoResource(publicId: string) {
  getCloudinaryCredentials();
  return cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
}

export function parseVideoListQuery(searchParams: URLSearchParams) {
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const requestedSize = Number(searchParams.get('pageSize'));
  const pageSize = (VIDEO_PAGE_SIZES as readonly number[]).includes(requestedSize) ? requestedSize : VIDEO_PAGE_SIZES[0];
  const requestedSort = searchParams.get('sort');
  const sort: VideoSortField = (VIDEO_SORT_FIELDS as readonly string[]).includes(requestedSort ?? '')
    ? (requestedSort as VideoSortField)
    : 'createdAt';
  const order: 'asc' | 'desc' = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const q = (searchParams.get('q') || '').trim().slice(0, 100);
  return { page, pageSize, sort, order, q };
}
