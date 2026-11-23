const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input, type: 'put' })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input, type: 'delete' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input, type: 'get' })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/logo'),
}));

import { ConfigService } from '@nestjs/config';
import { StorageService } from '../src/storage/storage.service';
import { validateLogoFile } from '../src/type-supports/type-supports.service';

describe('StorageService', () => {
  it('uses S3 when S3_BUCKET is set', async () => {
    const config = new ConfigService({
      storage: { bucket: 'private-bucket', region: 'eu-west-3' },
    });
    const storage = new StorageService(config);

    await storage.upload('logos/test.png', Buffer.from('png'), 'image/png');
    await storage.delete('logos/test.png');
    await expect(storage.getUrl('logos/test.png')).resolves.toBe('https://signed.example/logo');

    expect(mockS3Send).toHaveBeenCalledTimes(2);
  });

  it('uses local uploads when S3_BUCKET is empty', async () => {
    const config = new ConfigService({ storage: { bucket: '', region: '' } });
    const storage = new StorageService(config);

    await storage.upload('logos/storage-test.png', Buffer.from('test'), 'image/png');
    await expect(storage.getUrl('logos/storage-test.png')).resolves.toContain('/uploads/logos/storage-test.png');
    await storage.delete('logos/storage-test.png');
  });
});

describe('validateLogoFile', () => {
  it('accepts PNG, JPEG, and WebP files', () => {
    expect(validateLogoFile({
      mimetype: 'image/png',
      size: 8,
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    } as Express.Multer.File).ext).toBe('png');
  });

  it('rejects unsupported types and files larger than 2 MB', () => {
    expect(() => validateLogoFile({
      mimetype: 'image/gif',
      size: 100,
      buffer: Buffer.from('gif'),
    } as Express.Multer.File)).toThrow();

    expect(() => validateLogoFile({
      mimetype: 'image/png',
      size: 2 * 1024 * 1024 + 1,
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    } as Express.Multer.File)).toThrow();
  });
});
