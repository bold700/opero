import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DEFAULT_URL_TTL_SECONDS, type Storage } from "./types.js";

export type S3Config = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

// Production adapter — any S3-compatible object store (Supabase Storage, AWS S3,
// Cloudflare R2). Reads are handed out as short-lived presigned GET URLs so the
// browser fetches bytes directly from the store, never through our API.
export class S3Storage implements Storage {
  readonly kind = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(cfg: S3Config) {
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      // Supabase/R2-style endpoints require path-style addressing.
      forcePathStyle: true,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async url(key: string, ttlSeconds = DEFAULT_URL_TTL_SECONDS): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
