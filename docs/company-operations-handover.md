# Opero company operations handover

This checklist gives the company operational control while Kevin remains the required
code reviewer for production changes.

## Repository and review

- Create a company-owned GitHub organization.
- Transfer the existing repository to the organization so history is retained.
- Keep the repository private; GitHub Team is sufficient for the current team size.
- Assign at least two company employees as organization owners.
- Add Kevin as a repository collaborator with review access.
- Protect `main`: require a pull request, passing checks, and Kevin's approval; block
  force pushes and branch deletion.
- Protect `staging`: require passing checks and deploy it automatically to the staging
  services.
- Keep production deployment attached to `main` only.

## Service ownership

Record a company owner, recovery method, billing owner, and second administrator for:

- GitHub organization and repository
- Vercel production and staging projects
- Railway production and staging services
- PostgreSQL production and staging databases
- Object storage for uploads and photos
- DNS and the Opero domain
- Transactional email provider
- Error reporting and uptime monitoring

After each transfer, rotate API keys, database passwords, deployment tokens, signing
secrets, and email credentials. Store them in the service secret stores and the
company password manager. Do not put them in GitHub files, issues, or chat messages.

## Backups and recovery

- Enable automated production database backups with documented retention.
- Enable versioning or backup retention for object storage.
- Give the company a written restore procedure and the required access.
- Test a restore into an isolated database and record the date and result.
- Keep production and staging databases separate.
- Refresh staging through a one-way export, anonymization, and staging import process.
- Remove or replace customer names, emails, phone numbers, addresses, employee data,
  free-text notes, photos, signatures, and uploaded documents before a staging import.

## Monitoring

- Monitor the API `/healthz` endpoint and the production client URL.
- Send deployment, API outage, database, and repeated authentication failure alerts to
  at least two company contacts.
- Connect structured error reporting and preserve request identifiers.
- Keep passwords, tokens, uploaded content, and unnecessary personal data out of logs.

## Acceptance record

The handover is complete when the company can independently:

1. add or remove collaborators;
2. review and merge an approved pull request;
3. deploy staging and production;
4. rotate every production credential;
5. restore the database and uploaded files;
6. receive and investigate an operational alert.
