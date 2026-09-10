import { Router } from "express";
import { prisma } from "../db.js";

export const facilitiesRouter = Router();

facilitiesRouter.get("/", async (_req, res) => {
  const facilities = await prisma.facility.findMany({ orderBy: { name: "asc" } });
  res.json(facilities);
});

facilitiesRouter.post("/", async (req, res) => {
  const {
    name,
    serviceType,
    capacity,
    openTime,
    closeTime,
    schoolDayOpenTime,
    schoolDayCloseTime,
    schoolOffDayOpenTime,
    schoolOffDayCloseTime,
  } = req.body;

  const facility = await prisma.facility.create({
    data: {
      name,
      serviceType: serviceType || null,
      capacity: capacity ?? null,
      openTime: openTime || null,
      closeTime: closeTime || null,
      schoolDayOpenTime: schoolDayOpenTime || null,
      schoolDayCloseTime: schoolDayCloseTime || null,
      schoolOffDayOpenTime: schoolOffDayOpenTime || null,
      schoolOffDayCloseTime: schoolOffDayCloseTime || null,
    },
  });
  res.status(201).json(facility);
});

facilitiesRouter.put("/:id", async (req, res) => {
  const {
    name,
    serviceType,
    capacity,
    openTime,
    closeTime,
    schoolDayOpenTime,
    schoolDayCloseTime,
    schoolOffDayOpenTime,
    schoolOffDayCloseTime,
  } = req.body;

  const facility = await prisma.facility.update({
    where: { id: req.params.id },
    data: {
      name,
      serviceType: serviceType || null,
      capacity: capacity ?? null,
      openTime: openTime || null,
      closeTime: closeTime || null,
      schoolDayOpenTime: schoolDayOpenTime || null,
      schoolDayCloseTime: schoolDayCloseTime || null,
      schoolOffDayOpenTime: schoolOffDayOpenTime || null,
      schoolOffDayCloseTime: schoolOffDayCloseTime || null,
    },
  });
  res.json(facility);
});

facilitiesRouter.delete("/:id", async (req, res) => {
  await prisma.facility.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
