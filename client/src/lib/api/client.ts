import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokens";

// Base URL of the Express API. Override with VITE_API_URL in production.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787/api";

// Thrown for any non-OK response. `status` lets callers branch (e.g. 401, 403).
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// Called when refresh fails (session truly expired). Set by the auth layer so
// the app can redirect to /login. Avoids a hard import cycle.
let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(fn: () => void): void {
  onAuthExpired = fn;
}

type Options = {
  method?: string;
  body?: unknown;
  // Skip attaching the access token (used for login/refresh themselves).
  auth?: boolean;
};

// One in-flight refresh shared across concurrent 401s, so we don't fire many
// refresh calls at once.
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function doFetch(path: string, options: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

// Core request. On a 401 it refreshes the access token once and retries; if the
// refresh fails it clears the session and signals the app to redirect to login.
async function request<T>(path: string, options: Options = {}): Promise<T> {
  let res = await doFetch(path, options);

  if (res.status === 401 && options.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(path, options); // retry once with the new token
    } else {
      clearTokens();
      onAuthExpired?.();
      throw new ApiError(401, "Sessie verlopen");
    }
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const err = (payload as { error?: { message?: string; code?: string } })?.error;
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.code);
  }
  return payload as T;
}

// Multipart upload. Sends a single file as field "file" (+ optional text fields).
// Must NOT set Content-Type — the browser sets the multipart boundary itself.
// Reuses the same 401-refresh-retry flow as request().
async function upload<T>(path: string, file: Blob, fields?: Record<string, string>): Promise<T> {
  const build = () => {
    const fd = new FormData();
    fd.append("file", file);
    if (fields) for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fd;
  };

  const send = () => {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, { method: "POST", headers, body: build() });
  };

  let res = await send();
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await send();
    } else {
      clearTokens();
      onAuthExpired?.();
      throw new ApiError(401, "Sessie verlopen");
    }
  }

  if (res.status === 204) return undefined as T;
  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!res.ok) {
    const err = (payload as { error?: { message?: string; code?: string } })?.error;
    throw new ApiError(res.status, err?.message ?? `Upload failed (${res.status})`, err?.code);
  }
  return payload as T;
}

// One page of a cursor-paginated list (mirrors backend Page<T>).
export type Page<T> = { items: T[]; nextCursor: string | null };

// Build a querystring from defined params only (skips undefined/empty).
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  // Fetch one page of a paginated list. `params` is merged into the querystring
  // alongside cursor/limit/search.
  getPage: <T>(
    path: string,
    opts: {
      cursor?: string;
      limit?: number;
      search?: string;
      params?: Record<string, string | number | undefined>;
    } = {},
  ) =>
    request<Page<T>>(
      `${path}${qs({
        cursor: opts.cursor,
        limit: opts.limit,
        search: opts.search,
        ...opts.params,
      })}`,
    ),
  // Drain ALL pages of a paginated endpoint into one array. Use ONLY for
  // selector/picker data sources that genuinely need the full set (e.g. the
  // project dropdown in the werkbon-create flow), NOT for list screens — those
  // should page lazily via usePagedApi. Bounded by `maxPages` as a safety stop.
  getAll: async <T>(
    path: string,
    opts: { params?: Record<string, string | number | undefined>; maxPages?: number } = {},
  ): Promise<T[]> => {
    const out: T[] = [];
    let cursor: string | undefined;
    const maxPages = opts.maxPages ?? 50;
    for (let i = 0; i < maxPages; i++) {
      const page = await request<Page<T>>(
        `${path}${qs({ cursor, limit: 100, ...opts.params })}`,
      );
      out.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return out;
  },
  post: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "POST", body, auth: opts?.auth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body }),
  upload,
};
