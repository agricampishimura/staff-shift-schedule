import { Router } from "express";
import { prisma } from "../db.js";

export const facilitiesRouter = Router();

facilitiesRouter.get("/", async (_req, res) => {
  const facilities = await prisma.facility.findMany({ orderBy: { name: "asc" } });
  res.json(facilities);
});

facilitiesRouter.post("/", async (req, res) => {
  const { name } = req.body;
  const facility = await prisma.facility.create({ data: { name } });
  res.status(201).json(facility);
});

facilitiesRouter.put("/:id", async (req, res) => {
  const { name } = req.body;
  const facility = await prisma.facility.update({
    where: { id: req.params.id },
    data: { name },
  });
  res.json(facility);
});

facilitiesRouter.delete("/:id", async (req, res) => {
  await prisma.facility.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
