import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { ZodError } from "zod";
import { corsOrigins, env } from "./env.js";
import { prisma } from "./db/client.js";
import { asyncHandler } from "./lib/asyncHandler.js";
import { HttpError } from "./lib/httpError.js";
import "./auth/types.js"; // Express.Request augmentation
import { authRouter } from "./auth/routes.js";
import { customersRouter } from "./modules/customers/routes.js";
import { employeesRouter } from "./modules/employees/routes.js";
import { materialsRouter } from "./modules/materials/routes.js";
import { projectsRouter } from "./modules/projects/routes.js";
import { workOrdersRouter } from "./modules/work-orders/routes.js";
import { planningRouter } from "./modules/planning/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { organizationRouter } from "./modules/organization/routes.js";
import { invoicesRouter } from "./modules/invoices/routes.js";
import { searchRouter } from "./modules/search/routes.js";
import { notificationsRouter } from "./modules/notifications/routes.js";
import { uploadsRouter } from "./modules/uploads/routes.js";
import { logStorageBackend } from "./lib/storage/index.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(
  pinoHttp({
    level: env.NODE_ENV === "test" ? "silent" : "info",
  }),
);

// Health check — pings the DB so a green /healthz means the API can serve data.
app.get(
  "/healthz",
  asyncHandler(async (_req: Request, res: Response) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  }),
);

// Auth module (Phase 2).
app.use("/api/auth", authRouter);

// Domain modules (Phase 3).
app.use("/api/customers", customersRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/materials", materialsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/work-orders", workOrdersRouter);
app.use("/api/planning", planningRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/organization", organizationRouter);
app.use("/api/search", searchRouter);
app.use("/api/notifications", notificationsRouter);
// invoices uses /projects/:projectId/invoice/* paths → mount at /api.
app.use("/api", invoicesRouter);
// Serve locally-stored uploads (no-op on the S3 adapter — browser hits S3
// directly via presigned URLs). Mounted OUTSIDE /api: URL is /uploads/:key.
app.use("/uploads", uploadsRouter);

// 404 for anything unmatched.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
});

// Central error handler (4-arg). Serializes HttpError, ZodError, and unknowns.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: err.issues,
      },
    });
    return;
  }
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
};
app.use(errorHandler);

// Only listen when run directly (not when imported by tests).
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[opero-api] listening on http://localhost:${env.PORT}`);
    logStorageBackend();
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
