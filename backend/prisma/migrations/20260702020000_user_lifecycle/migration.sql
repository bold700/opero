-- User account lifecycle: invited (provisioned, not activated) / active / disabled.
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'disabled');

-- Existing users already have passwords → active.
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "invitedById" TEXT;
ALTER TABLE "User" ADD COLUMN "activatedAt" TIMESTAMP(3);
