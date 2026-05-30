-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'reminder',
    "scheduledStart" DATETIME NOT NULL,
    "scheduledEnd" DATETIME,
    "remindAt" DATETIME,
    "remindSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Schedule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Schedule" ("createdAt", "id", "remindAt", "remindSent", "scheduledEnd", "scheduledStart", "taskId") SELECT "createdAt", "id", "remindAt", "remindSent", "scheduledEnd", "scheduledStart", "taskId" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE INDEX "Schedule_kind_scheduledStart_idx" ON "Schedule"("kind", "scheduledStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
