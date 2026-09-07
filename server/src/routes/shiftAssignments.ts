import { Router } from "express";
import { prisma } from "../db.js";

export const shiftAssignmentsRouter = Router();

// month: "YYYY-MM" 形式で対象月を絞り込み
function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { gte: start, lt: end };
}

shiftAssignmentsRouter.get("/", async (req, res) => {
  const { month, facilityId, staffId } = req.query;

  const shiftAssignments = await prisma.shiftAssignment.findMany({
    where: {
      date: month ? monthRange(String(month)) : undefined,
      facilityId: facilityId ? String(facilityId) : undefined,
      staffId: staffId ? String(staffId) : undefined,
    },
    include: { staff: true, facility: true },
    orderBy: [{ date: "asc" }, { staffId: "asc" }],
  });
  res.json(shiftAssignments);
});

shiftAssignmentsRouter.post("/", async (req, res) => {
  const { date, staffId, facilityId, startTime, endTime, status, note } = req.body;
  const shiftAssignment = await prisma.shiftAssignment.create({
    data: {
      date: new Date(date),
      staffId,
      facilityId,
      startTime,
      endTime,
      status,
      note,
    },
  });
  res.status(201).json(shiftAssignment);
});

shiftAssignmentsRouter.put("/:id", async (req, res) => {
  const { startTime, endTime, status, note } = req.body;
  const shiftAssignment = await prisma.shiftAssignment.update({
    where: { id: req.params.id },
    data: { startTime, endTime, status, note },
  });
  res.json(shiftAssignment);
});

shiftAssignmentsRouter.delete("/:id", async (req, res) => {
  await prisma.shiftAssignment.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
