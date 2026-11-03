import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { IStorageDriver, StorageDownloadResult, StorageUploadResult } from './types';

export class S3StorageDriver implements IStorageDriver {
  public readonly name = 's3' as const;
  public readonly isConfigured: boolean;
  private s3Client: S3Client;
  private bucket: string;
  private publicDomain?: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId =
      process.env.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID || '';
    const secretAccessKey =
      process.env.S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY || '';
    this.bucket =
      process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || 'drive-assets';
    this.publicDomain =
      process.env.S3_PUBLIC_URL || process.env.S3_PUBLIC_DOMAIN;
    
    // For MinIO and custom endpoints, forcePathStyle should be true by default
    const forcePathStyle =
      process.env.S3_FORCE_PATH_STYLE === 'false'
        ? false
        : true; // Default true for MinIO compatibility

    // Verify if keys are real or placeholders
    const isPlaceholder =
      !accessKeyId ||
      !secretAccessKey ||
      accessKeyId.includes('PLACEHOLDER') ||
      secretAccessKey.includes('PLACEHOLDER');

    this.isConfigured = !isPlaceholder;

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint && !endpoint.includes('your-account-id') ? endpoint : undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);

    return {
      key: cleanKey,
      size: buffer.length,
      mimeType,
      driver: 's3',
    };
  }

  async getDownloadStream(key: string): Promise<StorageDownloadResult> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`S3 object body is empty for key: ${key}`);
    }

    const stream = response.Body as unknown as Readable;

    return {
      stream,
      mimeType: response.ContentType || 'application/octet-stream',
      size: response.ContentLength,
    };
  }

  async getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.publicDomain) {
      const cleanKey = key.replace(/^[/\\]+/, '');
      const baseUrl = this.publicDomain.replace(/\/$/, '');
      if (baseUrl.endsWith(`/${this.bucket}`)) {
        return `${baseUrl}/${cleanKey}`;
      }
      return `${baseUrl}/${this.bucket}/${cleanKey}`;
    }

    const cleanKey = key.replace(/^[/\\]+/, '');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async getPresignedUploadUrl(key: string, mimeType = 'application/octet-stream', expiresInSeconds = 3600): Promise<string> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      ContentType: mimeType,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<boolean> {
    try {
      const cleanKey = key.replace(/^[/\\]+/, '');
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch (err) {
      console.error(`S3 delete failed for key ${key}:`, err);
      return false;
    }
  }

  async deletePrefix(prefix: string): Promise<number> {
    try {
      const cleanPrefix = prefix.replace(/^[/\\]+/, '');
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: cleanPrefix,
      });

      const listRes = await this.s3Client.send(listCommand);
      if (!listRes.Contents || listRes.Contents.length === 0) return 0;

      let count = 0;
      for (const item of listRes.Contents) {
        if (item.Key) {
          await this.delete(item.Key);
          count++;
        }
      }
      return count;
    } catch (err) {
      console.error(`S3 deletePrefix failed for ${prefix}:`, err);
      return 0;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      return {
        success: false,
        message: 'مفاتيح S3 غير مكتملة أو ما زالت افتراضية.',
      };
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });
      await this.s3Client.send(command);
      return {
        success: true,
        message: `تم الاتصال بنجاح بمزود التخزين السحابي MinIO S3 (Bucket: ${this.bucket})`,
      };
    } catch (err: any) {
      try {
        const headCmd = new HeadBucketCommand({ Bucket: this.bucket });
        await this.s3Client.send(headCmd);
        return {
          success: true,
          message: `تم التحقق بنجاح من وجود الحاوية السحابية (Bucket: ${this.bucket})`,
        };
      } catch (headErr: any) {
        return {
          success: false,
          message: `تعذر الاتصال بـ MinIO S3: ${err.message || headErr.message || 'خطأ في المصادقة'}`,
        };
      }
    }
  }
}
