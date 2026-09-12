import { Router } from "express";
import { prisma } from "../db.js";

export const staffRouter = Router();

staffRouter.get("/", async (_req, res) => {
  const staff = await prisma.staff.findMany({
    orderBy: { name: "asc" },
    include: { primaryFacility: true },
  });
  res.json(staff);
});

staffRouter.post("/", async (req, res) => {
  const {
    name,
    permissionLevel,
    employmentType,
    employmentStatus,
    drivingCapacityBand,
    canBeChildInstructor,
    hasSevereBehaviorTraining,
    isServiceManager,
    isAlwaysOnDuty,
    phoneNumber,
    email,
    primaryFacilityId,
  } = req.body;

  const staff = await prisma.staff.create({
    data: {
      name,
      permissionLevel,
      employmentType,
      employmentStatus,
      drivingCapacityBand,
      canBeChildInstructor: canBeChildInstructor ?? false,
      hasSevereBehaviorTraining: hasSevereBehaviorTraining ?? false,
      isServiceManager: isServiceManager ?? false,
      isAlwaysOnDuty: isAlwaysOnDuty ?? false,
      phoneNumber,
      email,
      primaryFacilityId,
    },
  });
  res.status(201).json(staff);
});

staffRouter.put("/:id", async (req, res) => {
  const {
    name,
    permissionLevel,
    employmentType,
    employmentStatus,
    drivingCapacityBand,
    canBeChildInstructor,
    hasSevereBehaviorTraining,
    isServiceManager,
    isAlwaysOnDuty,
    phoneNumber,
    email,
    primaryFacilityId,
  } = req.body;

  const staff = await prisma.staff.update({
    where: { id: req.params.id },
    data: {
      name,
      permissionLevel,
      employmentType,
      employmentStatus,
      drivingCapacityBand,
      canBeChildInstructor: canBeChildInstructor ?? false,
      hasSevereBehaviorTraining: hasSevereBehaviorTraining ?? false,
      isServiceManager: isServiceManager ?? false,
      isAlwaysOnDuty: isAlwaysOnDuty ?? false,
      phoneNumber,
      email,
      primaryFacilityId,
    },
  });
  res.json(staff);
});

staffRouter.delete("/:id", async (req, res) => {
  await prisma.staff.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
