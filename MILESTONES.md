# Opero — Milestones

3 checkpoints. Total: **€2.000**. Bill on each as it lands.

---

## M1 — The app + the core product ✅ DONE

The whole thing runs on a real database, with login and three roles (office,
monteur, customer) that each see the right things. All nine screens load live
data, and the interface works in both Dutch and English.

The **work-order flow — the heart of what the client is paying for — is fully
built and working end to end:**

- Create a work order: pick the customer, the project, and the job-site location.
- Inside it, add tasks (the zones of the job), each with its own **type of work**
  and **assigned monteur**, plus the materials used.
- **Extra work / blockages:** the monteur reports it on site → the office
  approves → the customer approves (or it gets rejected). The exact approval
  chain the client asked for.
- **Sign-off:** finish the job, the customer signs to confirm, and the work order
  locks.
- Every action is recorded in a readable **activity log** plus a full audit trail.

This is demoable right now.

**€800**

---

## M2 — Everything else usable ✅ DONE

The remaining screens displayed data but didn't let you change anything — this
milestone wired them up so the office can run the business from the app:

- **Customers** ✅ — add, edit and remove customers, their locations and contacts.
- **Employees** ✅ — manage the team and their roles.
- **Materials** ✅ — manage the material catalogue and stock.
- **Planning** ✅ — schedule jobs and assign monteurs from the calendar.
- **Settings** ✅ — the settings screen saves for real (profile, company details,
  per-user notifications + language that follows you across devices, and the
  hide-prices-from-monteurs toggle enforced across every screen).
- **Photos & signature** ✅ — the photo-driven part, end to end on real object
  storage (Supabase Storage, S3-compatible):
  - Real photo upload on task before/result, work-order drawings (incl. PDF),
    extra-work / blockage reports, survey and handover — with phone-camera
    capture, thumbnails, a lightbox and delete.
  - A real drawn signature on sign-off (canvas → PNG) plus the signer's typed
    name; the work order locks once signed.
  - The pre-job photo check: a checklist + at least one photo are required before
    a monteur can be dispatched (server-enforced, admin-only).
  - Upload hardening: magic-byte validation, EXIF/GPS stripping + image
    normalization, org-scoped unguessable keys, tenant-isolated reads.

**€800**

---

## M3 — Live ⬜ TODO

Take it from "runs on the laptop" to "running on the client's own domain":

- **Deploy** the app, the server and the database to real hosting.
- **Email** that actually sends (password reset, two-factor codes).
- **Mobile pass** so the monteur can use it one-handed on a phone on site.
- **Hardening** + a short runbook so future deploys are one command.

**€400**

---

## Summary

| # | Milestone | What it covers | Status | € |
|---|---|---|---|---|
| M1 | App + core product | Runs on real data; the full work-order + approval + sign-off flow | ✅ Done | 800 |
| M2 | Everything else usable | Customers, employees, materials, planning, settings + photos all editable | ✅ Done | 800 |
| M3 | Live | Deployed, email, mobile, hardened | ⬜ Todo | 400 |
| | **Total** | | **~80% done** | **2.000** |

**Done now (€1.600):** the core product (M1) + every screen fully usable, with
real photo/signature storage (M2).
**Left (€400):** ship it — deploy, real email, mobile pass, hardening (M3).
