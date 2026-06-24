import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/client.js";
import { Forbidden, Unauthorized } from "../lib/httpError.js";
import { verifyAccessToken } from "./tokens.js";
import { toAuthUser } from "./service.js";

// Parse the Bearer access token, load the user, attach req.user.
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw Unauthorized("Missing bearer token");
    }
    const token = header.slice("Bearer ".length).trim();
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw Unauthorized("Invalid or expired token");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw Unauthorized("User no longer exists");
    req.user = toAuthUser(user);
    next();
  } catch (err) {
    next(err);
  }
}

// Gate a route to specific roles. Use after requireAuth.
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(Unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(Forbidden("Insufficient role"));
      return;
    }
    next();
  };
}
