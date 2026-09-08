-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StaffDaySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dayType" TEXT NOT NULL DEFAULT 'WORK',
    "offType" TEXT,
    "workTimeCategoryId" TEXT,
    "customStartTime" TEXT,
    "customEndTime" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffDaySchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffDaySchedule_workTimeCategoryId_fkey" FOREIGN KEY ("workTimeCategoryId") REFERENCES "WorkTimeCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StaffDaySchedule" ("createdAt", "customEndTime", "customStartTime", "date", "dayType", "id", "note", "offType", "staffId", "updatedAt", "workTimeCategoryId") SELECT "createdAt", "customEndTime", "customStartTime", "date", "dayType", "id", "note", "offType", "staffId", "updatedAt", "workTimeCategoryId" FROM "StaffDaySchedule";
DROP TABLE "StaffDaySchedule";
ALTER TABLE "new_StaffDaySchedule" RENAME TO "StaffDaySchedule";
CREATE UNIQUE INDEX "StaffDaySchedule_staffId_date_key" ON "StaffDaySchedule"("staffId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
