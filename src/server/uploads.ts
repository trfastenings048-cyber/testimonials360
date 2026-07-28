import { Readable } from 'stream';
import { cloudinary, getPublicIdFromUrl } from '@/lib/cloudinary';

type UploadFolder = 'content' | 'certificates' | string;

const sanitizePathPart = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'file';

/**
 * Saves an uploaded file to Cloudinary.
 * @param file - The Next.js / browser File object.
 * @param folder - Folder path to save the file in.
 * @param uid - Optional unique identifier to prefix the filename.
 */
export async function saveUploadedFile(file: File, folder: UploadFolder = 'uploads', uid?: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const cleanFolder = sanitizePathPart(folder);
  const cleanName = sanitizePathPart(file.name);
  const prefix = uid ? sanitizePathPart(uid) : Date.now().toString();
  
  // Create a unique filename without extension for the public_id
  const nameWithoutExtension = cleanName.replace(/\.[^/.]+$/, "");
  const filename = `${prefix}_${Date.now()}_${nameWithoutExtension}`;
  const contentType = file.type || 'application/octet-stream';

  // Upload to Cloudinary using a stream
  const uploadResult = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cleanFolder,
        public_id: filename,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(bytes).pipe(stream);
  });

  return {
    filename: filename,
    objectName: uploadResult.public_id,
    url: uploadResult.secure_url,
    contentType,
    size: bytes.length,
  };
}

/**
 * Fetches a stored object from its public Cloudinary URL.
 * @param url - The secure Cloudinary URL.
 */
export async function fetchStoredObject(url: string) {
  // Cloudinary URLs are public, so they can be fetched directly without authorization headers.
  return fetch(url);
}

/**
 * Deletes a file from Cloudinary by its public ID or full URL.
 * @param identifier - The public ID of the resource or its URL.
 */
export async function deleteStoredObject(identifier: string) {
  try {
    const publicId = getPublicIdFromUrl(identifier) || identifier;
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Failed to delete Cloudinary object:', error);
    throw error;
  }
}
