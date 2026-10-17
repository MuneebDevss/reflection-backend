CREATE TYPE "RescheduleStrategy" AS ENUM ('NDF', 'FEF');

ALTER TABLE "tasks"
ADD COLUMN "rescheduleStrategy" "RescheduleStrategy" NOT NULL DEFAULT 'NDF';
