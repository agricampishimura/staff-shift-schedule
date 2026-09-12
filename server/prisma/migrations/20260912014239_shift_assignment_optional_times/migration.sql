-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShiftAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "staffId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShiftAssignment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ShiftAssignment" ("createdAt", "date", "endTime", "facilityId", "id", "note", "staffId", "startTime", "status", "updatedAt") SELECT "createdAt", "date", "endTime", "facilityId", "id", "note", "staffId", "startTime", "status", "updatedAt" FROM "ShiftAssignment";
DROP TABLE "ShiftAssignment";
ALTER TABLE "new_ShiftAssignment" RENAME TO "ShiftAssignment";
CREATE UNIQUE INDEX "ShiftAssignment_date_staffId_facilityId_key" ON "ShiftAssignment"("date", "staffId", "facilityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
