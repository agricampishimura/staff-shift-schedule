import { Router } from "express";
import { prisma } from "../db.js";

export const workTimeCategoriesRouter = Router();

workTimeCategoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.workTimeCategory.findMany({ orderBy: { code: "asc" } });
  res.json(categories);
});

workTimeCategoriesRouter.post("/", async (req, res) => {
  const { code, label, startTime, endTime, breakMinutes, workHours, note } = req.body;
  const category = await prisma.workTimeCategory.create({
    data: { code, label, startTime, endTime, breakMinutes, workHours, note },
  });
  res.status(201).json(category);
});

workTimeCategoriesRouter.delete("/:id", async (req, res) => {
  await prisma.workTimeCategory.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
