import { Router } from "express";
import { prisma } from "../db.js";

export const staffScheduleStatusRouter = Router();

// GET /api/staff-schedule-status?month=YYYY-MM
staffScheduleStatusRouter.get("/", async (req, res) => {
  const { month } = req.query;
  if (!month) {
    res.status(400).json({ error: "month (YYYY-MM) is required" });
    return;
  }
  const statuses = await prisma.staffScheduleStatus.findMany({
    where: { month: String(month) },
  });
  res.json(statuses);
});

// PUT /api/staff-schedule-status (upsert): staffId + month で1件を作成/更新
staffScheduleStatusRouter.put("/", async (req, res) => {
  const { staffId, month, isFinalized, isComplete } = req.body;
  const status = await prisma.staffScheduleStatus.upsert({
    where: { staffId_month: { staffId, month } },
    create: { staffId, month, isFinalized, isComplete },
    update: { isFinalized, isComplete },
  });
  res.json(status);
});
