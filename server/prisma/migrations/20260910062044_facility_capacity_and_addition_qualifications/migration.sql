-- AlterTable
ALTER TABLE "Facility" ADD COLUMN "capacity" INTEGER;

-- AlterTable
ALTER TABLE "RequiredStaffing" ADD COLUMN "instructorAdditionQualification" TEXT;
ALTER TABLE "RequiredStaffing" ADD COLUMN "severeBehaviorAdditionQualification" TEXT;
