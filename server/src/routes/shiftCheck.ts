import { Router } from "express";
import { prisma } from "../db.js";
import { getHolidayName } from "../holidays.js";

export const shiftCheckRouter = Router();

type FacilityStatus = "RED" | "YELLOW" | "GREEN" | "CLOSED" | "UNCONFIGURED";

const STATUS_SEVERITY: Record<FacilityStatus, number> = {
  RED: 3,
  YELLOW: 2,
  GREEN: 1,
  CLOSED: 0,
  UNCONFIGURED: 0,
};

const ADDITION_TYPE_LABELS: Record<"INSTRUCTOR" | "SEVERE_BEHAVIOR", string> = {
  INSTRUCTOR: "児童指導員配置加算",
  SEVERE_BEHAVIOR: "強度行動障害児支援加算",
};

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(year, mon - 1, i + 1));
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET /api/shift-check?month=YYYY-MM
// 「仮の勤務表」(ShiftAssignment)を必要配置人数マスタ・加算算定要件と突き合わせて判定する。
shiftCheckRouter.get("/", async (req, res) => {
  const { month } = req.query;
  if (!month) {
    res.status(400).json({ error: "month (YYYY-MM) is required" });
    return;
  }
  const monthStr = String(month);
  const dates = daysInMonth(monthStr);
  const [year, mon] = monthStr.split("-").map(Number);
  const rangeStart = new Date(Date.UTC(year, mon - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, mon, 1));

  const facilities = await prisma.facility.findMany({ include: { requiredStaffings: true } });
  const allAssignments = await prisma.shiftAssignment.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd } },
    include: { staff: true },
  });
  // 削除保留(PENDING_REMOVAL)は過不足判定・カード表示からは除外し、日ごとの
  // 「削除を行ったアルバイト」欄用に別集計する(2026-09-12追加)。
  const assignments = allAssignments.filter((a) => a.status !== "PENDING_REMOVAL");
  const pendingRemovalAssignments = allAssignments.filter((a) => a.status === "PENDING_REMOVAL");
  const closures = await prisma.facilityClosure.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd } },
  });
  const closureKeys = new Set(closures.map((c) => `${c.facilityId}_${toDateKey(c.date)}`));

  const assignmentsByFacilityDate = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const key = `${a.facilityId}_${toDateKey(a.date)}`;
    const list = assignmentsByFacilityDate.get(key) ?? [];
    list.push(a);
    assignmentsByFacilityDate.set(key, list);
  }

  const pendingRemovalByDate = new Map<string, typeof pendingRemovalAssignments>();
  for (const a of pendingRemovalAssignments) {
    const key = toDateKey(a.date);
    const list = pendingRemovalByDate.get(key) ?? [];
    list.push(a);
    pendingRemovalByDate.set(key, list);
  }

  type AdditionResult = {
    type: "INSTRUCTOR" | "SEVERE_BEHAVIOR";
    requiredAdditionCount: number;
    qualifiedAssignedCount: number;
    met: boolean;
  };

  // additionRates集計用: facilityId_type -> {metDays, applicableDays}
  const additionTally = new Map<string, { facilityId: string; facilityName: string; type: string; metDays: number; applicableDays: number }>();

  const days = dates.map((date) => {
    const weekday = date.getDay();
    const dateKey = toDateKey(date);
    const holidayName = getHolidayName(date);

    const facilityResults = facilities.map((f) => {
      const required = f.requiredStaffings.find((r) => r.weekday === weekday);
      const assigned = assignmentsByFacilityDate.get(`${f.id}_${dateKey}`) ?? [];
      // サービス管理責任者/児童発達支援管理責任者(サビ管/自発管)は事業所専従の管理業務であり、
      // 人員配置基準上の必要配置人数にはカウントできない(2026-09-12確定)。
      // アルバイト(送迎対象)も基本的には必要配置人数にカウントしない(2026-09-12確定。
      // 児童指導員等の資格要件を満たすアルバイトのみ、該当する加算の判定に限りカウントする)。
      // 表示上はどちらも配置されたカードとして残すが、過不足判定の人数には含めない。
      const nonServiceManagerAssigned = assigned.filter((a) => !a.staff.isServiceManager);
      const countableAssigned = nonServiceManagerAssigned.filter(
        (a) => a.staff.employmentType !== "ARBEIT_TRANSPORT"
      );
      const assignedCount = countableAssigned.length;
      const totalAssignedCount = assigned.length;
      const isManuallyClosed = closureKeys.has(`${f.id}_${dateKey}`);

      let status: FacilityStatus;
      let closedReason: "HOLIDAY" | "MANUAL" | "WEEKLY_OFF" | null = null;
      if (holidayName) {
        // 祝日はすべての事業所が休業日(2026-09-12確定)。曜日別の必要配置人数の設定に
        // かかわらず、稼働日数・過不足判定の対象外とする。
        status = "CLOSED";
        closedReason = "HOLIDAY";
      } else if (isManuallyClosed) {
        // 人数不足を解消できない場合の臨時休業(2026-09-12追加)。祝日と同様に
        // 稼働日数・過不足判定の対象外とする。
        status = "CLOSED";
        closedReason = "MANUAL";
      } else if (!required) {
        status = "UNCONFIGURED";
      } else if (required.requiredCount === 0) {
        status = "CLOSED";
        closedReason = "WEEKLY_OFF";
      } else if (assignedCount < required.requiredCount) {
        status = "RED";
      } else if (assignedCount > required.requiredCount * 2.0) {
        status = "YELLOW";
      } else {
        status = "GREEN";
      }

      const additions: AdditionResult[] = [];
      if (
        !holidayName &&
        !isManuallyClosed &&
        required &&
        required.requiredCount > 0 &&
        f.serviceType === "AFTER_SCHOOL_DAY_SERVICE"
      ) {
        // 加算の資格要件(児童指導員可/強度行動障害研修修了)を満たすアルバイトは、
        // 基本カウント対象外のアルバイトであってもその加算の判定に限り例外的にカウントする
        // (2026-09-12確定。例: 日下さんは児童指導員配置加算のみカウント可能)。
        const additionDefs: {
          type: "INSTRUCTOR" | "SEVERE_BEHAVIOR";
          count: number | null;
          isQualified: (staffId: string) => boolean;
        }[] = [
          {
            type: "INSTRUCTOR",
            count: required.instructorAdditionCount,
            isQualified: (staffId) =>
              nonServiceManagerAssigned.find((a) => a.staffId === staffId)?.staff.canBeChildInstructor ?? false,
          },
          {
            type: "SEVERE_BEHAVIOR",
            count: required.severeBehaviorAdditionCount,
            isQualified: (staffId) =>
              nonServiceManagerAssigned.find((a) => a.staffId === staffId)?.staff.hasSevereBehaviorTraining ?? false,
          },
        ];

        for (const def of additionDefs) {
          if (!def.count || def.count <= 0) continue;
          const qualifiedAssignedCount = nonServiceManagerAssigned.filter((a) =>
            def.isQualified(a.staffId)
          ).length;
          const qualifiedArbeitCount = nonServiceManagerAssigned.filter(
            (a) => a.staff.employmentType === "ARBEIT_TRANSPORT" && def.isQualified(a.staffId)
          ).length;
          const effectiveAssignedCount = assignedCount + qualifiedArbeitCount;
          const met =
            effectiveAssignedCount >= required.requiredCount + def.count && qualifiedAssignedCount >= def.count;
          additions.push({
            type: def.type,
            requiredAdditionCount: def.count,
            qualifiedAssignedCount,
            met,
          });

          const tallyKey = `${f.id}_${def.type}`;
          const tally = additionTally.get(tallyKey) ?? {
            facilityId: f.id,
            facilityName: f.name,
            type: def.type,
            metDays: 0,
            applicableDays: 0,
          };
          tally.applicableDays += 1;
          if (met) tally.metDays += 1;
          additionTally.set(tallyKey, tally);
        }
      }

      const serviceManagerCount = assigned.length - nonServiceManagerAssigned.length;
      const arbeitCount = nonServiceManagerAssigned.length - countableAssigned.length;
      const excludedNotes: string[] = [];
      if (serviceManagerCount > 0) excludedNotes.push(`サビ管/自発管${serviceManagerCount}名`);
      if (arbeitCount > 0) excludedNotes.push(`アルバイト${arbeitCount}名`);
      const serviceManagerNote = excludedNotes.length > 0 ? `(${excludedNotes.join("・")}は人数に含みません)` : "";

      const alerts: string[] = [];
      if (status === "RED" && required) {
        alerts.push(
          `必要人数(${required.requiredCount}名)に対して${assignedCount}名しか配置されていません(${required.requiredCount - assignedCount}名不足)${serviceManagerNote}`
        );
      } else if (status === "YELLOW" && required) {
        const threshold = required.requiredCount * 2;
        alerts.push(
          `必要人数の2倍(${threshold}名)を超える${assignedCount}名が配置されています(${assignedCount - threshold}名超過)${serviceManagerNote}`
        );
      }
      for (const a of additions) {
        if (!a.met) {
          alerts.push(
            `${ADDITION_TYPE_LABELS[a.type]}の要件を満たしていません(必要${a.requiredAdditionCount}名に対し資格保有者${a.qualifiedAssignedCount}名)`
          );
        }
      }

      return {
        facilityId: f.id,
        facilityName: f.name,
        status,
        closedReason,
        requiredCount: required?.requiredCount ?? null,
        assignedCount,
        totalAssignedCount,
        additions,
        assignedStaff: assigned.map((a) => ({
          shiftAssignmentId: a.id,
          staffId: a.staffId,
          staffName: a.staff.name,
          employmentType: a.staff.employmentType,
          canBeChildInstructor: a.staff.canBeChildInstructor,
          hasSevereBehaviorTraining: a.staff.hasSevereBehaviorTraining,
          isServiceManager: a.staff.isServiceManager,
        })),
        alerts,
      };
    });

    const relevantStatuses = facilityResults
      .map((r) => r.status)
      .filter((s) => s !== "CLOSED" && s !== "UNCONFIGURED");
    const overallStatus: FacilityStatus =
      relevantStatuses.length === 0
        ? "CLOSED"
        : relevantStatuses.reduce((worst, s) => (STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst));

    const pendingRemovalStaff = (pendingRemovalByDate.get(dateKey) ?? []).map((a) => ({
      shiftAssignmentId: a.id,
      staffId: a.staffId,
      staffName: a.staff.name,
      employmentType: a.staff.employmentType,
      canBeChildInstructor: a.staff.canBeChildInstructor,
      hasSevereBehaviorTraining: a.staff.hasSevereBehaviorTraining,
      isServiceManager: a.staff.isServiceManager,
      facilityId: a.facilityId,
      facilityName: facilities.find((f) => f.id === a.facilityId)?.name ?? "",
    }));

    return {
      date: dateKey,
      weekday,
      holidayName,
      overallStatus,
      facilities: facilityResults,
      pendingRemovalStaff,
    };
  });

  const additionRates = Array.from(additionTally.values()).map((t) => ({
    ...t,
    percentage: t.applicableDays === 0 ? null : Math.round((t.metDays / t.applicableDays) * 1000) / 10,
  }));

  res.json({ days, additionRates });
});
