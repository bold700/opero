import { env } from "../env.js";

export const TENANT_HEADER = "x-opero-tenant";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeTenantSlug(value: string | undefined): string | null {
  const slug = value?.trim().toLowerCase();
  return slug && SLUG_PATTERN.test(slug) ? slug : null;
}

function normalizedRootDomain(value = env.TENANT_ROOT_DOMAIN): string {
  return value.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

export function tenantAppUrl(
  slug: string | null | undefined,
  rootDomain = env.TENANT_ROOT_DOMAIN,
): string {
  const root = normalizedRootDomain(rootDomain);
  const normalizedSlug = normalizeTenantSlug(slug ?? undefined);
  if (root && normalizedSlug) return `https://${normalizedSlug}.${root}`;
  return env.APP_URL.replace(/\/$/, "");
}

export function isAllowedWebOrigin(
  origin: string,
  exactOrigins: readonly string[],
  rootDomain = env.TENANT_ROOT_DOMAIN,
): boolean {
  if (exactOrigins.includes(origin)) return true;

  const root = normalizedRootDomain(rootDomain);
  if (!root) return false;

  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.port) return false;
    const suffix = `.${root}`;
    if (!url.hostname.endsWith(suffix)) return false;
    return normalizeTenantSlug(url.hostname.slice(0, -suffix.length)) !== null;
  } catch {
    return false;
  }
}

export function tenantSlugFromHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return null;
  return normalizeTenantSlug(value);
}
