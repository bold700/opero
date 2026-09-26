// HTTP-only staging smoke check. No browser or customer data is required.
const productionClientHost = "werkbon-client.vercel.app";
const productionApiHost = "operobackend-production.up.railway.app";

function requiredUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return url;
}

async function get(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

async function main() {
  const client = requiredUrl("STAGING_CLIENT_URL");
  const api = requiredUrl("STAGING_API_URL");
  if (client.hostname === productionClientHost || api.hostname === productionApiHost) {
    throw new Error("Refusing to check a production URL as staging");
  }
  if (api.pathname.replace(/\/$/, "") !== "/api") {
    throw new Error("STAGING_API_URL must end in /api");
  }

  const clientOrigin = client.origin;
  const apiBase = `${api.origin}/api`;
  const page = await get(new URL("/login", client));
  const html = await page.text();
  const scriptPath = /<script[^>]+src=["']([^"']+\.js)["']/.exec(html)?.[1];
  if (!scriptPath) throw new Error("Staging client has no JavaScript bundle");
  const script = await get(new URL(scriptPath, client));
  const bundle = await script.text();
  if (!bundle.includes(apiBase)) {
    throw new Error("Staging client bundle does not point to the staging API");
  }
  if (bundle.includes(`https://${productionApiHost}/api`)) {
    throw new Error("Staging client bundle also contains the production API URL");
  }
  console.log("Client is reachable and points to the staging API");

  const health = await get(new URL("/healthz", api));
  const healthBody = await health.json();
  if (healthBody.ok !== true || healthBody.db !== "up") {
    throw new Error("Staging API health check did not confirm the database");
  }
  console.log("Staging API and database are reachable");

  const preflight = await get(`${apiBase}/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: clientOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  if (preflight.headers.get("access-control-allow-origin") !== clientOrigin) {
    throw new Error("Staging API does not allow the staging client origin");
  }
  console.log("Staging client origin is allowed by the API");

  const email = process.env.STAGING_TEST_EMAIL;
  const password = process.env.STAGING_TEST_PASSWORD;
  if (Boolean(email) !== Boolean(password)) {
    throw new Error("Set both STAGING_TEST_EMAIL and STAGING_TEST_PASSWORD, or neither");
  }
  if (!email || !password) return;

  const login = await get(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await login.json();
  if (!session.accessToken || !session.refreshToken) {
    throw new Error("Staging smoke account did not return a usable session");
  }
  try {
    const me = await get(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const user = (await me.json()).user;
    if (user?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new Error("Staging session belongs to a different account");
    }
    if (process.env.STAGING_EXPECTED_ROLE && user.role !== process.env.STAGING_EXPECTED_ROLE) {
      throw new Error(`Expected role ${process.env.STAGING_EXPECTED_ROLE}, got ${user.role}`);
    }
    console.log(`Staging login works for role ${user.role}`);
  } finally {
    await fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      signal: AbortSignal.timeout(15000),
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
