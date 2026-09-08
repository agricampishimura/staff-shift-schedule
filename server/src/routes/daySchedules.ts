import { Router } from "express";
import { prisma } from "../db.js";

export const daySchedulesRouter = Router();

const scheduleInclude = {
  workTimeCategory: true,
  timeBlocks: { orderBy: { sortOrder: "asc" as const } },
};

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
    include: scheduleInclude,
    orderBy: [{ staffId: "asc" }, { date: "asc" }],
  });
  res.json(schedules);
});

// PUT /api/day-schedules (upsert): staffId + date で1件を作成/更新。
// timeBlocks(運転専従パートの中抜け勤務ブロック)を渡した場合は既存分を全て置き換える。
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
    timeBlocks,
  } = req.body;

  const parsedDate = new Date(date);

  const schedule = await prisma.$transaction(async (tx) => {
    const saved = await tx.staffDaySchedule.upsert({
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
    });

    if (timeBlocks !== undefined) {
      await tx.staffDayTimeBlock.deleteMany({ where: { staffDayScheduleId: saved.id } });
      if (timeBlocks.length > 0) {
        await tx.staffDayTimeBlock.createMany({
          data: timeBlocks.map((b: { startTime: string; endTime: string }, i: number) => ({
            staffDayScheduleId: saved.id,
            startTime: b.startTime,
            endTime: b.endTime,
            sortOrder: i,
          })),
        });
      }
    }

    return tx.staffDaySchedule.findUniqueOrThrow({
      where: { id: saved.id },
      include: scheduleInclude,
    });
  });

  res.json(schedule);
});

daySchedulesRouter.delete("/:id", async (req, res) => {
  await prisma.staffDaySchedule.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
