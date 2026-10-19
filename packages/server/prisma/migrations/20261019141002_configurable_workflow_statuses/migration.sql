-- Replace the fixed IssueStatus enum with a per-project configurable
-- workflow (WorkflowStatus + WorkflowTransition), backfilling every
-- existing Issue.status value losslessly before dropping the old column
-- and enum. All literal values below (the four default status names and
-- the enum members being migrated) are fixed, trusted schema constants,
-- not user input, so string-building them directly here is safe.

-- 1. New enum for the one load-bearing concept every custom status must map
--    to (replaces literal "DONE" / "TODO" / ... string comparisons).
CREATE TYPE "StatusCategory" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- 2. WorkflowStatus / WorkflowTransition tables.
CREATE TABLE "WorkflowStatus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "StatusCategory" NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStatus_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowStatus_projectId_order_idx" ON "WorkflowStatus"("projectId", "order");

CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatusId" TEXT,
    "toStatusId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowTransition_projectId_fromStatusId_toStatusId_key"
    ON "WorkflowTransition"("projectId", "fromStatusId", "toStatusId");

ALTER TABLE "WorkflowStatus" ADD CONSTRAINT "WorkflowStatus_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStatusId_fkey"
    FOREIGN KEY ("fromStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStatusId_fkey"
    FOREIGN KEY ("toStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Backfill: for every existing project, create the four statuses that
--    reproduce today's enum semantics exactly, in order.
INSERT INTO "WorkflowStatus" ("id", "projectId", "name", "category", "order", "isDefault", "updatedAt")
SELECT gen_random_uuid(), p."id", s."name", s."category"::"StatusCategory", s."ord", s."isDefault", CURRENT_TIMESTAMP
FROM "Project" p
CROSS JOIN (
    VALUES
        ('To Do', 'TODO', 0, true),
        ('In Progress', 'IN_PROGRESS', 1, false),
        ('In Review', 'IN_PROGRESS', 2, false),
        ('Done', 'DONE', 3, false)
) AS s("name", "category", "ord", "isDefault");

-- 4. Add the new FK column on Issue, nullable for now so we can backfill it
--    before enforcing NOT NULL.
ALTER TABLE "Issue" ADD COLUMN "statusId" TEXT;

-- 5. Point every existing issue at the new status row for its project that
--    matches its old enum value (To Do/In Progress/In Review/Done map 1:1
--    back onto TODO/IN_PROGRESS/IN_REVIEW/DONE).
UPDATE "Issue" i
SET "statusId" = ws."id"
FROM "WorkflowStatus" ws, (
    VALUES ('TODO', 'To Do'), ('IN_PROGRESS', 'In Progress'), ('IN_REVIEW', 'In Review'), ('DONE', 'Done')
) AS m("oldStatus", "newName")
WHERE ws."projectId" = i."projectId"
  AND ws."name" = m."newName"
  AND i."status"::text = m."oldStatus";

-- 6. Enforce NOT NULL + FK + index now that every row is backfilled.
ALTER TABLE "Issue" ALTER COLUMN "statusId" SET NOT NULL;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "WorkflowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Issue_projectId_status_idx";
CREATE INDEX "Issue_projectId_statusId_idx" ON "Issue"("projectId", "statusId");

-- 7. Drop the now-unused enum column and type.
ALTER TABLE "Issue" DROP COLUMN "status";
DROP TYPE "IssueStatus";
