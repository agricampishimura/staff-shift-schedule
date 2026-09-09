import { Router } from "express";
import { prisma } from "../db.js";

export const requiredStaffingRouter = Router();

requiredStaffingRouter.get("/", async (req, res) => {
  const { facilityId } = req.query;
  const requiredStaffings = await prisma.requiredStaffing.findMany({
    where: facilityId ? { facilityId: String(facilityId) } : undefined,
    orderBy: [{ facilityId: "asc" }, { weekday: "asc" }],
  });
  res.json(requiredStaffings);
});

requiredStaffingRouter.post("/", async (req, res) => {
  const { facilityId, weekday, requiredCount, severeBehaviorAdditionCount, instructorAdditionCount, note } =
    req.body;
  const requiredStaffing = await prisma.requiredStaffing.create({
    data: {
      facilityId,
      weekday,
      requiredCount,
      severeBehaviorAdditionCount: severeBehaviorAdditionCount ?? null,
      instructorAdditionCount: instructorAdditionCount ?? null,
      note,
    },
  });
  res.status(201).json(requiredStaffing);
});

requiredStaffingRouter.put("/:id", async (req, res) => {
  const { requiredCount, severeBehaviorAdditionCount, instructorAdditionCount, note } = req.body;
  const requiredStaffing = await prisma.requiredStaffing.update({
    where: { id: req.params.id },
    data: {
      requiredCount,
      severeBehaviorAdditionCount: severeBehaviorAdditionCount ?? null,
      instructorAdditionCount: instructorAdditionCount ?? null,
      note,
    },
  });
  res.json(requiredStaffing);
});

requiredStaffingRouter.delete("/:id", async (req, res) => {
  await prisma.requiredStaffing.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
