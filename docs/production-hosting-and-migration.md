# Opero production hosting and ownership

Status: implementation-ready. Account creation, domain purchase, and production
deployment still require the company-owned accounts described below.

## Decision

Run one multi-tenant Opero installation. Every customer receives a workspace on
the same product domain, while application data and files remain scoped to its
organization ID.

Example after the product domain is selected:

- company website: `https://<product-domain>`;
- WDB Isolatie: `https://wdbisolatie.<product-domain>`;
- API: `https://api.<product-domain>`;
- staging: `https://staging.<product-domain>`;
- staging API: `https://api-staging.<product-domain>`.

`Organization.slug` stores the workspace label. The first confirmed customer is
WDB Isolatie, with contact Wesley de Bont and proposed slug `wdbisolatie`.

## Recommended services

| Part | Service | Reason |
| --- | --- | --- |
| Web application | Vercel Pro, connected to the company GitHub organization | The current Vite client already deploys there; Pro permits commercial use. |
| API | Railway | The repository already contains a tested Railway build and health check. |
| Database | Supabase PostgreSQL | Matches the supplied handover, preserves Prisma and the relational data model, and keeps database ownership in the company account. |
| Files | Private Supabase Storage bucket named `uploads`, accessed through S3 | Matches the supplied object keys and the existing storage adapter without application rewrites. |
| Email | Resend | Already supported for invitations and password resets. |
| DNS | Product domain owned by the company; wildcard connected to Vercel | One wildcard sends every customer workspace to the same client deployment. |

Firebase is not used for the primary database or storage. Moving the current
PostgreSQL database to Firestore would require a rewrite, and Firebase Storage
does not match the existing S3 interface. Google may still be used later for
analytics or another independent feature.

Use Supabase Free only for setup or staging. The free plan can pause inactive
projects and does not include automatic backups. Move production to Supabase
Pro before customer use.

## Domain choice

Buy one short product domain in a company-controlled registrar account. For a
Dutch-first product, the `.nl` domain should be the primary address. Buy the
matching `.com` defensively when it is affordable and available, then redirect
it to the primary domain. Do not register the production domain in a supplier's
personal account.

Before purchase, confirm:

1. spelling and final product name;
2. domain availability;
3. Benelux trademark conflicts;
4. access for at least two company owners;
5. recovery email, MFA, and billing details owned by the company.

Vercel accepts a wildcard such as `*.<product-domain>`. Wildcard certificates
require the domain to use Vercel nameservers. A specific `api` DNS record can
point to Railway while the wildcard continues to serve customer workspaces.

Reference: [Vercel wildcard domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

## Account ownership

Create or transfer these resources into accounts controlled by the company:

- GitHub organization and source repository;
- Vercel team and domain;
- Railway project and API service;
- Supabase organization, PostgreSQL project, and private `uploads` bucket;
- Resend account and sender domain;
- monitoring, billing, and recovery email.

Kevin is only needed if a missing secret or production setting is not present
in the handover. The database and uploaded files are already in
`opero-handover.zip`; source code is in this repository.

## Deployment order

Avoid the Railway/Vercel circular reference in the supplier guide by using the
intended product domain from the start:

1. create the company GitHub, Supabase, Resend, Railway, Vercel, and domain
   accounts;
2. create Supabase PostgreSQL and the private `uploads` bucket;
3. restore the handover, apply current Prisma migrations, and import the files;
4. configure and verify the Resend sender domain;
5. deploy Railway with `APP_URL` and `CORS_ORIGIN` set to the intended web
   origin, then record its generated API domain;
6. deploy Vercel with `VITE_API_URL` pointing to the Railway domain plus `/api`;
7. connect the root and wildcard web domains to Vercel and the `api` domain to
   Railway, then run the acceptance checks.

## Handover import

The received archive contains:

- `opero-handover/opero-database.sql`;
- `opero-handover/opero-files/` with the original organization-scoped keys.

The 28 September 2026 audit found one active organization in the database:
`W.D.B. Isolatie B.V.` (`0bb8818f-4a1e-4404-a4ee-6aa770d235ec`). The file tree
contains 739 files. Of those, 51 belong to this active organization and were
validated successfully. The other 688 files are spread across 28 organization
prefixes that are absent from the supplied database. The importer skips these
orphaned files by default; retain them in the untouched recovery archive until
Kevin confirms whether another database export is missing.

Never restore it into an existing populated database. First create an empty
Supabase project and a private bucket named `uploads`.

### 1. Extract and inspect

Extract the archive outside the repository. Keep the original ZIP unchanged as
the recovery copy. The SQL dump contains personal and operational data and must
not be committed.

### 2. Restore the database

Use PostgreSQL `psql` against the new empty production database. Prefer the
Supabase direct connection for this one-time restore; use its shared session
pooler for the Railway runtime when IPv4 connectivity requires it. Percent-
encode reserved characters in the database password before placing it in a URL.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f opero-database.sql
pnpm db:generate
pnpm db:deploy
```

Kevin's guide expects 60 rows in `_prisma_migrations` immediately after the
handover restore. The current repository contains 67 migration folders. After
`pnpm db:deploy`, expect all 67 current migrations to be recorded. Stop
immediately if the restore, migration command, or count reports an error.

### 3. Validate and import files

Set `DATABASE_URL` and all five `STORAGE_*` variables for the new environment.
From `backend/`, validate the extracted directory before uploading:

```sh
pnpm storage:import -- --source "/path/to/opero-files" --dry-run
pnpm storage:import -- --source "/path/to/opero-files"
```

The importer preserves every object key, imports only organizations present in
the restored database, and reports skipped orphaned storage folders. Add
`--strict` when an unknown organization should stop the run. It can be rerun
safely because identical keys are overwritten.

### 4. Assign workspaces

List organizations in the restored database and assign the intended slug. For
WDB Isolatie:

```sh
pnpm org:set-slug -- --org <organization-id> --slug wdbisolatie
```

The tool rejects invalid DNS labels, reserved service names, and duplicates.

### 5. Production variables

Backend:

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Supabase shared session-pooler connection string for Railway |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | New random value, at least 32 characters |
| `APP_URL` | Canonical fallback web origin |
| `TENANT_ROOT_DOMAIN` | Selected product domain without protocol |
| `CORS_ORIGIN` | Canonical and staging origins as applicable |
| `STORAGE_BUCKET` | `uploads` |
| `STORAGE_*` | Supabase S3 endpoint, region, access key, and secret key |
| `RESEND_API_KEY` | New company-owned Resend key |
| `EMAIL_FROM` | Sender on the verified product domain |

Vercel client:

| Variable | Production value |
| --- | --- |
| `VITE_API_URL` | `https://api.<product-domain>/api` |
| `VITE_TENANT_ROOT_DOMAIN` | Selected product domain without protocol |

### 6. Acceptance checks

- API `/healthz` reports both application and database healthy.
- The canonical web address and `wdbisolatie.<product-domain>` load over HTTPS.
- A WDB account can log in on the WDB workspace.
- The same account is rejected on a different organization's workspace.
- Customer, project, work-order, planning, photo, attachment, signature, and PDF
  samples match the handover.
- Invitation and password-reset links use the customer's subdomain.
- Supabase database backups and an independent object-storage export are
  configured and a restore is tested. Supabase's S3 interface does not provide
  object versioning.
- Old Kevin-owned credentials are revoked only after the new environment passes
  acceptance and the final handover snapshot is retained.
