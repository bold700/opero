# Opero Domain Model

Opero models B2B insulation work as a project lifecycle. A work order is generated from planning, but the central entity is always the Project.

The product direction is one shared platform, not separate applications stitched together later. Each user logs in with an account/profile, and that profile determines permissions, visible projects, and available actions.

## Main Entities

- Customer: the business client or organization requesting insulation work, including contact details and address.
- Account/Profile: the logged-in user identity, role, organization, permissions, and project visibility.
- Project: the lifecycle container for intake, quote, materials, planning, work orders, delivery, and invoice.
- Intake: client request details, address, insulation type, surface area, photos, notes, risks, estimated materials, and estimated labor hours.
- Quote: commercial proposal with status, amount, line items, sent date, and accepted date.
- Material: catalog item such as EPS pearls, PIR boards, mineral wool, or foil.
- InventoryItem: current stock position for a material, supplier, unit, and reorder point.
- PurchaseList: missing materials for a project that need ordering.
- PlanningItem: scheduled project day with date, times, project leader, team leader, installers, vehicle, and material readiness.
- TeamMember: planner, project leader, team leader, installer, or admin.
- WorkOrder: field execution package generated from a planned project day.
- DeliveryChecklist: operational checklist before the project is considered completed.
- Invoice: billing state based on the accepted quote, extra work, materials, and labor.

## Project Statuses

1. New request
2. Intake planned
3. Intake completed
4. Quote sent
5. Quote accepted
6. Materials check
7. Planned
8. In progress
9. Delivery check
10. Completed
11. Invoice sent
12. Paid

## Workflow

A business request starts as a Project with status `New request`. Once an appointment is made with the client contact, it moves to `Intake planned`. After the intake form is completed, the project becomes `Intake completed` and the quote can be prepared.

When the quote is sent, the project waits in `Quote sent`. Accepting the quote moves the project to `Quote accepted` and makes materials the next operational step. The materials check compares each required material quantity with the local inventory snapshot. If anything is missing, the project remains in `Materials check` and a PurchaseList can be created. If all materials are available, the project can move to `Planned`.

Planning creates a PlanningItem and a WorkOrder. Installers use the mobile execution view to start work, report issues, register notes/photos placeholders, add extra work placeholders, and complete the work order. Completing the work order moves the project into `Delivery check`.

The delivery checklist confirms that work is complete, photos are present, materials are registered, extra work is approved, the client contact signed, and quality was checked. When the checklist is complete, the project becomes `Completed`. From there an invoice draft can be created, sent, and marked paid.

## Relationships

- Customer has many Projects.
- Project has one Intake, one Quote, one DeliveryChecklist, and one Invoice.
- Project has many MaterialRequirements, PlanningItems, and WorkOrders.
- PlanningItem references TeamMembers for project leader, team leader, and installers.
- WorkOrder references the same team structure and carries required and used materials.
- PurchaseList belongs to a Project and is derived from MaterialRequirements with missing stock.
- InventoryItem belongs to a Material and is used to calculate material readiness.

## Account Roles

- Super admin: complete platform view across all projects, roles, blockers, invoices, demo settings, and future account management.
- Opdrachtgever: status, planning, contact moments, delivery and invoice visibility.
- Sales: new requests, intake, quote preparation and quote follow-up.
- Projectmanager: lifecycle ownership, planning, blockers and team handoff.
- Monteur: mobile work order, tasks, checklist, notes, photos placeholder and issue reporting.
- Voorraadbeheer: material readiness, stock gaps, suppliers and purchase lists.
- Administratie: completed projects, invoice drafts, sent invoices and payment status.

These profiles should share the same Project data. A status change, material check, work order update or invoice action should be visible to every permitted account without copying data between apps. In the prototype, profile switching is only a testing tool; in production it should come from login and account permissions.

Current prototype visibility:

- Super admin and Projectmanager can see all projects. They can drag projects in the kanban to test lifecycle movement.
- Opdrachtgever sees only projects for their own Customer account. Internal tabs such as intake, materials and work orders are hidden.
- Monteur sees projects and work orders assigned to their team member profile. The execution screen is mobile-first.
- Voorraadbeheer sees projects where materials need checking or ordering. Planning is visible for context, but planning ownership stays with project management.
- Sales sees request, intake and quote-stage projects.
- Administratie sees delivery, completed and invoice-stage projects.

## Device Principles

- Mobile: field execution, quick status checks, issue reporting and simple one-handed actions.
- Tablet: intake, planning discussion, warehouse checks and project review on site.
- Desktop: kanban planning, quotations, administration and larger operational overviews.

## Future Expansion

- Replace local mock state with API routes and a real database.
- Add authentication, roles, and permission rules per planner, project leader, installer, admin, and client contact.
- Add real inventory reservations, purchase orders, supplier lead times, and stock movements.
- Add drag-and-drop planning, calendar capacity, route optimization, and vehicle availability.
- Add photo upload, offline support, client contact signatures, and structured issue reporting for field teams.
- Add quote templates, VAT handling, invoice numbering, payment tracking, and accounting integrations.
- Add audit logs for lifecycle transitions and operational handoffs.
