import { Router } from "express";
import { prisma } from "../db.js";

export const facilityClosuresRouter = Router();

// POST /api/facility-closures { facilityId, date }
// 特定の事業所・特定の日を臨時休業として記録する(idempotent)。
facilityClosuresRouter.post("/", async (req, res) => {
  const { facilityId, date, reason } = req.body;
  const closure = await prisma.facilityClosure.upsert({
    where: { facilityId_date: { facilityId, date: new Date(date) } },
    create: { facilityId, date: new Date(date), reason: reason ?? null },
    update: { reason: reason ?? null },
  });
  res.status(201).json(closure);
});

// DELETE /api/facility-closures?facilityId=...&date=YYYY-MM-DD
// 臨時休業設定を解除する(無ければ何もしない)。
facilityClosuresRouter.delete("/", async (req, res) => {
  const { facilityId, date } = req.query;
  await prisma.facilityClosure
    .delete({
      where: { facilityId_date: { facilityId: String(facilityId), date: new Date(String(date)) } },
    })
    .catch(() => undefined);
  res.status(204).end();
});
