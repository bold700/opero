import type { NextFunction, Request, RequestHandler, Response } from "express";

// Wrap an async route handler so rejected promises reach the central error
// middleware instead of crashing the process (Express 4 doesn't await handlers).
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
