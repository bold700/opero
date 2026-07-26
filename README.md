# Opero

Werkbon management application — work orders, planning, customers, and materials
for an insulation company.

## Stack

Monorepo managed with pnpm workspaces:

- `client/` — Vite + React + MUI + React Router (installable PWA)
- `backend/` — Express + Prisma + Postgres
- `shared/` — `@opero/shared`: shared types, zod schemas, and domain logic

Requires Node >= 22 and pnpm 9.

## Setup

Install dependencies:

```bash
pnpm install
```

Create the local Postgres container (once):

```bash
docker run --name opero-postgres -e POSTGRES_USER=opero -e POSTGRES_PASSWORD=opero_dev_pw -e POSTGRES_DB=opero -p 5433:5432 -d postgres:16
```

Copy the backend environment file and adjust as needed:

```bash
cp backend/.env.example backend/.env
```

Apply migrations and seed the database:

```bash
pnpm db:migrate && pnpm db:seed
```

## Development

```bash
pnpm dev
```

Starts the API and client together; the Postgres container is started
automatically. The client runs on http://localhost:3000 and the API on
http://localhost:8787.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run API and client together |
| `pnpm dev:client` | Run the client only |
| `pnpm dev:backend` | Run the API only |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm db:migrate` | Create and apply a migration (dev) |
| `pnpm db:deploy` | Apply pending migrations (production) |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:seed` | Seed the database |

## Tests

```bash
pnpm --filter @opero/backend test
```

## Configuration

Backend configuration lives in `backend/.env` — see `backend/.env.example` for
the full list, including database connection, JWT settings, CORS origins,
S3-compatible object storage, and transactional email.

The client reads `VITE_API_URL` to locate the API, defaulting to
`http://localhost:8787/api` in development.
