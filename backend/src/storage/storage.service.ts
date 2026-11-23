import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, resolve, join } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly client: S3Client | null;
  private readonly localRoot: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('storage.bucket')?.trim() ?? '';
    this.region = config.get<string>('storage.region')?.trim() ?? '';
    this.localRoot = resolve(__dirname, '..', '..', 'uploads');
    this.client = this.bucket
      ? new S3Client(this.region ? { region: this.region } : {})
      : null;
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    if (this.client) {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
      return;
    }

    const path = join(this.localRoot, ...key.split('/'));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    if (this.client) {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return;
    }

    const path = join(this.localRoot, ...key.split('/'));
    await unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  async getUrl(key: string): Promise<string | null> {
    if (!key) return null;
    if (!this.client) {
      const port = process.env.PORT || '3001';
      return `http://localhost:${port}/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
    }
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 900 },
    );
  }

  isS3(): boolean {
    return !!this.client;
  }

  logDeleteError(error: unknown): void {
    this.logger.warn(`Best-effort logo deletion failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
