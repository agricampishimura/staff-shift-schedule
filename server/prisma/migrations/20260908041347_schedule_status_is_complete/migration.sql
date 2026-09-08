-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StaffScheduleStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffScheduleStatus_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StaffScheduleStatus" ("createdAt", "id", "isFinalized", "month", "staffId", "updatedAt") SELECT "createdAt", "id", "isFinalized", "month", "staffId", "updatedAt" FROM "StaffScheduleStatus";
DROP TABLE "StaffScheduleStatus";
ALTER TABLE "new_StaffScheduleStatus" RENAME TO "StaffScheduleStatus";
CREATE UNIQUE INDEX "StaffScheduleStatus_staffId_month_key" ON "StaffScheduleStatus"("staffId", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
