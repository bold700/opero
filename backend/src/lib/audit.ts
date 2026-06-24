import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "../auth/types.js";

type Db = PrismaClient | Prisma.TransactionClient;

// Append an audit_log row for a mutation. Call inside the same transaction as
// the write so the trail is atomic with the change.
export async function audit(
  db: Db,
  actor: AuthUser,
  action: string,
  entity: string,
  entityId: string | null,
  diff?: unknown,
): Promise<void> {
  await db.auditLog.create({
    data: {
      orgId: actor.orgId,
      actorUserId: actor.id,
      action,
      entity,
      entityId: entityId ?? undefined,
      diff: diff === undefined ? undefined : (diff as Prisma.InputJsonValue),
    },
  });
}
