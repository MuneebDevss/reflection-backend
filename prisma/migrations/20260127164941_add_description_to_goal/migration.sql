-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawGoalText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "goalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "GoalSession_userId_idx" ON "GoalSession"("userId");

-- CreateIndex
CREATE INDEX "GoalSession_status_idx" ON "GoalSession"("status");

-- CreateIndex
CREATE INDEX "GoalSession_goalId_idx" ON "GoalSession"("goalId");

-- CreateIndex
CREATE INDEX "GoalQuestion_sessionId_idx" ON "GoalQuestion"("sessionId");

-- CreateIndex
CREATE INDEX "GoalQuestion_sessionId_order_idx" ON "GoalQuestion"("sessionId", "order");

-- CreateIndex
CREATE INDEX "GoalAnswer_questionId_idx" ON "GoalAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalAnswer_questionId_key" ON "GoalAnswer"("questionId");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalSession" ADD CONSTRAINT "GoalSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalSession" ADD CONSTRAINT "GoalSession_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalQuestion" ADD CONSTRAINT "GoalQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GoalSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAnswer" ADD CONSTRAINT "GoalAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "GoalQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
