# Customer staging environment

Status: proposal for Kevin's review. No cloud environment or customer access has
been created yet.

## Goal

Provide a stable URL where the customer can try reviewed changes before they
reach production. Staging must use fictional data and separate credentials,
database, uploads, and API configuration. The current production client is
`https://werkbon-client.vercel.app`; its API is
`https://operobackend-production.up.railway.app/api`.

## Proposed topology

| Component | Production | Customer staging |
| --- | --- | --- |
| Git branch | `main` | persistent `staging` branch |
| Client | existing Vercel project | separate Vercel project, production branch `staging` |
| API | existing Railway service | backend service in a new Railway `staging` environment |
| Database | existing production database | new PostgreSQL service in Railway `staging` |
| Uploads | existing production storage | separate staging bucket, or temporary local storage |
| Email | production provider | disabled until a staging-only sender is configured |

A separate Vercel project gives the customer one stable URL without requiring
access to Vercel's protected preview deployments. The application login still
controls access. Create the Railway environment **empty** so no production
`DATABASE_URL`, storage keys, or email credentials are copied into it.

## Provisioning after review

1. Create the `staging` branch from the reviewed code. Keep `main` as the
   production branch. Changes enter staging only after Kevin's code review;
   promote the tested commit to `main` through a separate reviewed PR.
   `.github/workflows/staging-checks.yml` runs typechecks, builds, migrations,
   the default seed, and backend tests on PRs targeting either branch and on
   pushes to `staging`.
2. In Railway, create an empty persistent environment named `staging`. Add a
   new PostgreSQL service and a backend service linked to the repository's
   `staging` branch. Use the existing root `railway.json` build and start
   commands. Add a public domain for the staging API.
3. In Vercel, create a second project from the same repository. Copy the live
   client's monorepo root, install, build, output, and SPA rewrite settings;
   set this project's production branch to `staging`. Give it a distinct,
   stable domain. Set `VITE_API_URL` to the staging API URL ending in `/api`.
   Vite embeds this value during the build, so rebuild after changing it.
4. Set the staging backend variables below. Use Railway variable references for
   the new PostgreSQL service. Verify the resolved `DATABASE_URL` points to the
   **staging** database before deploying or running any seed command.
5. Apply migrations. Add fictional demo data only to the new staging database.
   The seed deletes all existing rows. It refuses to run in production and
   requires distinct, private passwords of at least 16 characters for each
   seeded role in Railway's `staging` environment. Set `SEED_DEMO=1` if the
   customer and foreman demo accounts are needed; set all five password
   variables below before running `pnpm db:seed`. Run it only once on the new
   staging database unless intentionally resetting fictional data. Do not copy
   real customer records into staging.
6. Create only the account role the customer needs and share that credential
   through an agreed private channel. Keep an internal admin account separate.
   Check the customer can log in, see the expected data, and cannot access
   production data or privileged screens outside their role.

### Staging backend variables

| Variable | Staging value |
| --- | --- |
| `DATABASE_URL` | reference to the new staging PostgreSQL service |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | new random secret, different from production |
| `APP_URL` | exact origin of the staging Vercel client |
| `CORS_ORIGIN` | exact origin of the staging Vercel client |
| `PUBLIC_API_URL` | staging Railway API origin if local upload storage is used |
| `STORAGE_*` | new staging-only bucket credentials, or blank for temporary local storage |
| `RESEND_API_KEY`, `EMAIL_FROM` | staging-only sender, or blank while email-dependent actions are unavailable |
| `SEED_DEMO` | `1` when seeding the client and foreman demo accounts |
| `SEED_ADMIN_PASSWORD`, `SEED_OFFICE_PASSWORD`, `SEED_TECHNICIAN_PASSWORD` | distinct private values, each at least 16 characters |
| `SEED_CLIENT_PASSWORD`, `SEED_FOREMAN_PASSWORD` | likewise, required when `SEED_DEMO=1` |

`APP_URL` controls invitation and password-reset links. `CORS_ORIGIN` controls
which browser origin can call the API. A Railway public domain is still
reachable by anyone on the internet, so it needs application authentication.
Local upload storage is lost when its service instance is replaced; use a
separate bucket if upload testing must survive redeployments. With no email
provider, email-dependent actions fail in production mode; configure a
staging-only sender before testing invitations or password resets.

## Acceptance checks before giving the URL to the customer

- Run `scripts/check-staging.mjs` with `STAGING_CLIENT_URL` (client origin) and
  `STAGING_API_URL` (API URL ending in `/api`). To verify login too, provide
  `STAGING_TEST_EMAIL`, `STAGING_TEST_PASSWORD`, and `STAGING_EXPECTED_ROLE`
  through a private shell or CI secret. Never commit these values.
- The staging client and staging `/healthz` endpoint return HTTP 200.
- The deployed JavaScript contains the staging API URL and no production API URL.
- A preflight request from the staging client origin is accepted by the staging
  API.
- The customer's dedicated login works, with the intended role and fictional
  data. No default seed password remains usable on any staging account.
- The staging API uses its own PostgreSQL service and storage credentials;
  confirm this in Railway's environment-scoped variables, not only by URL.
- A change pushed to `staging` updates only staging; production stays on `main`.
- Kevin has reviewed the code and deployment configuration before customer
  access is enabled.

## References

- [Vercel Git deployments and branch tracking](https://vercel.com/docs/git)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection)
- [Railway environments](https://docs.railway.com/environments)
- [Railway staging isolation](https://docs.railway.com/guides/isolate-staging-production)
