import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from 'cloudinary';

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME || 'kn5bw2jw',
  api_key: process.env.CLOUDINARY_API_KEY || '883472345481137',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'cKAYrNG6FeENxvNFAtoBHowsq9I',
});

/**
 * Uploads a file to Cloudinary.
 * @param file - Can be a local file path, a remote URL, a base64 URI, or data stream.
 * @param options - Optional Cloudinary upload settings (e.g. folder, public_id, resource_type).
 * @returns Promise resolving to the upload response from Cloudinary.
 */
export async function uploadToCloudinary(
  file: string,
  options?: UploadApiOptions
): Promise<UploadApiResponse> {
  try {
    const result = await cloudinary.uploader.upload(file, {
      resource_type: 'auto', // Automatically detect image, video, raw, etc.
      ...options,
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Deletes a file from Cloudinary.
 * @param publicId - The public ID of the resource to delete.
 * @param options - Optional Cloudinary destroy settings (e.g., resource_type).
 * @returns Promise resolving to the deletion result.
 */
export async function deleteFromCloudinary(
  publicId: string,
  options?: { resource_type?: 'image' | 'video' | 'raw'; invalidate?: boolean }
): Promise<any> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image', // Defaults to image, but can be overridden
      ...options,
    });
    return result;
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw error;
  }
}

export { cloudinary };
