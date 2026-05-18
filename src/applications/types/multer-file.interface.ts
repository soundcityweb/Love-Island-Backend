/** Minimal type for uploaded file (multer memory storage) */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

export type UploadedFilesMap = {
  images?: UploadedFile[];
  video?: UploadedFile[];
};
