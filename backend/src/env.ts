import "dotenv/config";
import { z } from "zod";

// Validate environment at boot. Throw a readable error if anything is missing
// rather than failing deep inside a request handler later.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PORT: z.coerce.number().int().positive().default(8787),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  STORAGE_BUCKET: z.string().optional().default(""),
  STORAGE_ENDPOINT: z.string().optional().default(""),
  STORAGE_REGION: z.string().optional().default("eu-west-3"),
  STORAGE_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_SECRET_KEY: z.string().optional().default(""),
  // Public origin of THIS API, used to build absolute URLs for locally-stored
  // uploads (GET /uploads/:key). Defaults to localhost:PORT for dev.
  PUBLIC_API_URL: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

// CORS allowlist: comma-separated origins.
export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
