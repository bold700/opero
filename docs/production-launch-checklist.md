# Opero production launch checklist

Use company-controlled accounts with MFA and at least two recovery owners.
Never paste secrets into this document or commit handover data.

## Release checkpoint

- Source release: `b1b7e60` (`feat: prepare Opero production release`)
- Local verification: client and backend type checks and builds passed.
- Backend verification: 385 tests across 50 files passed.
- Local API verification: `/healthz` returned `ok` with `db: up`.
- GitHub transfer: pending company repository selection and authentication.
- Cloud deployment: pending company sign-in for Supabase, Railway, Vercel,
  Resend, plus confirmation of the final product name and domain.

## Confirmed workspace

- Organization: W.D.B. Isolatie B.V.
- Contact: Wesley de Bont
- Workspace slug: `wdbisolatie`
- Intended address: `https://wdbisolatie.<product-domain>`

## Account setup

- [ ] Confirm the final product name and product domain.
- [ ] Create a private GitHub repository under the company account.
- [ ] Create the Supabase organization and production project.
- [ ] Create the private Supabase Storage bucket `uploads`.
- [ ] Create Supabase S3 access keys.
- [ ] Create the Railway project and API service from the private repository.
- [ ] Create the Vercel Pro project with root directory `client`.
- [ ] Create Resend and verify the sending domain.
- [ ] Enable MFA, billing alerts, and recovery access on every service.

## Data migration

- [ ] Keep `opero-handover.zip` unchanged as the recovery copy.
- [ ] Restore `opero-database.sql` into the empty Supabase database.
- [ ] Confirm the supplied snapshot initially reports 60 Prisma migrations.
- [ ] Run `pnpm db:deploy` and confirm all 67 current migrations are applied.
- [ ] Run the storage importer in dry-run mode.
- [ ] Import the 51 files belonging to W.D.B. Isolatie B.V.
- [ ] Retain the 688 orphaned files outside production pending Kevin's answer.
- [ ] Assign organization slug `wdbisolatie`.

## Deployment

- [ ] Fill the backend variables from `backend/.env.production.example` in Railway.
- [ ] Deploy Railway and confirm `/healthz` reports `ok` and `db: up`.
- [ ] Fill the client variables from `client/.env.production.example` in Vercel.
- [ ] Deploy Vercel.
- [ ] Point the product domain and wildcard to Vercel.
- [ ] Point `api.<product-domain>` to Railway.
- [ ] Verify HTTPS for the root, API, and WDB workspace.

## Acceptance

- [ ] Log in with a WDB account on the WDB workspace.
- [ ] Confirm the account is rejected on a different workspace.
- [ ] Compare customers, projects, work orders, planning, photos, PDFs, and signatures.
- [ ] Send and open an invitation from the customer workspace.
- [ ] Send and open a password-reset link from the customer workspace.
- [ ] Upload, preview, download, and remove a test attachment.
- [ ] Generate and inspect a work-order PDF.
- [ ] Create independent database and file backups and test a restore.
- [ ] Change the production admin email and password.
- [ ] Revoke supplier credentials only after final acceptance.
