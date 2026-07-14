# Prod fix — failed `material_entity_remodel` migration

## What broke
The migration adds `class NOT NULL` (and other NOT NULL cols) to `Material`, but
prod still had the 6 old demo `Material` rows → Postgres refuses (`P3018`), the
migration is marked **failed**, and every later deploy is blocked (`P3009`) →
container crash-loops.

Your real data (customers, projects, work orders, users) is NOT affected — only
the old `Material`/`Inventory`/`PriceList*` tables, which this migration deletes
anyway.

## The fix — 3 steps

### 1. Empty the blocking tables (Supabase SQL editor, on the PROD db)
```sql
TRUNCATE TABLE
  "TaskMaterial",          -- FK to the tables below; safe, re-seeded
  "PriceEntry","PriceListProduct","PriceList",
  "Inventory","MaterialCategory","Material"
CASCADE;
```
(If some of these tables don't exist because the failed run already dropped them,
remove those names and re-run — TRUNCATE errors on a missing table.)

### 2. Roll back the failed migration marker, then re-apply (from a shell with
the prod `DATABASE_URL` set — e.g. locally pointing at prod, or a one-off
container shell):
```bash
export DATABASE_URL="<prod postgres url>"
pnpm -C backend exec prisma migrate resolve --rolled-back 20260714021305_material_entity_remodel
pnpm -C backend exec prisma migrate deploy
```
`deploy` now re-runs the migration against the empty tables → succeeds → applies
this + any later migrations.

### 3. Seed the catalog (same shell)
```bash
pnpm -C backend db:seed
```
⚠️ `db:seed` WIPES and recreates the WHOLE demo dataset (customers, projects,
work orders, users…). If prod only has demo/seed data, this is fine. If Kenny
has entered REAL data you must keep, DO NOT run the full seed — instead run the
materials-only seed (ask me to generate `seed-materials-only.ts`).

## After that
Redeploy (or just restart the container). `/materials` will return the class
groups and the client stops crashing.
