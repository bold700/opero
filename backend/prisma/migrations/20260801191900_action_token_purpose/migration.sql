-- CreateEnum
CREATE TYPE "ActionTokenPurpose" AS ENUM ('invite', 'reset');

-- AlterTable
ALTER TABLE "PasswordReset" ADD COLUMN     "purpose" "ActionTokenPurpose" NOT NULL DEFAULT 'reset';

-- Backfill: before this column existed, invites and resets shared this table and
-- were told apart only by their lifetime — issueInvite used 7 days, issuePasswordReset
-- 1 hour. Anything still unused with more than a day of life left was an invite, so
-- classify it as one; without this, invitations already sitting in inboxes would be
-- rejected by the new accept-invite endpoint. Expired and used rows keep the 'reset'
-- default: they are inert either way.
UPDATE "PasswordReset"
SET "purpose" = 'invite'
WHERE "used" = false
  AND "expiresAt" > "createdAt" + INTERVAL '1 day';
