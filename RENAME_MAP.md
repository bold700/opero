# Dutch → English rename map (binding contract for the all-English sweep)

All code identifiers (models, fields, enum values, types, routes, vars) MUST be English.
Dutch only ever appears as user-facing display strings (later via i18n). This map is the
single source of truth — apply it EVERYWHERE (schema, backend, shared, frontend).

## Prisma models
| Dutch | English |
|---|---|
| Werksoort | WorkType |
| Werkbon | WorkOrder |
| WerkbonTaak | WorkOrderTask |
| TaakMateriaal | TaskMaterial |
| Meerwerk | ExtraWork |
| Oplevering | Handover |
| OpleverItem | HandoverItem |

(Already-English models keep their names: Organization, User, AuthSession, PasswordReset,
AuditLog, Customer, ContactPerson, Location, Employee, Material, Inventory, MaterialOrder,
MaterialOrderItem, Article, Project, Intake, Quote, QuoteLineItem, DeliveryChecklist,
DeliveryChecklistItem, ProjectTask, MaterialRequirement, PlanningItem, Invoice, ProjectActivity.)

## Enum names
| Dutch | English |
|---|---|
| MeerwerkRejectedBy | ExtraWorkRejectedBy |

## Enum VALUES
| Enum | Dutch value → English value |
|---|---|
| UserRole | klant → client · monteur → technician (admin stays) |
| ProjectStatus | verkoop → sales · operatie → operations · afronding → closing |
| BillingType | vast → fixed · regie → time_and_materials |
| CatalogCategory | isolatie → insulation · materiaal → material · arbeid → labor · logistiek → logistics |
| TeamRole | Werkvoorbereider → WorkPlanner · Voorman → Foreman · Monteur → Technician · Administratie → Administration · Projectleider → ProjectLeader (Sales, Planner stay) |

(Already-English enum values keep: Stage concept/in_progress/ready/done; ProjectUrgency
normal/urgent/blocked; QuoteStatus draft/sent/accepted; InvoiceStatus not_started/draft/sent/paid;
IntakeStatus planned/completed; WorkOrderStatus planned/on_the_way/in_progress/blocked/completed;
ProjectActivityType status_change/comment/scheduled/system; ExtraWorkRejectedBy office/client.)

## Fields / relations
| Dutch | English |
|---|---|
| werksoorten (Org, Project) | workTypes |
| opnamePhotos | surveyPhotos |
| opnameNotes | surveyNotes |
| approvedByOpzichter | approvedBySupervisor |
| werksoort (QuoteLineItem) | workType |
| werkbonnen (Project relation) | workOrders |
| meerwerk (Project relation) | extraWork |
| oplevering (Project relation) | handover |
| werkbon (relation field) | workOrder |
| werkbonId | workOrderId |
| opleveringId | handoverId |
| tasks/materials | (already English — keep) |

## Domain / store action vocabulary (shared + frontend + var names)
werkbon → workOrder · meerwerk → extraWork · oplevering → handover · werksoort → workType ·
opname → survey · offerte → quote · factuur → invoice · opzichter → supervisor ·
taak → task · materiaal → material · klant → client · monteur → technician ·
voorraad → stock/inventory · opdrachtgever → client

## Role mapping note
UserRole `klant`→`client` and `monteur`→`technician`. The frontend's `navigation.ts`,
`permissions.ts`, AuthContext, guards, and the role checks all use these new values.
Dutch labels ("Klant", "Monteur") are display-only.
