import { Router } from "express";
import { prisma } from "../db.js";
import { apiKeyAuth } from "../middleware/apiKeyAuth.js";

// 外部システム向けAPI。参照系のみ。エンドポイントごとに使う環境変数が異なる
// APIキー認証を適用する(2026-09-16改訂。以前はexternalRouter全体に単一の
// EXTERNAL_API_KEYを適用していたが、エンドポイントを追加する際に呼び出し元
// システムごとに別々のキーを発行できるようにした)。
export const externalRouter = Router();

function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { gte: start, lt: end };
}

// GET /api/external/shift-assignments?month=YYYY-MM&facilityId=...
externalRouter.get("/shift-assignments", apiKeyAuth("EXTERNAL_API_KEY"), async (req, res) => {
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

// 送迎プラン作成サポート向け: このプロジェクトの職員マスタを「正」として提供するAPI
// (2026-09-16追加、docs/decisions/2026-09-16-external-staff-api.md参照)。
// 送迎プラン作成サポート側の要求仕様(旧・BAND_1〜7の7段階)は、このプロジェクトが
// 2026-09-07に実データへ合わせてBAND_A〜Hの8段階(H=運転不可)へ改訂する前のもの。
// 対応表に無いBAND_Hはdriving CapacityBandをnullにしたうえで、生の値を
// drivingCapacityBandRaw(仕様書に無い追加フィールド)として別途返す。
const DRIVING_CAPACITY_BAND_EXTERNAL_MAP: Record<string, string> = {
  BAND_A: "BAND_1",
  BAND_B: "BAND_2",
  BAND_C: "BAND_3",
  BAND_D: "BAND_4",
  BAND_E: "BAND_5",
  BAND_F: "BAND_6",
  BAND_G: "BAND_7",
};

// GET /api/external/staff
// 在籍ステータスによる絞り込みは行わず全職員を返す(送迎側が「一覧に無い=退職」と
// 判定して過去の情報へ移行する運用のため)。
externalRouter.get("/staff", apiKeyAuth("STAFF_API_KEY"), async (_req, res) => {
  const staff = await prisma.staff.findMany({ orderBy: { name: "asc" } });
  res.json(
    staff.map((s) => ({
      id: s.id,
      name: s.name,
      permissionLevel: s.permissionLevel,
      // 送迎側の仕様は必須項目としているが、このプロジェクトではシステム管理者等
      // 職制の記載が無い職員を許容しているため、その場合はnullを返す(要注意)。
      employmentType: s.employmentType,
      employmentStatus: s.employmentStatus,
      drivingCapacityBand: s.drivingCapacityBand
        ? (DRIVING_CAPACITY_BAND_EXTERNAL_MAP[s.drivingCapacityBand] ?? null)
        : null,
      drivingCapacityBandRaw: s.drivingCapacityBand,
      phoneNumber: s.phoneNumber,
      email: s.email,
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
});
