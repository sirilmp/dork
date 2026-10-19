-- CreateTable
CREATE TABLE "StarredProject" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarredProject_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateIndex
CREATE INDEX "StarredProject_projectId_idx" ON "StarredProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StarredProject_userId_projectId_key" ON "StarredProject"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "StarredProject" ADD CONSTRAINT "StarredProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarredProject" ADD CONSTRAINT "StarredProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
