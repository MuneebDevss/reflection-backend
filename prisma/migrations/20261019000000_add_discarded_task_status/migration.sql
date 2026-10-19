ALTER TYPE "TaskStatus" ADD VALUE 'discarded';

ALTER TABLE "tasks" ADD COLUMN "discardReason" TEXT;
