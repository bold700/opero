# Opero improvement plan

Status: local implementation in progress
Owner: company-owned Opero repository
Review model: Kevin reviews pull requests before production merge
Delivery and billing record: [development worklog](./development-worklog.md)

## Progress snapshot â€” 25 September 2026

- Package B: operational ESLint checks now cover client, backend, and shared;
  type checks, client production build, and all backend tests pass locally.
- Package C: the production audit was reduced from 14 findings to one moderate
  ExcelJS transitive finding. There are no remaining high-severity findings.
- Package D: the visible access role now reads **Projectleider / Project leader**;
  the existing internal `foreman` value remains compatible with stored accounts.
- Package E: active/history filtering, archive, restore, activity/audit events, and
  unfinished-work-order protection are implemented and covered by integration tests.
- Package F: route-level code splitting is active and the 47 unused `_legacy` files
  have been removed after confirming that active code had no imports into that tree.
- Packages G and H now have a company handover checklist; executing it still requires
  the relevant company accounts and service ownership transfers.

## 1. Current assessment

Opero has a solid functional foundation. The monorepo separates the React client,
Express API, and shared domain rules, and the backend already has broad integration
coverage. The latest verified baseline has passing TypeScript checks, a successful
client production build, and a passing backend test suite (43 files, 361 tests).

The earlier overall assessment remains approximately **7/10**: good domain coverage
and access-control foundations, with several production-readiness gaps that should be
resolved before the company assumes full operational ownership.

### Already implemented or prepared locally

- Opero branding replaces the old `WerkbonApp` name in the active client.
- Windows local development can start PostgreSQL without Docker.
- A separate customer staging environment exists on company-owned Vercel and Railway
  accounts.
- Staging has its own database, seed safeguards, credentials, and HTTP smoke check.
- A proposed GitHub Actions workflow validates migrations, types, builds, and backend
  tests.
- The `foreman` authorization role can read all projects, work orders, and planning
  without receiving commercial data or office permissions.
- The API already supports archiving a project, but the complete user-facing history
  flow is not implemented.

### Main gaps

1. Linting is not operational: the Vite client still imports a stale Next.js ESLint
   configuration, while backend and shared only print placeholders.
2. `pnpm audit --prod` currently reports 14 findings: 10 high, 3 moderate, and 1 low.
3. The project-leader requirement works through an internal `foreman` login role, but
   the visible labels and business terminology are inconsistent.
4. Project archiving exists in the API without a complete finish/archive/history UI.
5. Staging deployment is still manually operated instead of being driven by the future
   company GitHub repository.
6. Production infrastructure, backups, domains, secrets, and billing are not yet under
   company ownership.
7. Runtime logging exists, but error reporting, alerting, and restore verification are
   not yet an operational system.
8. Several active client files are large, and 47 files remain in `_legacy`; both make
   future changes harder to review.

## 2. Execution principles

- Keep production and staging fully isolated.
- Keep the repository private and company-owned.
- Make each change reviewable as a small pull request.
- Require Kevin's approval before merging into `main`.
- Never commit credentials, database exports, customer data, or local login files.
- Express authorization rules in `shared/src/permissions.ts` and enforce them again in
  the API. Hiding a button is never an authorization boundary.
- Keep internal names, routes, database fields, and comments in English. Dutch remains
  display-only through i18n.
- Verify with type checks, builds, unit/integration tests, and HTTP smoke tests. Do not
  introduce browser automation.

## 3. Work packages

### Package A â€” curate the current local foundation

Goal: turn the current working tree into clear review units without losing work or
including unrelated files.

Tasks:

- Separate the Opero branding changes from local-development and staging changes.
- Exclude unrelated untracked assets from every future commit.
- Keep staging credentials in ignored local files and provider secret stores only.
- Review the proposed staging workflow and runbook before committing them.
- Document which change set will become each pull request.

Acceptance:

- Every intended file belongs to one named change set.
- `git diff` contains no credentials, database data, or unrelated media.
- No commit is created until explicitly requested.

### Package B â€” restore engineering quality gates

Goal: make one command reliably validate every workspace.

Tasks:

- Replace `eslint-config-next` with a Vite/React flat ESLint configuration.
- Add TypeScript-aware ESLint configuration for `client`, `backend`, and `shared`.
- Add React Hooks and React Refresh rules to the client.
- Replace backend/shared placeholder lint scripts with real checks.
- Fix lint findings without broad formatting churn.
- Stabilize any timeout-prone integration tests by fixing setup/isolation rather than
  merely increasing timeouts.
- Enable the proposed GitHub Actions workflow after repository transfer.

Acceptance:

- `pnpm lint` passes and actually checks all three workspaces.
- `pnpm typecheck` passes.
- Client and backend production builds pass.
- Backend tests pass without intermittent failures.
- The same commands pass in GitHub Actions.

### Package C â€” resolve production dependency findings

Goal: remove known high-severity dependency findings without breaking domain flows.

Tasks:

- Upgrade `react-router-dom`/`react-router` to a patched release (`>=7.18.2`).
- Upgrade `sharp` to a patched release (`>=0.35.4`) and recheck image processing.
- Update Prisma packages to remove the vulnerable `deepmerge-ts` chain.
- Resolve the Express/body-parser/`qs` findings with compatible direct upgrades or a
  reviewed temporary package override.
- Resolve ExcelJS transitive findings (`brace-expansion`, `uuid`) through compatible
  upstream upgrades or reviewed overrides.
- Inspect every lockfile change and avoid an unreviewed blanket audit fix.

Regression checks:

- Authentication and role guards.
- Image upload/downscaling and task photos.
- PDF generation.
- Excel import/export.
- Project, planning, work-order, invoice, and material routes.

Acceptance:

- `pnpm audit --prod` reports no high-severity findings.
- All quality gates from Package B pass.
- The staging HTTP smoke check passes after deployment.

### Package D â€” make the project-leader role unambiguous

Goal: fulfil the business rule: a project leader sees every project, work order, and
planning item, but never prices or office-only screens.

Current technical state:

- The internal authorization role is `foreman` for backward compatibility.
- `canSeeAllProjects("foreman")` is true.
- `canSeePrices("foreman")` is false.
- Office authority is separated through `isOffice`, preventing permission leakage.

Tasks:

- Use **Project leader / Projectleider** consistently as the visible account-role label
  if this is the intended customer-facing name.
- Keep the internal enum unchanged initially to avoid an unnecessary database migration.
- Verify the Projects navigation item and project list/detail routes for this role.
- Verify all price, margin, quote, invoice, report, customer-list, and account-management
  fields/routes remain unavailable.
- Add a concise permission table to the product documentation.

Acceptance:

- Project leader sees all projects, all work orders, and everyone's planning.
- Project leader cannot edit planning unless that requirement is explicitly added.
- No selling price, cost price, margin, invoice, or quote value is returned by the API.
- No office-only mutation succeeds, even when called directly.
- Role tests cover both allowed and denied paths.

### Package E â€” complete project finish and history

Goal: let office users finish a project and find it later in a clear History view.

Tasks:

- Add an **Archive project** action to project detail for authorized office roles.
- Show a confirmation containing the project number and customer name.
- Reuse the existing archive API, which sets `archived=true` and completes the stage.
- Exclude archived projects from the default active-project list.
- Add a History filter/view that lists archived projects and supports search.
- Keep archived project details and activity history readable.
- Add an admin-only restore/reopen action if the business wants recovery from mistakes.
- Decide how open work orders, unsigned handovers, or outstanding invoices should block
  or warn before archival.

Acceptance:

- An authorized user can archive an eligible project from the UI.
- The project disappears from Active and appears in History immediately.
- Direct API calls enforce the same authorization and lifecycle rules.
- Activity and audit logs record archive and restore operations.
- Tests cover active/history filtering and invalid lifecycle transitions.

### Package F â€” reduce maintenance risk in the client

Goal: make future feature work easier to understand and review.

Tasks:

- Inventory all 47 `_legacy` files and remove files with no active imports.
- Split active components larger than roughly 400 lines when they are next modified,
  starting with work-order detail and planning components.
- Keep one component per file and move feature-only helpers into their feature folders.
- Replace hardcoded spacing, radius, and color values with theme tokens during touched
  feature work.
- Add route-level code splitting to address the current ~1.5 MB client bundle warning.
- Keep API calls in feature `api.ts` files and the shared fetch client.

Acceptance:

- No active import points into removed legacy files.
- Initial client bundle size is materially reduced.
- Changed screens follow the documented feature-folder structure.
- Type checks and production build remain green.

### Package G â€” establish company-owned delivery

Goal: allow the company to operate Opero while Kevin remains the code reviewer.

Tasks:

- Create a company-owned GitHub organization and private Opero repository.
- Transfer the current repository so history and review context remain intact.
- Use GitHub Team to enforce private-repository rules.
- Add two company owners and Kevin as developer/reviewer.
- Protect `main`: pull request required, Kevin approval required, checks required, force
  pushes and branch deletion blocked.
- Deploy `staging` automatically to the existing staging environment.
- Deploy `main` to production only after the required approval and successful checks.
- Transfer live Vercel, Railway, Supabase, DNS/domain, Resend, and billing ownership.
- Rotate all production credentials after transfer.

Acceptance:

- The company can add/remove collaborators, rotate secrets, restore data, and deploy
  without requesting account access from an external person.
- Kevin can review code but is not the sole owner of any production dependency.
- A failed check or missing approval prevents a production merge/deploy.

### Package H â€” backups, staging refresh, and monitoring

Goal: make data operations repeatable and recoverable.

Tasks:

- Document production database and object-storage backup ownership and retention.
- Create an on-demand, one-way production-to-staging refresh procedure after production
  ownership is transferred.
- Use read-only production access for export and staging-only write access for import.
- Add an anonymization step for customer and employee personal data.
- Never point the staging application directly at the production database.
- Schedule backup verification and perform a test restore into an isolated database.
- Add API uptime and `/healthz` monitoring.
- Add structured error reporting with request identifiers and PII-safe logging.
- Alert company owners on deployment failure, API outage, database failure, or repeated
  authentication errors.

Acceptance:

- The company can refresh staging without Kevin and without production writes.
- A documented restore exercise succeeds.
- Operators receive actionable alerts and can identify the affected request/deployment.

## 4. Recommended implementation order

1. Package A â€” curate current local changes.
2. Package B â€” lint and CI quality gates.
3. Package C â€” dependency/security upgrades.
4. Package D â€” project-leader naming and final permission verification.
5. Package E â€” project archive/history user flow.
6. Package F â€” focused maintainability improvements.
7. Package G â€” company GitHub and production ownership transfer.
8. Package H â€” controlled staging refresh, backups, and monitoring.

Packages A through F can be prepared and verified locally without touching production.
Packages G and H require the relevant accounts or ownership transfer.

## 5. Proposed pull-request split

1. `chore/local-staging-foundation`
2. `chore/opero-branding`
3. `chore/lint-and-ci`
4. `chore/security-dependency-upgrades`
5. `feat/project-leader-access`
6. `feat/project-history`
7. `chore/client-maintenance`
8. `ops/company-owned-delivery`

Each pull request must describe what changed, why, how it was tested, and any migration
or rollout risk. Production deployment remains a separate approved action.

## 6. Standard verification checklist

Run for every relevant local change set:

```text
pnpm lint
pnpm typecheck
pnpm --filter @opero/client build
pnpm --filter @opero/backend build
pnpm --filter @opero/backend test
pnpm audit --prod
node scripts/check-staging.mjs   # after staging deployment
```

The audit command is a release signal rather than a blanket pass/fail gate until Package
C is complete; after that package, new high-severity findings block release.
