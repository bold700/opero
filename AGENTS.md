# Stack

Monorepo (pnpm workspaces): `client/` (Vite + React + MUI + React Router — NOT Next.js),
`backend/` (Express + Prisma + Postgres), `shared/` (`@opero/shared` — types, zod schemas,
domain logic). Verify the client with `tsc --noEmit` + `vite build`; the backend with
`tsc --noEmit` + vitest. Run both with `npm run dev` (Postgres auto-starts via Docker).

# Frontend structure — one component per file, feature folders

Do NOT cram a whole screen (page + cards + sub-views + actions + helpers) into one `.tsx`.
Structure:

```
client/src/
  features/<feature>/        one folder per screen/feature
    <Feature>.tsx            the PAGE — thin: state + layout, composes the parts below
    components/              components used ONLY by this feature (one per file)
    api.ts                   this feature's API calls + response types
  components/                SHARED components across features (PageLayout, Card, StatusBadge)
  lib/api/                   fetch client (client.ts), tokens, useApi hook
  theme/                     MUI theme + design tokens
  auth/                      auth context + route guards
  app/                       router, navigation config, AppShell
```

Rules:
- **One component per file.** A page file orchestrates; it does not define multiple
  sub-components inline. Extract them to `features/<feature>/components/`.
- **Feature-local** vs **shared**: if only one screen uses it, it lives in that feature's
  `components/`. If 2+ screens use it, promote to top-level `components/`.
- **No magic numbers** for spacing/radius/colors — use `theme/tokens.ts` and the standardized
  typography variants (`variant="h6"` etc.), never hardcoded `fontSize`/`p:3`.
- Data fetching: plain `fetch` via `lib/api/client.ts` + the `useApi` hook. No data libraries
  (no TanStack/SWR/axios).

# NEVER use Playwright. No browser tests.

Do NOT use Playwright, `playwright install`, headless browsers, or ANY browser-based
testing/screenshotting — ever. No `mcp__Claude_Preview__*` or browser-automation tools either.
Verify work with typecheck, build, unit/integration tests, and curl. Never spin up a browser.

# Git: do not auto-commit, and no Claude signature

Do NOT commit unless the user explicitly asks for it. When you DO commit, do NOT add the
`Co-Authored-By: Claude` trailer or any "Generated with Claude Code" line — plain commit
messages only.

# All internals in ENGLISH (Dutch is display-only via i18n)

Routes, filenames, component names, variables, IDs, DB fields, code comments — ALL English.
Dutch text appears ONLY as user-facing display strings, supplied by i18n (`react-i18next` /
i18next) via translation keys. So: `/customers` not `/klanten`, `Customers.tsx` not
`klanten-client.tsx`, `customerName` not `klantNaam`. UI copy → `t("customers.title")` →
rendered to Dutch at runtime. Never bake Dutch into identifiers or paths.
