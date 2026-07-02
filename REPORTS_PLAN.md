# Reports — Comprehensive Plan (what it is, what's missing, how to build it)

## 0. First: clear up the confusion

The current page is confusing because it was half-built and one section is fabricated. Let's
define what Reports actually IS, based on the Figma mockup + the domain:

**Reports = a business-analytics screen for the office (admin): "how is the company doing, over a
chosen time period, sliced by work orders / hours / materials."**

It is NOT a list of documents called "reports." There is no `Report` entity and we're not adding
one. "Rapport" in Dutch here just means "the analytics view." Every number is derived live from
real data (projects, work orders, tasks, invoices, employees).

The mockup shows the INTENDED feature. The current build is a stripped, all-time subset of it with
one fake widget. This plan brings the build up to the mockup, with everything real.

---

## 1. Decode the mockup — every element and what it should do

| Mockup element | What it means | Status today |
|---|---|---|
| **Period navigator** ("Jun 2025" ◀ ▶) | Pick a **month** (or period) → every number below is scoped to it | ❌ MISSING — everything is all-time |
| **Filter chips**: Alle / Werkbonnen / Uren / Materialen | Slice the view by dimension — show all, or focus one metric group | ❌ MISSING |
| **Search "Label"** | Search within the data (e.g. by project number / customer) | ❌ MISSING (and low value — probably drop or repurpose) |
| **KPI cards**: Werkbonnen, Uren, Omzet, Materiaalkosten | 4 headline numbers | 🟡 built but ALL-TIME, not period-scoped |
| **Werkbonnen per week** (bar chart) | Work orders over time | 🟡 built but fixed "last 5 weeks", ignores the period picker |
| **Recente rapporten** | ⚠️ FAKE — it's just recent projects mislabeled | ❌ REMOVE or REPLACE (see §3) |
| **Top monteurs** (table) | Busiest technicians | 🟡 built but all-time + counts *projects* not *work orders* (misnamed) |
| **Export** | Download the current view | ✅ works (CSV) — but should export the FILTERED/PERIOD data |

**The one big missing concept: a time period.** A "report" for June is the whole point — right now
everything is lifetime totals, which is useless for "how did we do last month vs this month."

---

## 2. What "real" reports need — the core additions

### 2a. A period filter (THE key feature)
- A month picker (◀ Jun 2025 ▶) in the top bar, defaulting to the current month.
- Optionally a preset range (This month / Last month / This quarter / This year / All time).
- **Everything** below recomputes for the selected period.
- Backend: `GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD` (or `?period=2025-06`). All queries filter
  by the relevant date within the range.

**Which date scopes each metric?** (important — pick the right one per metric)
- Work orders → `WorkOrder.createdAt` in range
- Hours → `WorkOrderTask` hours where the task/work-order falls in range (by created or ended date)
- Revenue → `Invoice.paidDate` (or accepted quote) in range — "revenue booked this period"
- Material costs → `Invoice.materialsAmount` for invoices in range
- Top technicians → work orders/tasks assigned to them **within the period**

### 2b. The filter chips (Alle / Werkbonnen / Uren / Materialen)
- Not separate data — a **focus toggle**. "Alle" shows everything; picking one emphasizes that
  metric group (e.g. "Uren" → show the hours KPI big + an hours-over-time chart + hours per
  technician, hide the rest). Simplest v1: the chip changes which chart/breakdown is shown below
  the KPIs. Can also just filter which KPI cards are highlighted. Decide during build; lean:
  the chip swaps the **main chart + breakdown table** to that dimension.

### 2c. Fix the existing widgets to be period-aware + honest
- **KPI cards** → scope to the period. Add a small "vs last period" delta (nice, optional).
- **Chart** → respect the period (weeks within the selected month, or months within a year).
- **Top monteurs** → count actual **work orders** (via task assignee) in the period, not lifetime
  project involvement. Rename internally so it's accurate.

---

## 3. The "Recente rapporten" section — decision

It's fake (recent projects mislabeled). Two honest options:

- **(A) Replace with a real "recent work orders / recent activity" list** — genuinely useful on an
  analytics page: the latest completed/signed work orders in the period, each linking to its
  detail. Real data, real links, honest label.
- **(B) Replace with "saved reports"** — if the client actually wants to SAVE/name a report (e.g.
  "June 2025 month report") and re-open it. That needs a real `SavedReport` entity (name, period,
  createdBy, createdAt) + endpoints. Bigger, but matches the "Maandrapport Juni" labels in the
  mockup — which implies the client DID imagine named, saved reports.

**Recommendation:** start with **(A)** (recent work orders — cheap, real, useful now). Treat **(B)
saved reports** as a follow-up IF the client confirms they want to name+save+revisit reports. The
mockup's "Maandrapport Juni / Urenoverzicht W25 / Materiaalkosten Q2" labels suggest they might —
so flag it as a real question for the client, don't guess.

---

## 4. Export — make it export the real view
- Currently exports all-time CSV. Change to export the **currently-selected period + filter**, with
  a filename like `opero-report-2025-06.csv`.
- Optional (nice, later): PDF export of the period report (ties into the WO PDF work, #6). CSV is
  enough for v1.

---

## 5. Roles
- Reports stays **admin-only** (finance/company-wide numbers). The nav already needs fixing to
  `["admin"]` (currently shows to technicians who then get 403). Fix that here.
- (If the client wants a technician "my hours this month" view later, that's a separate personal
  timesheet — out of scope; `/employees/:id/timesheet` already exists for that.)

---

## 6. Backend work

- `GET /reports?from=&to=` (admin) — accept a date range (default: current month). Every aggregate
  filters by the range on the correct date field (§2a). Reuse the existing query structure but add
  `where` date bounds.
- Add per-dimension breakdowns the chips need:
  - work-orders over time (buckets by week if range ≤ ~3 months, else by month)
  - hours per technician (period)
  - materials cost breakdown (period) — top materials by cost, or by category
- Recent work orders in period (for §3-A): last N signed/created work orders with id + customer +
  date, each linkable.
- Remove the fake `recentReports` (projects mislabeled).
- Keep it all org-scoped + price-safe (admin sees prices; the endpoint is admin-only anyway).

Model additions: **none needed for v1** (all derivable). Only §3-B "saved reports" would need a new
table — deferred.

---

## 7. Client work

- **PeriodPicker** component (month ◀ ▶ + preset dropdown) driving a `{from, to}` state.
- Refetch `/reports?from=&to=` when the period changes (useApi with deps).
- **Filter chips** row → focus state → swaps the main chart/breakdown.
- Rework the page layout to match the mockup: search/filter bar row, KPI row, main chart, breakdown
  table, recent-work-orders list.
- Make the chart respect the period. Make top-monteurs period-scoped + accurate.
- Wire export to the current period+filter.
- i18n NL + EN for all the new controls (period presets, chip labels, breakdown headers).
- Mobile layout (the mockup has a mobile variant): stacked KPI grid, period nav, list.

---

## 8. Build order

1. **Backend period filtering** — `GET /reports?from=&to=`, all KPIs + chart period-scoped. Fix
   top-technicians to count real work orders in period. curl-verify with different ranges.
2. **Remove fake recentReports**; add **recent work orders in period** (real, linkable).
3. **Client PeriodPicker** + refetch on change. KPIs/chart now reflect the period.
4. **Filter chips** → focus/breakdown swap.
5. **Breakdowns** the chips need (hours per tech, materials by cost).
6. **Export** = current period+filter. **Nav fix** → admin-only.
7. i18n + mobile pass. Verify (tsc/build/tests, curl a couple periods).

---

## 8b. LOCKED DECISIONS (answered)

- **Saved reports: YES.** Build a real `SavedReport` entity — the user names a report (its period +
  active filter), saves it, sees a list of saved reports, and can re-open (loads that period+filter)
  or delete it. This replaces the fake "Recente rapporten" with genuinely saved, named reports.
- **Period: month picker + presets** — ◀ month ▶ navigator defaulting to current month, plus preset
  buttons: This month / Last month / This quarter / This year / All time.
- **Revenue ("Omzet") = invoices PAID in the period** — sum `Invoice.materialsAmount + laborAmount +
  extraWorkAmount + acceptedQuoteAmount` (i.e. total invoiced) for invoices whose `paidDate` is in
  range. Single clearly-labeled line in code so it's trivial to change if the client redefines it.
  Material costs = `Invoice.materialsAmount` for those same paid invoices.

### SavedReport model (new)
```prisma
model SavedReport {
  id        String   @id @default(uuid())
  orgId     String
  name      String
  fromDate  String       // ISO date (period start)
  toDate    String       // ISO date (period end)
  filter    String   @default("all")  // all | workOrders | hours | materials
  createdById String?
  createdAt DateTime @default(now())
  org       Organization @relation(fields: [orgId], references: [id])
  @@index([orgId])
}
```
Endpoints (admin-only, org-scoped):
- `GET /reports/saved` → list
- `POST /reports/saved { name, from, to, filter }` → create
- `DELETE /reports/saved/:id` → remove
Opening a saved report = set the client period/filter state from it and refetch `/reports`.

## 9. Open questions for the CLIENT (don't guess these)

1. **Saved reports?** The mockup labels ("Maandrapport Juni", "Urenoverzicht W25", "Materiaalkosten
   Q2") imply the client wants to NAME and SAVE reports and revisit them. Is that real, or was it
   just placeholder text in the design? → decides §3-A vs §3-B (a whole entity + CRUD).
2. **Period granularity:** month is the obvious default. Do they also want quarter / year / custom
   range? (Cheap to add presets.)
3. **What do the filter chips actually filter?** My read: they focus the view on one metric group.
   Confirm that's the intent vs. something else (e.g. filtering the underlying work orders by type).
4. **Revenue definition:** is "Omzet" = invoices PAID in the period, or invoices SENT, or accepted
   quote value of projects started? (Affects which date/field we sum.) This is a real accounting
   choice the client should make.
5. **Export format:** CSV enough, or do they need a printable/PDF month report?

---

## 10. Scope summary

**v1 (buildable now, all real):** period picker + period-scoped KPIs/chart/top-technicians, filter
chips as focus toggle, recent-work-orders list replacing the fake one, period-aware CSV export,
admin-only nav. No new DB tables.

**Follow-up (needs client confirmation):** saved/named reports (new entity), PDF export, "vs last
period" deltas, custom date ranges.

**Out of scope:** technician personal dashboards (separate feature), real-time/live updating.
