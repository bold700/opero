import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import type { AuthUser } from "./types.js";

const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Public user shape returned to clients — never leak passwordHash/totpSecret.
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    role: user.role,
    customerId: user.customerId,
    employeeId: user.employeeId,
    totpEnabled: user.totpEnabled,
  };
}
