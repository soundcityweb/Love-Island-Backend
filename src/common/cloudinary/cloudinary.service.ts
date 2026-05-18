import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Upload a file buffer to Cloudinary.
   * @param buffer  Raw file bytes from multer memory storage
   * @param folder  Cloudinary folder path (e.g. "applications/uuid/images")
   * @param resourceType  "image" | "video" | "raw" | "auto" (default: "auto")
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                `Cloudinary upload failed: ${error?.message ?? 'unknown error'}`,
              ),
            );
            return;
          }
          resolve({ secureUrl: result.secure_url, publicId: result.public_id });
        },
      );
      Readable.from(buffer).pipe(uploadStream);
    });
  }

  /**
   * Delete an asset from Cloudinary by its public_id.
   * Silently ignores "not found" results so cleanup never throws.
   */
  async destroy(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      console.error(`Cloudinary destroy failed for public_id "${publicId}":`, error);
    }
  }

  /**
   * Extract the Cloudinary public_id from a secure_url.
   * e.g. "https://res.cloudinary.com/demo/image/upload/v1/folder/file.jpg" → "folder/file"
   * Returns null if the URL is not a recognisable Cloudinary URL.
   */
  static extractPublicId(secureUrl: string): string | null {
    try {
      const url = new URL(secureUrl);
      if (!url.hostname.endsWith('cloudinary.com')) return null;
      // Path: /<cloud>/image|video|raw/upload/<version>/<public_id>.<ext>
      const parts = url.pathname.split('/');
      const uploadIdx = parts.indexOf('upload');
      if (uploadIdx === -1) return null;
      // Skip the version segment (starts with "v" + digits) if present
      let after = parts.slice(uploadIdx + 1);
      if (after[0] && /^v\d+$/.test(after[0])) after = after.slice(1);
      const withExt = after.join('/');
      return withExt.replace(/\.[^.]+$/, '');
    } catch {
      return null;
    }
  }
}
