import { Router } from "express";
import { prisma } from "../db.js";

// AgriCamp等の外部システム向けAPI。参照系のみ、確定(CONFIRMED)シフトのみを返す。
// 認証は src/index.ts 側で apiKeyAuth ミドルウェアを適用する。
export const externalRouter = Router();

function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { gte: start, lt: end };
}

// GET /api/external/shift-assignments?month=YYYY-MM&facilityId=...
externalRouter.get("/shift-assignments", async (req, res) => {
  const { month, facilityId } = req.query;
  if (!month) {
    res.status(400).json({ error: "month (YYYY-MM) is required" });
    return;
  }

  const shiftAssignments = await prisma.shiftAssignment.findMany({
    where: {
      date: monthRange(String(month)),
      facilityId: facilityId ? String(facilityId) : undefined,
      status: "CONFIRMED",
    },
    include: { staff: true, facility: true },
    orderBy: [{ date: "asc" }, { staffId: "asc" }],
  });
  res.json(shiftAssignments);
});
