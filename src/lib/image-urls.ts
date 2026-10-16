// Group photos are served straight from Cloudinary's CDN, resized for where they appear.
// `f_auto,q_auto` lets Cloudinary pick WebP/AVIF and a sensible quality, so a 1.7 MB PNG
// becomes a few KB as a thumbnail. None of this goes through a Vercel function.

const WIDTHS = {
  /** Lists and dropdown icons (2× the largest rendered size, for sharp retina displays). */
  thumb: 160,
  /** Portal preview, admin detail dialog. */
  card: 960,
  /** Big screen, full-bleed slideshow. */
  full: 1920,
} as const;

export type ImageSize = keyof typeof WIDTHS;

const UPLOAD_MARKER = '/image/upload/';

export function imageSrc(image: { url: string }, size: ImageSize = 'card') {
  const { url } = image;
  const markerIndex = url.indexOf(UPLOAD_MARKER);
  if (!url.includes('res.cloudinary.com') || markerIndex === -1) return url;
  const insertAt = markerIndex + UPLOAD_MARKER.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,c_limit,w_${WIDTHS[size]}/${url.slice(insertAt)}`;
}

/** Safe download filename for a group photo, e.g. "Group_A.png". */
export function groupImageFileName(groupName: string, mimeType: string) {
  const base = groupName.trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'group_image';
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') || 'jpg';
  return `${base}.${extension}`;
}
