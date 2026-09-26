# Opero permissions

The database keeps the internal role value `foreman` for compatibility. The product
shows this access level as **Project leader** in English and **Projectleider** in Dutch.

| Capability | Admin | Office | Project leader | Technician | Client |
| --- | --- | --- | --- | --- | --- |
| View all projects | Yes | Yes | Yes | Assigned only | Own projects |
| View all work orders | Yes | Yes | Yes | Assigned only | Own projects |
| View team planning | Yes | Yes | Yes | Own planning | No |
| Register field work | Yes | Yes | Yes | Assigned and dispatched | No |
| View selling prices | Yes | Yes | No | No | Yes |
| View costs and margins | Yes | Yes | No | No | No |
| Edit quote scope | Yes | Yes | No | No | No |
| Manage customers | Yes | Yes | No | No | No |
| Manage employee accounts | Yes | Limited | No | No | No |
| View invoices and company reports | Yes | Yes | No | No | No |
| Archive completed projects | Yes | Yes | No | No | No |

Authorization is enforced by the API. Client-side navigation and hidden controls are
only presentation helpers and are not treated as security boundaries.

## Project archive lifecycle

- Active project lists exclude archived projects by default.
- History explicitly requests archived projects and remains searchable.
- A project can be archived only when every work order is signed.
- Archive sets the project to the closing/done state and records activity and audit
  events.
- Restore returns the project to the active list and records new activity and audit
  events. It retains the closing/done workflow state so the system does not guess a
  previous state.
