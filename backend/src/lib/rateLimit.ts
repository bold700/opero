import rateLimit from "express-rate-limit";
import { env } from "../env.js";

// Per-IP rate limit for sensitive auth endpoints (login, forgot-password).
//
// NOTE: in-memory store — fine for a single instance. For multi-instance prod,
// swap in a shared store (e.g. rate-limit-redis). Disabled under NODE_ENV=test
// so the integration suite isn't throttled.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: {
    error: { code: "RATE_LIMITED", message: "Too many attempts, try again later" },
  },
});
