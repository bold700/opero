# Client: Next.js → Vite migration plan

> **Goal:** Replace the Next.js App Router client with a plain **Vite + React + TypeScript SPA**
> using **React Router**, and **rebuild the screens to the Figma flow + M3 design** as we go
> (not a 1:1 port of the old prototype). The Express API and `@opero/shared` are untouched.

---

## The frontend flow (from the Figma — source of truth)

Figma: `Werkbonnen-app` (file `sQoGEjq70lzWvkxx1Odh5o`). The file defines the full sitemap; each
screen has a **desktop (1440px)** and **mobile (390px)** frame → responsive/PWA is designed in.

### Design language (the purple **M3** redesign — `v1` frames, NOT the orange ones)
Kenny: *"the purple is m3 native, orange is ai generated so that is no good."* So we follow the
**purple Material 3** direction:
- **Navigation rail** on desktop (left): hamburger, a FAB (`+` New), icon+label items, Settings pinned bottom.
- **M3 outlined text fields** (floating label, notched outline), **pill buttons** (filled primary purple + outlined secondary), **M3 tabs** (purple underline), avatar top-right.
- Purple primary (`#6750A4` family). The login screen already built matches this language.
- **Note:** the designers have only finished the **desktop** purple M3 screens. The **mobile** M3
  screens are not done yet (the v1 mobile frames are empty placeholders; only the old orange mobile
  exists). So: build desktop M3 to the Figma now; mobile M3 layout we derive ourselves (M3 bottom
  navigation bar) until/unless designs arrive.

### The screens & navigation (maps 1:1 to spec md + backend modules)

```
/login                    Login (standalone, no nav shell)
   │  (authenticate → land on dashboard)
   ▼
┌─ App shell (M3 nav rail desktop / bottom-nav mobile) ────────────┐
│  /                      Dashboard   — role-aware KPIs / tasks    │
│  /work-orders           Work orders — THE core ("Werkbonnen")    │
│  /planning              Planning                                  │
│  /customers             Customers ("Klanten")                     │
│  /employees             Employees ("Werknemers")                  │
│  /materials             Materials ("Materialen")                  │
│  /reports               Reports ("Rapporten")                     │
│  /settings              Settings ("Instellingen" — profile,       │
│                          company, notifications, prefs tabs)      │
└──────────────────────────────────────────────────────────────────┘
```

> **ALL internals are ENGLISH** — routes, filenames, component names, variables, IDs, code.
> Dutch appears ONLY as **display text**, supplied later by an i18n layer (`react-i18next` /
> i18next) keyed off translation strings. So `/work-orders` not `/werkbonnen`, `Customers.tsx`
> not `klanten-client.tsx`, `customerName` not `klantNaam`. The Figma's Dutch labels become
> i18n keys rendered to Dutch at runtime; switching language later touches translations, not code.
>
> Route names map 1:1 to the **backend modules** (already English: `/api/customers`,
> `/api/work-orders`, `/api/employees`, `/api/materials`, …) and the spec sitemap. The old
> prototype's Dutch routes/files (`/klanten`, `/werknemers`, `/project`, `personeel-client.tsx`,
> …) are **not renamed — they're replaced** by fresh English M3 screens.

### Role-based routing (one app, role-gated — enforced by the API already)

Per the spec matrix (`@opero/shared` `PERMISSION_MATRIX`), the nav and routes gate on the logged-in
user's role. Same route tree, different visible items + access:

| Route | admin | monteur | klant |
|---|---|---|---|
| `/` dashboard | full KPIs | own tasks/schedule | own status |
| `/work-orders` | all | own (assigned), no prices | view own |
| `/planning` | full | own schedule | — (hidden) |
| `/customers` | full | on own WO | own profile |
| `/employees` | full | — (hidden) | — (hidden) |
| `/materials` | full | register usage | — (hidden) |
| `/reports` | full | own timesheet | — (hidden) |
| `/settings` | full | own profile | own profile |

> Note: the three role IDs themselves (`admin`/`monteur`/`klant`) stay as-is — they're the
> backend enum values (`UserRole` in Prisma + `@opero/shared`), so they're the canonical IDs, not
> display text. Their Dutch *labels* ("Monteur", "Klant") come from i18n.

Routing rules: unauthenticated → redirect to `/login`; authenticated hitting `/login` → redirect to
`/`; hitting a route their role can't see → redirect to `/` (or a 403 screen). Nav rail/bottom-nav
only renders items the role may access.

### Build order (first flows to make real)
The product's reason to exist is field-issue logging, so after login + shell:
1. **Dashboard** (the landing, all roles) — proves login + role-aware data.
2. **Werkbonnen** (work orders) — list → detail → pre-job photo check → report blockage/extra work
   → approval. This is the core pitch.
3. Then the rest (planning, klanten, etc.) fill in.

---

## Why the Vite move is safe (the migration surface is tiny)

The whole app is already a client-side SPA wrapped in Next — **30 of 36 component files are
`"use client"`**, none use Server Components, server actions, or Next API routes (we have a
separate Express API). The only Next-specific APIs in use:

| Next API | Used in | Vite replacement |
|---|---|---|
| `next/link` (`<Link href>`) | 7 files | `react-router-dom` `<Link to>` |
| `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`, `redirect`) | 7 files | `react-router-dom` (`useNavigate`, `useLocation`, `useSearchParams`, `<Navigate>`) |
| `next/font/google` (Geist, Roboto) | `layout.tsx`, `theme.ts` | `@fontsource/*` packages (already use `@fontsource/roboto`) |

That's it. **11 route pages**, **query-param routing** in 2 spots (`project?id=`), Tailwind v4 +
MUI both stay. Everything in `client/src/components`, `client/src/lib`, `client/src/theme`, and all
of `@opero/shared` carries over **unchanged in logic** — only imports for routing/links/fonts change.

---

## Target structure

```
client/
  index.html                      # Vite entry (was implicit in Next)
  vite.config.ts                  # Vite + React + tsconfig paths + tailwind
  tsconfig.json                   # keep @/* and @opero/shared paths
  src/
    main.tsx                      # ReactDOM.createRoot + <RouterProvider>
    App.tsx                       # route tree (replaces app/ folder routing)
    routes.tsx                    # route definitions (createBrowserRouter)
    index.css                     # was app/globals.css (Tailwind + tokens)
    theme/                        # MUI theme — unchanged (drop next/font)
    lib/                          # unchanged
    components/                   # unchanged except next/link + next/navigation swaps
    pages/                        # the 11 page components (moved out of app/)
```

`app/` (Next's routing folder) goes away. Next's `layout.tsx` files become normal React layout
components in the router tree.

---

# Phases

Each phase is self-contained and verifiable with **typecheck + build only** (NEVER Playwright /
browser tests — see AGENTS.md). Verify after each phase before moving on.

### Rebuild vs. carry-over policy (important)

We are **rebuilding the UI to the Figma M3 flow**, not porting the old prototype 1:1. So:

- **Shell, routing, login, theme** (Phases A–E): build fresh in Vite to the Figma (M3 nav rail,
  the `/login` already built, the route tree above). The old `app/` folder is deleted.
- **Each screen** (Dashboard, Werkbonnen, …): rebuilt as a **new M3 page** matching its Figma
  frame. The old `*-client.tsx` components are a **reference for logic/behavior** (what data, what
  actions) — we reuse the domain logic and `lib/` helpers, but the JSX/markup is rebuilt with MUI
  M3, not carried over. Screens are built in the order under "Build order" above.
- **Data wiring** to the API (the old Phase 5) happens **per screen as we build it** — each new M3
  page is wired to its API module from the start (no localStorage). So this migration and the
  old "Phase 5" effectively merge: build the M3 screen + wire its data together.

This means the old Phase-5/6/8 split collapses into "build each M3 screen, wired and role-gated,
to the Figma." The backend (done) is the contract.

---

## PHASE A — Scaffold Vite alongside (don't delete Next yet)

**Goal:** Stand up Vite tooling in `client/` without removing Next, so we can migrate
incrementally and keep typecheck green.

1. Add deps to `@opero/client`:
   - `vite`, `@vitejs/plugin-react`, `react-router-dom`
   - `@tailwindcss/vite` (Tailwind v4's Vite plugin — replaces the PostCSS setup)
   - `vite-tsconfig-paths` (so `@/*` and `@opero/shared` resolve from `tsconfig.json`)
   - `@fontsource/geist-sans` + `@fontsource/geist-mono` (replace `next/font` Geist) — or drop
     Geist entirely since the app is moving to MUI/Roboto.
   - Remove later (Phase F): `next`, `eslint-config-next`, `@next/*`.
2. Create `client/index.html` with `<div id="root">` and `<script type="module" src="/src/main.tsx">`.
3. Create `client/vite.config.ts`:
   - plugins: `react()`, `tailwindcss()`, `tsconfigPaths()`
   - `server.port = 3000` (keep the same dev port)
   - `resolve.alias` not needed if `vite-tsconfig-paths` is used.
4. Add scripts to `client/package.json` (keep Next scripts for now, add Vite ones):
   - `"dev:vite": "vite"`, `"build:vite": "vite build"`, `"preview": "vite preview"`.

**Verify:** `corepack pnpm --filter @opero/client exec vite --version` runs; `pnpm -r typecheck`
still passes (nothing wired yet).

---

## PHASE B — Routing skeleton (React Router)

**Goal:** Build the route tree that replaces Next's `app/` folder, with placeholder pages.

1. `src/main.tsx`: mount React, wrap in `ThemeRegistry` (MUI theme) + `<RouterProvider>`.
   Import `index.css` (the moved globals) and the fontsource CSS.
2. `src/routes.tsx` using `createBrowserRouter`:
   - `/login` → standalone (no app shell) — mirrors the current `(app)` vs standalone split.
   - `/` and all app routes → wrapped in an `<AppLayout>` that renders `<AppShell>` + `<Outlet/>`.
   - Map the 11 pages:
     | Next route | Vite route |
     |---|---|
     | `/(app)/page.tsx` | `/` (dashboard) |
     | `/(app)/projects` | `/projects` |
     | `/(app)/project` | `/project` (reads `?id=`) |
     | `/(app)/project/offerte` | `/project/offerte` |
     | `/(app)/planning` | `/planning` |
     | `/(app)/klanten` | `/klanten` |
     | `/(app)/personeel` | `/personeel` |
     | `/(app)/mensen` | `/mensen` |
     | `/(app)/artikelen` | `/artikelen` |
     | `/(app)/werksoorten` | `/werksoorten` |
     | `/login` | `/login` |
3. `AppLayout` = the current `(app)/layout.tsx` body: `<AppShell><Outlet/></AppShell>`.
4. `ThemeRegistry`: keep MUI `ThemeProvider` + `CssBaseline`; **remove** the
   `@mui/material-nextjs` `AppRouterCacheProvider` (Next-specific) — for a Vite SPA, MUI's default
   Emotion cache is fine (no SSR). The theme object itself is unchanged except dropping `next/font`.

**Verify:** `vite build` compiles the route tree with placeholder pages.

---

## PHASE C — Move pages + swap navigation APIs

**Goal:** Move the 11 page components out of `app/` into `src/pages/` and replace all
`next/navigation` + `next/link` usage.

1. Move each `app/.../page.tsx` → `src/pages/<Name>.tsx` (they're thin wrappers around the
   `*-client.tsx` components, so this is mostly a rename + default-export tidy).
2. **Swap `next/link`** (7 files): `import Link from "next/link"` → `import { Link } from
   "react-router-dom"`, and `<Link href={x}>` → `<Link to={x}>`. Behaviour is equivalent.
3. **Swap `next/navigation`** (7 files):
   | Next | React Router |
   |---|---|
   | `const router = useRouter(); router.push(x)` | `const navigate = useNavigate(); navigate(x)` |
   | `usePathname()` | `useLocation().pathname` |
   | `useSearchParams()` | `useSearchParams()` from `react-router-dom` (same name, same `.get()`) |
   | `redirect(x)` (in `app/page.tsx`) | `<Navigate to={x} replace />` or `navigate` in an effect |
   - **Query-param routing** (`project-detail-client.tsx`, `offerte-print.tsx` read `?id=`):
     React Router's `useSearchParams().get("id")` is a drop-in for Next's — minimal change.
4. **AppShell nav**: it uses `usePathname()` for active-link highlighting and `next/link` — swap
   both to React Router equivalents. The role-based `navByRole`/`bottomTabsByRole` logic is unchanged.

**Verify:** `pnpm -r typecheck` clean; `vite build` succeeds; grep confirms **zero** `next/`
imports remain in `src/`.

---

## PHASE D — Styles, fonts, assets, env

**Goal:** Move the global CSS, fonts, public assets, and any env handling to Vite conventions.

1. `app/globals.css` → `src/index.css`, imported in `main.tsx`. Tailwind v4 works via
   `@tailwindcss/vite` (already added) — the `@import "tailwindcss"` line stays.
2. **Fonts:** replace `next/font/google` (Geist in `layout.tsx`, Roboto in `theme.ts`) with
   `@fontsource` imports in `main.tsx` (e.g. `import "@fontsource/roboto/400.css"`). Update the MUI
   theme's `fontFamily` to a plain string (`"Roboto, sans-serif"`) instead of the `next/font` object.
3. **Public assets:** Next's `public/` → Vite's `public/` (same convention — files served at root).
   The unused `next.svg`/`vercel.svg` can be deleted.
4. **Env vars:** the API base URL will be a Vite env (`import.meta.env.VITE_API_URL`) instead of
   Next's `process.env.NEXT_PUBLIC_*`. (Only relevant once Phase 5 wiring lands; note it now.)
5. **Metadata** (Next `metadata` export → page `<title>`): set `<title>` in `index.html`, or use a
   tiny `useEffect`/`react-helmet`-style title per page if needed. Low priority.

**Verify:** `vite build` produces a working `dist/`; Tailwind classes + MUI theme both render
(confirm by inspecting built CSS, NOT a browser test).

---

## PHASE E — Dev server + monorepo scripts

**Goal:** Make `npm run dev` and the build scripts target Vite instead of Next.

1. `client/package.json` scripts: `"dev": "vite"`, `"build": "tsc -b && vite build"`,
   `"preview": "vite preview"`, keep `"typecheck": "tsc --noEmit"`. Remove the old `next dev/build/start`.
2. Root `package.json`: the `dev` concurrently script already calls `--filter @opero/client dev` —
   no change needed (it now runs Vite). Confirm `[client]` still comes up on :3000.
3. Remove `next.config.ts`, the `BUILD_TARGET=pages` logic, and the turbopack-root workaround
   (all Next-only). The monorepo turbopack-root fix in `next.config.ts` is no longer needed —
   Vite + `vite-tsconfig-paths` handles workspace resolution natively.
4. `.github/workflows/deploy.yml`: update the GitHub Pages build (if kept) to `vite build` →
   `dist/` with the correct `base` path; OR note that Phase 11 (real deploy) replaces it anyway.
   For an SPA on a subpath, set `base` in `vite.config.ts` and add a SPA fallback (404→index.html).

**Verify:** `npm run dev` boots `[api]` + `[client]` (Vite on :3000); `npm run build` builds both.

---

## PHASE F — Remove Next.js + cleanup

**Goal:** Delete all Next.js footprint now that nothing uses it.

1. Remove deps: `next`, `eslint-config-next`, `@mui/material-nextjs`, `@next/*`,
   `next-env.d.ts`. Drop `next/font` (Geist) packages if unused.
2. Delete `src/app/` entirely (all pages now in `src/pages/`, layouts in the router).
3. ESLint: replace `eslint-config-next` with a plain React/TS ESLint config (or keep minimal).
4. `tsconfig.json`: drop the `next` plugin + `.next/types` includes; keep `@/*` and `@opero/shared`
   paths, set `jsx: "react-jsx"`, `moduleResolution: "bundler"`, add `vite/client` types.
5. Update `AGENTS.md`'s "This is NOT the Next.js you know" note — no longer Next; replace with a
   short Vite note (or remove).
6. Update `ARCHITECTURE.md` + `README` references from Next → Vite.

**Verify (final):**
- `pnpm -r typecheck` clean
- `corepack pnpm --filter @opero/client build` → `dist/` produced
- `npm run dev` boots API + Vite client; `/login` and a couple of routes return 200 via `curl`
- grep: **zero** `next` references in `client/src` and `client/package.json`

---

## What does NOT change (carries over untouched)

- **Everything in `@opero/shared`** (types, schemas, domain, permissions).
- **The entire Express backend** + Prisma + Postgres + auth + the 115 routes.
- **All `client/src/components/*`** logic (only routing/link/font imports swap).
- **The MUI M3 theme** + the new `/login` page (drop `next/font` + the Next cache provider).
- **Tailwind v4** (via `@tailwindcss/vite` instead of PostCSS).
- **The Zustand store** and all `lib/` logic.

## Risk notes

- **Tailwind v4 + Vite:** use the official `@tailwindcss/vite` plugin (not PostCSS) — clean in v4.
- **MUI SSR cache:** dropping `@mui/material-nextjs` is correct for an SPA; no SSR means no
  Emotion-cache hydration concerns.
- **Query-param pages** (`project?id=`): React Router `useSearchParams` is a near drop-in; verify
  the `id` reads still work after the swap.
- **Deep-link/refresh on a route** (e.g. `/projects`): SPA needs a server fallback to `index.html`.
  Vite dev handles this; for prod deploy, configure the host's SPA fallback (Phase 11 / deploy.yml).
- **GitHub Pages**: if kept as a demo target, set `base` and SPA 404 fallback; otherwise Phase 11
  replaces deployment entirely.

## Order of execution

A → B → C → D → E → F. Phases A–B are additive (Next still runs). Phase C is the bulk (page moves +
import swaps). E–F remove Next. Typecheck + build after every phase; never a browser test.
