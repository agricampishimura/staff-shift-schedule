-- CreateTable
CREATE TABLE "StaffDayTimeBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffDayScheduleId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffDayTimeBlock_staffDayScheduleId_fkey" FOREIGN KEY ("staffDayScheduleId") REFERENCES "StaffDaySchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
