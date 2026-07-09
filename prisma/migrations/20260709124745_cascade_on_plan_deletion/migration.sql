-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_planId_fkey";

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
