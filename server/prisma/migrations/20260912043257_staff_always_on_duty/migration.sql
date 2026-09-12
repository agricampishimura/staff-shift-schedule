-- CreateTable
CREATE TABLE "StaffDayExclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    CONSTRAINT "StaffDayExclusion_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL DEFAULT 'GENERAL_STAFF',
    "employmentType" TEXT,
    "employmentStatus" TEXT NOT NULL DEFAULT 'ZAISEKI_CHU',
    "drivingCapacityBand" TEXT,
    "canBeChildInstructor" BOOLEAN NOT NULL DEFAULT false,
    "hasSevereBehaviorTraining" BOOLEAN NOT NULL DEFAULT false,
    "isServiceManager" BOOLEAN NOT NULL DEFAULT false,
    "isAlwaysOnDuty" BOOLEAN NOT NULL DEFAULT false,
    "phoneNumber" TEXT,
    "email" TEXT,
    "primaryFacilityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Staff_primaryFacilityId_fkey" FOREIGN KEY ("primaryFacilityId") REFERENCES "Facility" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Staff" ("canBeChildInstructor", "createdAt", "drivingCapacityBand", "email", "employmentStatus", "employmentType", "hasSevereBehaviorTraining", "id", "isServiceManager", "name", "permissionLevel", "phoneNumber", "primaryFacilityId", "updatedAt") SELECT "canBeChildInstructor", "createdAt", "drivingCapacityBand", "email", "employmentStatus", "employmentType", "hasSevereBehaviorTraining", "id", "isServiceManager", "name", "permissionLevel", "phoneNumber", "primaryFacilityId", "updatedAt" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StaffDayExclusion_staffId_date_key" ON "StaffDayExclusion"("staffId", "date");
