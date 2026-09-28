-- Optional, globally unique workspace label used for customer subdomains.
-- Existing organizations remain reachable through the canonical APP_URL until
-- an operator assigns a slug during production onboarding.
ALTER TABLE "Organization" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
