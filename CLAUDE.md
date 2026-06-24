@AGENTS.md

# NEVER use Playwright. No browser tests.

Do NOT use Playwright, `playwright install`, headless browsers, or ANY browser-based
testing/screenshotting — ever. No browser-automation/preview tools. Verify with typecheck,
build, unit/integration tests, and curl only. Never spin up a browser.

# Git: do not auto-commit, and no Claude signature

Do NOT commit unless the user explicitly asks. When you DO commit, do NOT add the
`Co-Authored-By: Claude` trailer or any "Generated with Claude Code" line. Plain commit
messages only.

# All internals in ENGLISH (Dutch is display-only via i18n)

Routes, filenames, component/variable names, IDs, DB fields — ALL English. Dutch appears ONLY
as display strings via i18n (react-i18next). `/customers` not `/klanten`; `customerName` not
`klantNaam`. Never put Dutch in identifiers or paths.

# Frontend structure — one component per file, feature folders

ONE component per file. Do NOT cram a page + its cards + sub-views + helpers into one `.tsx`.
Each screen is a folder `client/src/features/<feature>/` with: `<Feature>.tsx` (thin page),
`components/` (feature-local components, one per file), `api.ts` (its API calls + types).
Shared components → top-level `client/src/components/`. Use `theme/tokens.ts` for
spacing/radius/colors — no magic numbers. Data via plain `fetch` + `useApi` (no data libs).
The client is **Vite** (not Next.js). Full details in AGENTS.md.
