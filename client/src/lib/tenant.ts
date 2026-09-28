const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function rootDomain(): string {
  return (import.meta.env.VITE_TENANT_ROOT_DOMAIN ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

export function tenantSlugForHostname(hostname: string): string | null {
  const root = rootDomain();
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!root) return null;

  const suffix = `.${root}`;
  if (!normalizedHostname.endsWith(suffix)) return null;

  const slug = normalizedHostname.slice(0, -suffix.length);
  return TENANT_SLUG_PATTERN.test(slug) ? slug : null;
}

export function tenantRequestHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const slug = tenantSlugForHostname(window.location.hostname);
  return slug ? { "X-Opero-Tenant": slug } : {};
}
