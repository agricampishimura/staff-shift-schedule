-- AlterTable
ALTER TABLE "StaffDaySchedule" ADD COLUMN "offType" TEXT;

-- CreateTable
CREATE TABLE "StaffScheduleStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffScheduleStatus_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffScheduleStatus_staffId_month_key" ON "StaffScheduleStatus"("staffId", "month");
