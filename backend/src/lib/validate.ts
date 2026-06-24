import type { ZodTypeAny, z } from "zod";

// Parse + validate a request body against a zod schema. Throws ZodError on
// failure, which the central error handler serializes to 400 VALIDATION_ERROR.
export function parseBody<T extends ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  return schema.parse(body) as z.infer<T>;
}
