import type { UserRole } from "@prisma/client";

// The authenticated principal attached to req.user by requireAuth.
export type AuthUser = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: UserRole;
  customerId: string | null;
  employeeId: string | null;
  totpEnabled: boolean;
};

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
