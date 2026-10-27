import { groupImageFileName } from '@/lib/image-urls';

export type SummaryRecord = {
  id: string;
  name: string;
  email: string;
  team: string;
  imageUrl: string;
  certificateGenerated: boolean;
};

export interface EventImage {
  id: string;
  url: string;
  groupName: string;
  timestamp: number;
  isVisible: boolean;
}

export interface CertificateRecord {
  id: string;
  userName: string;
  userEmail: string;
  groupName: string;
  imageUrl: string;
  teamName?: string;
  designation?: string;
  certificateUrl?: string;
  feedback?: string;
  showOnDisplay?: boolean;
  gradient?: string;
  createdAt: number;
}

// Fetch the summary matching the expected ServerDetails structure
export const fetchSummary = async (): Promise<{ totalSubmissions: number; submissions: SummaryRecord[] }> => {
  const resp = await fetch('/api/summary');
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to fetch summary');
  }
  return await resp.json();
};

// Upload file locally (with progress reporting)
export const uploadFile = async (
  file: File | Blob,
  uid: string,
  folder: string = 'certificates',
  onProgress?: (pct: number) => void
): Promise<string> => {
  const formData = new FormData();
  const originalName = file instanceof File ? file.name : `file_${Date.now()}.pdf`;
  formData.append('file', file, originalName);
  formData.append('folder', folder);
  formData.append('uid', uid);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res.url);
        } catch (e) {
          reject(new Error('Invalid upload response'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload network error'));
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
};

// Fetch images (optionally filter by isVisible)
export const fetchImages = async (isVisible?: boolean, limit?: number): Promise<EventImage[]> => {
  const params = new URLSearchParams();
  if (isVisible !== undefined) params.append('isVisible', String(isVisible));
  if (limit !== undefined) params.append('limit', String(limit));
  const queryString = params.toString();
  const url = queryString ? `/api/images?${queryString}` : '/api/images';
  
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Failed to fetch images');
  }
  return await resp.json();
};

// Create new image record
export const createImage = async (data: { url: string; groupName: string; timestamp: number }): Promise<EventImage> => {
  const resp = await fetch('/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to create image');
  }
  return await resp.json();
};

// Upload image file and save record directly into DB
/**
 * Uploads a group photo straight from the browser to Cloudinary (signed by our API), then
 * registers it. The file never passes through a Vercel function, so large photos work.
 */
export const uploadImageToDB = async (
  file: File,
  groupName: string,
  { onProgress, signal }: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}
): Promise<EventImage> => {
  const publicId = await uploadToCloudinary(file, { signUrl: '/api/images/sign', resourceType: 'image', onProgress, signal });
  const resp = await fetch('/api/images/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId, groupName }),
    signal,
  });
  if (!resp.ok) throw await readError(resp, 'Uploaded, but saving the photo failed');
  onProgress?.(100);
  return resp.json();
};

// Update image visibility
export const updateImageVisibility = async (id: string, isVisible: boolean): Promise<EventImage> => {
  const resp = await fetch(`/api/images/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isVisible }),
  });
  if (!resp.ok) {
    throw new Error('Failed to update image visibility');
  }
  return await resp.json();
};

/**
 * Downloads the original group photo. It is fetched straight from Cloudinary's CDN (no Vercel
 * function or bandwidth); the API route is only a fallback if that request fails.
 */
export const downloadGroupImage = async (
  image: Pick<EventImage, 'id' | 'url' | 'groupName'>
): Promise<{ blob: Blob; filename: string }> => {
  try {
    const direct = await fetch(image.url, { mode: 'cors' });
    if (direct.ok) {
      const blob = await direct.blob();
      return { blob, filename: groupImageFileName(image.groupName, blob.type || 'image/jpeg') };
    }
  } catch {
    // Fall through to the API route.
  }

  const resp = await fetch(`/api/images/${encodeURIComponent(image.id)}/download`);
  if (!resp.ok) {
    const result = await resp.json().catch(() => null);
    throw new Error(result?.error || 'Failed to download group image');
  }

  const disposition = resp.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);

  return {
    blob: await resp.blob(),
    filename: filenameMatch?.[1] || 'group_image.jpg',
  };
};

// Delete image
export const deleteImage = async (id: string): Promise<void> => {
  const resp = await fetch(`/api/images/${id}`, { method: 'DELETE' });
  if (!resp.ok) {
    throw new Error('Failed to delete image');
  }
};

// Fetch certificates (optionally filter by showOnDisplay)
export const fetchCertificates = async (showOnDisplay?: boolean, limit?: number): Promise<CertificateRecord[]> => {
  const params = new URLSearchParams();
  if (showOnDisplay !== undefined) params.append('showOnDisplay', String(showOnDisplay));
  if (limit !== undefined) params.append('limit', String(limit));
  const queryString = params.toString();
  const url = queryString ? `/api/certificates?${queryString}` : '/api/certificates';
  
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Failed to fetch certificates');
  }
  return await resp.json();
};

// Create new certificate
export const createCertificate = async (data: Omit<CertificateRecord, 'id'>): Promise<CertificateRecord> => {
  const resp = await fetch('/api/certificates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to create certificate');
  }
  return await resp.json();
};

export const downloadCertificateFile = async (id: string): Promise<{ blob: Blob; filename: string }> => {
  const resp = await fetch(`/api/certificates/${encodeURIComponent(id)}/download`);
  if (!resp.ok) {
    const result = await resp.json().catch(() => null);
    throw new Error(result?.error || 'Failed to download certificate');
  }

  const disposition = resp.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);

  return {
    blob: await resp.blob(),
    filename: filenameMatch?.[1] || 'certificate.pdf',
  };
};

// Update certificate fields (like display status or group name)
export const updateCertificate = async (id: string, data: { showOnDisplay?: boolean; groupName?: string }): Promise<CertificateRecord> => {
  const resp = await fetch(`/api/certificates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    throw new Error('Failed to update certificate');
  }
  return await resp.json();
};

// Update certificate display status
export const updateCertificateDisplay = async (id: string, showOnDisplay: boolean): Promise<CertificateRecord> => {
  return updateCertificate(id, { showOnDisplay });
};

// Delete single certificate
export const deleteCertificate = async (id: string): Promise<void> => {
  const resp = await fetch(`/api/certificates/${id}`, { method: 'DELETE' });
  if (!resp.ok) {
    const result = await resp.json().catch(() => null);
    throw new Error(result?.error || 'Failed to delete certificate');
  }
};

// Bulk delete certificates (or clear all if ids is omitted)
export const bulkDeleteCertificates = async (ids?: string[]): Promise<void> => {
  const resp = await fetch('/api/certificates', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!resp.ok) {
    throw new Error('Failed to delete certificates');
  }
};

export type DisplaySettings = {
  id: string; heading: string; subtitle: string; mode: 'video' | 'testimonials'; videoUrl?: string | null;
  videoAutoplay: boolean; videoLoop: boolean; videoMuted: boolean; videoVolume: number; testimonialAutoPlay: boolean; testimonialDurationMs: number;
  /** The video the screen plays in video mode (resolved by the server). */
  video?: { id: string; url: string; title: string } | null;
  /** "single" = latest standalone upload, "parts" = the ordered clip set. */
  videoSet?: 'single' | 'parts';
  /** What video mode plays, in order (resolved by the server). */
  playlist?: { id: string; url: string; title: string }[];
};

export const fetchDisplaySettings = async (): Promise<DisplaySettings> => {
  const response = await fetch('/api/display-settings', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to load display settings');
  return response.json();
};

export type DisplaySettingsUpdate = Partial<
  Pick<
    DisplaySettings,
    'mode' | 'heading' | 'subtitle' | 'videoAutoplay' | 'videoLoop' | 'videoMuted' | 'videoVolume' | 'testimonialAutoPlay' | 'testimonialDurationMs'
  >
> & {
  /** With mode 'video': play this video instead of the latest upload. */
  videoId?: string;
  /** With mode 'video': which video to play. */
  videoSet?: 'single' | 'parts';
};

/** Partial update; switching to video mode plays the latest upload unless videoId is given. */
export const updateDisplaySettings = async (data: DisplaySettingsUpdate): Promise<DisplaySettings> => {
  const response = await fetch('/api/display-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await readError(response, 'Failed to save display settings');
  return response.json();
};

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

export type VideoRecord = {
  id: string;
  title: string;
  publicId: string;
  url: string;
  thumbnailUrl: string;
  format: string;
  bytes: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  setName?: string | null;
  position?: number | null;
};

export type VideoSortField = 'title' | 'createdAt' | 'duration' | 'bytes' | 'format';

export type VideoListQuery = {
  page: number;
  pageSize: number;
  sort: VideoSortField;
  order: 'asc' | 'desc';
  q: string;
  /** Only videos that aren't part of a clip set (what "Video 1" plays). */
  standalone?: boolean;
  /** Only the clips of the ordered playlist ("Video 2"). */
  set?: 'parts';
};

export type VideoListResponse = VideoListQuery & {
  items: VideoRecord[];
  total: number;
  pageCount: number;
};

const readError = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => null);
  return new Error(body?.error || fallback);
};

export const fetchVideos = async (query: VideoListQuery, signal?: AbortSignal): Promise<VideoListResponse> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
    order: query.order,
  });
  if (query.q) params.set('q', query.q);
  if (query.standalone) params.set('standalone', '1');
  if (query.set) params.set('set', query.set);
  const response = await fetch(`/api/videos?${params}`, { cache: 'no-store', signal });
  if (!response.ok) throw await readError(response, 'Failed to load videos');
  return response.json();
};

export const renameVideo = async (id: string, title: string): Promise<VideoRecord> => {
  const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw await readError(response, 'Failed to rename video');
  return response.json();
};

export const deleteVideo = async (id: string): Promise<{ clearedFromDisplay: boolean }> => {
  const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) throw await readError(response, 'Failed to delete video');
  return response.json();
};

// Cloudinary requires every chunk but the last to be at least 5MB.
const UPLOAD_CHUNK_BYTES = 20 * 1024 * 1024;

type UploadSignature = { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string };

const postChunk = (
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onChunkProgress: (loaded: number) => void,
  signal?: AbortSignal
) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.addEventListener('progress', (event) => onChunkProgress(event.loaded));
    xhr.addEventListener('load', () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Leave body empty; handled below.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else {
        const message = (body.error as { message?: string } | undefined)?.message;
        reject(new Error(message || `Cloudinary upload failed (HTTP ${xhr.status})`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error while uploading to Cloudinary')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });

type CloudinaryUploadOptions = {
  signUrl: string;
  resourceType: 'image' | 'video';
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

/**
 * Uploads a file straight from the browser to Cloudinary using a signature from our API
 * (the secret stays on the server), in chunks for large files. Returns the publicId.
 */
export const uploadToCloudinary = async (
  file: File,
  { signUrl, resourceType, onProgress, signal }: CloudinaryUploadOptions
): Promise<string> => {
  const signResponse = await fetch(signUrl, { method: 'POST', signal });
  if (!signResponse.ok) throw await readError(signResponse, 'Could not start the upload');
  const sig: UploadSignature = await signResponse.json();

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/${resourceType}/upload`;
  const uploadId = `upl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const total = file.size;
  let result: Record<string, unknown> = {};

  for (let start = 0; start < total || (total === 0 && start === 0); start += UPLOAD_CHUNK_BYTES) {
    const end = Math.min(start + UPLOAD_CHUNK_BYTES, total);
    const form = new FormData();
    form.append('file', file.slice(start, end), file.name);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', sig.folder);

    const headers: Record<string, string> =
      total > UPLOAD_CHUNK_BYTES
        ? { 'X-Unique-Upload-Id': uploadId, 'Content-Range': `bytes ${start}-${end - 1}/${total}` }
        : {};

    result = await postChunk(
      endpoint,
      form,
      headers,
      (loaded) => onProgress?.(total ? Math.min(99, Math.round(((start + loaded) / total) * 100)) : 99),
      signal
    );
    if (total === 0) break;
  }

  const publicId = typeof result.public_id === 'string' ? result.public_id : '';
  if (!publicId) throw new Error('Cloudinary did not return a file id');
  return publicId;
};

/** Uploads a video directly to Cloudinary, then records it in the DB. */
export const uploadVideo = async (
  file: File,
  title: string,
  { onProgress, signal }: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}
): Promise<VideoRecord> => {
  const publicId = await uploadToCloudinary(file, { signUrl: '/api/videos/sign', resourceType: 'video', onProgress, signal });
  const saveResponse = await fetch('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId, title }),
    signal,
  });
  if (!saveResponse.ok) throw await readError(saveResponse, 'Uploaded, but saving the video details failed');
  onProgress?.(100);
  return saveResponse.json();
};

