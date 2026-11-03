import { Readable } from 'stream';

export interface StorageUploadResult {
  key: string;
  size: number;
  mimeType: string;
  driver: 'local' | 's3';
}

export interface StorageDownloadResult {
  stream: Readable;
  mimeType: string;
  size?: number;
  originalName?: string;
}

export interface IStorageDriver {
  name: 'local' | 's3';
  isConfigured: boolean;
  upload(
    key: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult>;
  getDownloadStream(key: string): Promise<StorageDownloadResult>;
  getPresignedDownloadUrl?(key: string, expiresInSeconds?: number): Promise<string>;
  getPresignedUploadUrl?(key: string, mimeType?: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<boolean>;
  deletePrefix(prefix: string): Promise<number>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}
