import { Router } from "express";
import { prisma } from "../db.js";

export const daySchedulesRouter = Router();

function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { gte: start, lt: end };
}

// GET /api/day-schedules?month=YYYY-MM&staffId=... (staffIdは省略可。省略時は全職員分)
daySchedulesRouter.get("/", async (req, res) => {
  const { month, staffId } = req.query;
  if (!month) {
    res.status(400).json({ error: "month (YYYY-MM) is required" });
    return;
  }

  const schedules = await prisma.staffDaySchedule.findMany({
    where: {
      date: monthRange(String(month)),
      staffId: staffId ? String(staffId) : undefined,
    },
    include: { workTimeCategory: true },
    orderBy: [{ staffId: "asc" }, { date: "asc" }],
  });
  res.json(schedules);
});

// PUT /api/day-schedules (upsert): staffId + date で1件を作成/更新
daySchedulesRouter.put("/", async (req, res) => {
  const {
    staffId,
    date,
    dayType,
    offType,
    workTimeCategoryId,
    customStartTime,
    customEndTime,
    isOverride,
    note,
  } = req.body;

  const parsedDate = new Date(date);

  const schedule = await prisma.staffDaySchedule.upsert({
    where: { staffId_date: { staffId, date: parsedDate } },
    create: {
      staffId,
      date: parsedDate,
      dayType,
      offType: offType || null,
      workTimeCategoryId: workTimeCategoryId || null,
      customStartTime: customStartTime || null,
      customEndTime: customEndTime || null,
      isOverride: isOverride ?? false,
      note: note || null,
    },
    update: {
      dayType,
      offType: offType || null,
      workTimeCategoryId: workTimeCategoryId || null,
      customStartTime: customStartTime || null,
      customEndTime: customEndTime || null,
      isOverride: isOverride ?? false,
      note: note || null,
    },
    include: { workTimeCategory: true },
  });
  res.json(schedule);
});

daySchedulesRouter.delete("/:id", async (req, res) => {
  await prisma.staffDaySchedule.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
