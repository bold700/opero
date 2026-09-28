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
  // Optional shared root for customer workspaces. With `example.com`, origins
  // such as https://wdbisolatie.example.com are accepted and email links use
  // the matching organization slug. Leave blank for a single-domain install.
  TENANT_ROOT_DOMAIN: z.string().optional().default(""),
  // Public origin of the WEB app (the client). Every user-facing link we email
  // (invite, password reset, email verification) is built from this. The dev
  // default is only safe in dev — see the production refinement below, which
  // makes an unset APP_URL a boot failure rather than a batch of emails that
  // send real users to localhost.
  APP_URL: z.string().url().default("http://localhost:3000"),
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
  // Transactional email via Resend. When both are set, real emails are sent (in
  // any env). When unset: dev/test log to console; production fails loud.
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default(""),
});

// Defaults that are merely convenient in dev are dangerous in production. The
// localhost APP_URL default silently shipped dev links inside real invite and
// password-reset emails, because the deployed environment never set it and
// nothing complained. A missing public origin is a broken deploy, so say so at
// boot instead of discovering it in someone's inbox.
const productionEnvSchema = envSchema.superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;
  if (!process.env.APP_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["APP_URL"],
      message:
        "APP_URL is required in production — it is the public origin of the web app used to build emailed links. Set it to the deployed client origin, e.g. https://app.example.com",
    });
  }
});

const parsed = productionEnvSchema.safeParse(process.env);

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
