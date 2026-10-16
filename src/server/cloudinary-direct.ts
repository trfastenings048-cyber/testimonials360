import { cloudinary } from '@/lib/cloudinary';

// Direct browser → Cloudinary uploads. Our API only signs the request and later verifies
// the result, so file bytes never pass through a Vercel function (no 4.5 MB body limit,
// no function bandwidth).

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super(
      'Cloudinary is not configured. Set CLOUDINARY_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the server environment.'
    );
  }
}

export function getCloudinaryCredentials() {
  const config = cloudinary.config();
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new CloudinaryNotConfiguredError();
  }
  return { cloudName: config.cloud_name, apiKey: config.api_key, apiSecret: config.api_secret };
}

/**
 * Signs the parameters the browser will send with its direct upload, so the API secret
 * never leaves the server. The client must send exactly these params.
 */
export function createUploadSignature(folder: string) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);
  return { cloudName, apiKey, timestamp, signature, folder };
}

/** Reads an uploaded image's authoritative details instead of trusting the browser. */
export async function fetchImageResource(publicId: string) {
  getCloudinaryCredentials();
  const resource = await cloudinary.api.resource(publicId, { resource_type: 'image' });
  return { publicId: resource.public_id as string, url: resource.secure_url as string };
}

/** Maps errors from the Cloudinary SDK (plain objects, not Errors) to an HTTP response shape. */
export function describeCloudinaryError(error: unknown, fallback: string) {
  if (error instanceof CloudinaryNotConfiguredError) return { status: 503, message: error.message };
  const cloudinaryError = (error as { error?: { message?: string; http_code?: number } })?.error;
  if (cloudinaryError?.http_code === 404) return { status: 404, message: 'That file was not found on Cloudinary' };
  return {
    status: 500,
    message: cloudinaryError?.message || (error instanceof Error ? error.message : fallback),
  };
}
