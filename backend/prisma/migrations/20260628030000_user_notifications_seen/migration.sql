-- When the user last opened the notifications bell. Anything created after this
-- counts as unread for the badge. Null = never opened.
ALTER TABLE "User" ADD COLUMN "notificationsSeenAt" TIMESTAMP(3);
