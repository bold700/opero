# Deploying Opero (WerkbonApp) on your own server

This app has **three parts** that run together. It is not a single file you drop on a
server — it's a normal web application with a database and an API.

```
  [ Web app ]  ── talks to ──▶  [ API server ]  ── talks to ──▶  [ PostgreSQL database ]
   (browser)        HTTPS           (Node.js)         SQL            (data storage)
```

You can host all three on one server, or split them. Below is what the server/host needs.

---

## 1. What the server must have (prerequisites)

| Requirement | Why | Notes |
|---|---|---|
| **A Linux server** (or VPS) | runs the app | 1 vCPU / 2 GB RAM is plenty to start |
| **Node.js 20 or 22** | runs the API + builds the web app | LTS version |
| **pnpm** | package manager | `npm install -g pnpm` (or via corepack) |
| **PostgreSQL 16** | the database | either installed on the server, or a managed Postgres (e.g. Supabase, Neon, RDS) |
| **A domain name** | the app's URL | e.g. `werkbon.bedrijf.nl` — they already want their own domain |
| **HTTPS / SSL certificate** | secure login | free via Let's Encrypt / handled by a reverse proxy like Nginx or Caddy |
| **(Later) An email provider** | password-reset + 2FA emails | e.g. Resend/Postmark — only needed once those features go live |
| **(Later) Object storage** | photos, signatures, PDFs | S3-compatible bucket — needed when photo upload is wired |

> If they prefer **fully managed**, the simplest split is: database on a managed Postgres,
> API on a small Node host, web app served as static files. But one server works fine too.

---

## 2. What I (the developer) need FROM the client to deploy

Send me / set up the following:

1. **Server access** — SSH access to the server (or the hosting account), OR they run the
   steps below themselves and I guide them.
2. **The domain** they want to use (e.g. `werkbon.bedrijf.nl`), pointed at the server's IP.
3. **A PostgreSQL database** — either:
   - they provision one and send me the connection string (`DATABASE_URL`), or
   - I install Postgres on the server.
4. **(Later, when those features go live):**
   - A **Resend** (or similar) account → the `RESEND_API_KEY` for sending emails.
   - An **S3-compatible storage bucket** + its keys, for photos/PDFs.

That's it to get a working deployment. Email + storage are only needed for the
password-reset/2FA and photo-upload features specifically.

---

## 3. The environment variables that must be set

**API server** (`backend/.env`):
```
DATABASE_URL   = postgresql://USER:PASSWORD@HOST:5432/opero   # the Postgres connection
JWT_SECRET     = <a long random secret string, 32+ chars>     # generate a fresh one
JWT_ACCESS_TTL = 15m
JWT_REFRESH_TTL_DAYS = 30
PORT           = 8787
CORS_ORIGIN    = https://werkbon.bedrijf.nl                    # the web app's real URL
NODE_ENV       = production
# (later) RESEND_API_KEY, STORAGE_* for email + uploads
```

**Web app** (build-time):
```
VITE_API_URL = https://werkbon.bedrijf.nl/api                 # where the API lives
```

I generate the `JWT_SECRET`; the client provides `DATABASE_URL` (or I create it) and the domain.

---

## 4. The deploy steps (high level — I run these)

On the server, once Node + pnpm + Postgres are available:

```bash
# 1. get the code + install
git clone <repo>  &&  cd opero
pnpm install

# 2. set up the database (creates all tables)
pnpm db:deploy          # applies the migrations to the real database
pnpm db:seed            # OPTIONAL: loads demo data — skip for a clean production start

# 3. build both apps
pnpm build

# 4. run the API (kept alive with pm2 / systemd / docker)
pnpm --filter @opero/backend start      # serves the API on PORT

# 5. serve the web app's built files (the static `client/dist/` folder)
#    via Nginx/Caddy, with HTTPS, on the domain — and proxy /api → the API server
```

A reverse proxy (Nginx or Caddy) ties it together on the domain:
- `https://werkbon.bedrijf.nl/`      → serves the web app (static files)
- `https://werkbon.bedrijf.nl/api/`  → forwards to the API (Node) on port 8787

---

## 5. The short version (to tell the client)

> "It's a web app + an API + a Postgres database. To host it on your server I need:
> **(1)** a Linux server with Node.js and PostgreSQL (or a managed Postgres),
> **(2)** the domain name you want to use, pointed at the server, and
> **(3)** SSL (we can set up free Let's Encrypt).
> Email sending and photo storage need a Resend account and a storage bucket, but only
> once we turn those features on. I handle the build, database setup, and deployment."

---

## Notes
- **First-time login** uses the seeded demo accounts (`admin@opero.test` / `opero123`) if
  you run `db:seed`. For production, skip the seed and create the real admin user instead.
- Backups: if self-hosting Postgres, enable automated backups. A managed Postgres does this
  for you.
- This is a normal "two services + a database" web app — any host that runs Node + Postgres
  works (their own server, a VPS, or managed cloud).
