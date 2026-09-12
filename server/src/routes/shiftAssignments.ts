import { Router } from "express";
import { prisma } from "../db.js";
import { isFacilityOperatingDay } from "../operatingDays.js";

export const shiftAssignmentsRouter = Router();

// month: "YYYY-MM" 形式で対象月を絞り込み
function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { gte: start, lt: end };
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, mon - 1, i + 1)));
}

// POST /api/shift-assignments/generate?month=YYYY-MM
// 「仮の勤務表」生成。在籍中かつ主な所属事業所が設定されている職員について、
// 対象月のStaffDaySchedule(出勤日)を元にShiftAssignment(DRAFT)を差分同期する。
// 出勤扱いなのに行が無い(staffId,date)は新規作成、出勤で無くなった(staffId,date)の
// DRAFT行は削除するが、それ以外の既存行(勤務表チェック画面での事業所移動など手動変更含む)
// はそのまま残す。確定済み(CONFIRMED)のレコードは常に一切操作しない。
shiftAssignmentsRouter.post("/generate", async (req, res) => {
  const { month } = req.query;
  if (!month) {
    res.status(400).json({ error: "month (YYYY-MM) is required" });
    return;
  }
  const range = monthRange(String(month));

  const staff = await prisma.staff.findMany({
    where: { employmentStatus: "ZAISEKI_CHU" },
  });

  const unassignedStaff = staff
    .filter((s) => !s.primaryFacilityId)
    .map((s) => s.name);
  const assignableStaff = staff.filter((s) => s.primaryFacilityId);

  const schedules = await prisma.staffDaySchedule.findMany({
    where: {
      date: range,
      staffId: { in: assignableStaff.map((s) => s.id) },
    },
    include: { workTimeCategory: true, timeBlocks: { orderBy: { sortOrder: "asc" } } },
  });
  const staffById = new Map(assignableStaff.map((s) => [s.id, s]));

  const workingSchedules = schedules.filter((sch) => {
    const s = staffById.get(sch.staffId);
    if (!s) return false;
    // アルバイトは「可(出勤可能日)」「出(出勤確定)」のいずれも仮の勤務表に反映する
    // (2026-09-12改訂)。人員配置基準の必要配置人数には基本的にカウントしない前提のため、
    // まず事業所テーブルに実際の配置予定として表示し、管理者が調整できるようにする。
    if (s.employmentType === "ARBEIT_TRANSPORT") {
      return sch.arbeitStatus === "CONFIRMED" || sch.arbeitStatus === "AVAILABLE";
    }
    return sch.dayType === "WORK";
  });

  function timesFor(sch: (typeof workingSchedules)[number]) {
    if (sch.workTimeCategory) {
      return { startTime: sch.workTimeCategory.startTime, endTime: sch.workTimeCategory.endTime };
    }
    if (sch.customStartTime && sch.customEndTime) {
      return { startTime: sch.customStartTime, endTime: sch.customEndTime };
    }
    if (sch.timeBlocks.length > 0) {
      return {
        startTime: sch.timeBlocks[0].startTime,
        endTime: sch.timeBlocks[sch.timeBlocks.length - 1].endTime,
      };
    }
    return { startTime: null, endTime: null };
  }

  const workingKeys = new Set(
    workingSchedules.map((sch) => `${sch.staffId}_${toDateKey(sch.date)}`)
  );

  // 既存行かどうかの判定(=重複作成防止)はステータスを問わず対象月の全行を見る
  // (2026-09-12改訂。DRAFT・PENDING_REMOVAL・CONFIRMEDのいずれであっても、既に
  // (date,staffId,facilityId)の行があれば一意制約に違反するため作成をスキップする)。
  // 自動削除(toRemove)の対象は引き続きDRAFTのみ(削除保留行は月次確定操作でのみ処理する)。
  const existingAssignmentsForSync = await prisma.shiftAssignment.findMany({
    where: { date: range },
  });
  const existingKeys = new Set(
    existingAssignmentsForSync.map((a) => `${a.staffId}_${toDateKey(a.date)}`)
  );
  const existingDrafts = existingAssignmentsForSync.filter((a) => a.status === "DRAFT");

  // 削除保留→月次確定で実削除された(staffId,date)はStaffDayExclusionに記録される
  // (2026-09-12改訂、isAlwaysOnDuty職員専用だった仕組みを全職員に一般化)。
  // 通常のスケジュール同期でもこれを尊重し、除外日には再配置しない。
  const generalExclusions = await prisma.staffDayExclusion.findMany({
    where: { date: range, staffId: { in: assignableStaff.map((s) => s.id) } },
  });
  const generalExclusionKeys = new Set(
    generalExclusions.map((e) => `${e.staffId}_${toDateKey(e.date)}`)
  );

  // 常時稼働職員(役員等、StaffDaySchedule入力を行わない専従職員。例: 石村匠)は
  // スケジュール入力に基づく同期(削除含む)の対象外とする。この後の常時稼働職員
  // 専用ロジックだけで配置を管理する(でないと、スケジュールが存在しないために
  // 毎回「出勤扱いでない」と判定され、自動配置した行が直後に削除されてしまう)。
  const alwaysOnDutyStaffIds = new Set(
    assignableStaff.filter((s) => s.isAlwaysOnDuty).map((s) => s.id)
  );

  const toCreate = workingSchedules.filter(
    (sch) =>
      !existingKeys.has(`${sch.staffId}_${toDateKey(sch.date)}`) &&
      !generalExclusionKeys.has(`${sch.staffId}_${toDateKey(sch.date)}`)
  );
  const toRemove = existingDrafts.filter(
    (a) => !alwaysOnDutyStaffIds.has(a.staffId) && !workingKeys.has(`${a.staffId}_${toDateKey(a.date)}`)
  );

  // 常時稼働職員(役員等、時間に関係なく毎日主な所属事業所に出勤する専従職員。
  // 例: 石村匠)の自動配置(2026-09-12追加)。StaffDaySchedule入力は不要で、
  // 稼働日であれば毎日配置する。ただしStaffDayExclusionで除外された日、および
  // 既に何らかのShiftAssignmentがある日は対象外(=一度削除したら復活しない)。
  const alwaysOnDutyStaff = assignableStaff.filter((s) => s.isAlwaysOnDuty);
  const alwaysOnDutyFacilityIds = [...new Set(alwaysOnDutyStaff.map((s) => s.primaryFacilityId!))];

  const [requiredStaffings, closures, exclusions, existingAnyStatus] = await Promise.all([
    prisma.requiredStaffing.findMany({ where: { facilityId: { in: alwaysOnDutyFacilityIds } } }),
    prisma.facilityClosure.findMany({
      where: { date: range, facilityId: { in: alwaysOnDutyFacilityIds } },
    }),
    prisma.staffDayExclusion.findMany({
      where: { date: range, staffId: { in: alwaysOnDutyStaff.map((s) => s.id) } },
    }),
    prisma.shiftAssignment.findMany({
      where: { date: range, staffId: { in: alwaysOnDutyStaff.map((s) => s.id) } },
    }),
  ]);
  const closureKeys = new Set(closures.map((c) => `${c.facilityId}_${toDateKey(c.date)}`));
  const exclusionKeys = new Set(exclusions.map((e) => `${e.staffId}_${toDateKey(e.date)}`));
  const existingAnyKeys = new Set(existingAnyStatus.map((a) => `${a.staffId}_${toDateKey(a.date)}`));

  const alwaysOnDutyToCreate: { staffId: string; facilityId: string; date: Date }[] = [];
  for (const s of alwaysOnDutyStaff) {
    const facilityId = s.primaryFacilityId!;
    for (const date of daysInMonth(String(month))) {
      const dateKey = toDateKey(date);
      if (exclusionKeys.has(`${s.id}_${dateKey}`)) continue;
      if (existingAnyKeys.has(`${s.id}_${dateKey}`)) continue;
      const requiredCountForWeekday = requiredStaffings.find(
        (r) => r.facilityId === facilityId && r.weekday === date.getUTCDay()
      )?.requiredCount;
      const isManuallyClosed = closureKeys.has(`${facilityId}_${dateKey}`);
      if (!isFacilityOperatingDay(date, requiredCountForWeekday, isManuallyClosed)) continue;
      alwaysOnDutyToCreate.push({ staffId: s.id, facilityId, date });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.shiftAssignment.deleteMany({ where: { id: { in: toRemove.map((a) => a.id) } } });
    }

    for (const sch of toCreate) {
      const s = staffById.get(sch.staffId)!;
      const { startTime, endTime } = timesFor(sch);
      await tx.shiftAssignment.create({
        data: {
          date: sch.date,
          staffId: sch.staffId,
          facilityId: s.primaryFacilityId!,
          startTime,
          endTime,
          status: "DRAFT",
        },
      });
    }

    for (const a of alwaysOnDutyToCreate) {
      await tx.shiftAssignment.create({
        data: { date: a.date, staffId: a.staffId, facilityId: a.facilityId, status: "DRAFT" },
      });
    }
  });

  res.json({
    generatedCount: toCreate.length + alwaysOnDutyToCreate.length,
    removedCount: toRemove.length,
    unassignedStaff,
  });
});

// POST /api/shift-assignments/place { staffId, date, facilityId }
// 勤務表チェックの「配置可能な職員パレット」からの配置。休み(希望休・有給)の職員は
// StaffDaySchedule側も出勤に変更したうえでShiftAssignmentを作成する(2026-09-12追加)。
// 併せて、同じ事業所・日の臨時休業(FacilityClosure)があれば解除する。
shiftAssignmentsRouter.post("/place", async (req, res) => {
  const { staffId, date, facilityId } = req.body;
  const parsedDate = new Date(date);

  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });

  const result = await prisma.$transaction(async (tx) => {
    const existingSchedule = await tx.staffDaySchedule.findUnique({
      where: { staffId_date: { staffId, date: parsedDate } },
    });

    let scheduleChanged = false;
    const isArbeit = staff.employmentType === "ARBEIT_TRANSPORT";

    if (!existingSchedule) {
      await tx.staffDaySchedule.create({
        data: {
          staffId,
          date: parsedDate,
          dayType: "WORK",
          arbeitStatus: isArbeit ? "CONFIRMED" : null,
        },
      });
      scheduleChanged = true;
    } else if (existingSchedule.dayType === "OFF") {
      await tx.staffDaySchedule.update({
        where: { id: existingSchedule.id },
        data: {
          dayType: "WORK",
          offType: null,
          arbeitStatus: isArbeit ? "CONFIRMED" : existingSchedule.arbeitStatus,
        },
      });
      scheduleChanged = true;
    } else if (isArbeit && existingSchedule.arbeitStatus !== "CONFIRMED") {
      await tx.staffDaySchedule.update({
        where: { id: existingSchedule.id },
        data: { arbeitStatus: "CONFIRMED" },
      });
      scheduleChanged = true;
    }

    const shiftAssignment = await tx.shiftAssignment.create({
      data: { date: parsedDate, staffId, facilityId, status: "DRAFT" },
    });

    await tx.facilityClosure
      .delete({ where: { facilityId_date: { facilityId, date: parsedDate } } })
      .catch(() => undefined);

    await tx.staffDayExclusion
      .delete({ where: { staffId_date: { staffId, date: parsedDate } } })
      .catch(() => undefined);

    return { shiftAssignment, scheduleChanged };
  });

  res.status(201).json(result);
});

// POST /api/shift-assignments/confirm-month?month=YYYY-MM
// 「この内容でシフトを確定する」(2026-09-12追加)。対象月の削除保留(PENDING_REMOVAL)行を
// 実際に削除しStaffDayExclusionへ記録、残ったDRAFT行はすべてCONFIRMEDに昇格させる。
// 確定したアルバイトの分はStaffDaySchedule.arbeitStatusもAVAILABLE→CONFIRMED(可→出)に揃える。
shiftAssignmentsRouter.post("/confirm-month", async (req, res) => {
  const { month } = req.query;
  if (!month) {
    res.status(400).json({ error: "month (YYYY-MM) is required" });
    return;
  }
  const range = monthRange(String(month));

  const pendingRemovals = await prisma.shiftAssignment.findMany({
    where: { date: range, status: "PENDING_REMOVAL" },
  });
  const toConfirm = await prisma.shiftAssignment.findMany({
    where: { date: range, status: "DRAFT" },
    include: { staff: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const a of pendingRemovals) {
      await tx.shiftAssignment.delete({ where: { id: a.id } });
      await tx.staffDayExclusion
        .create({ data: { staffId: a.staffId, date: a.date } })
        .catch(() => undefined);
    }

    for (const a of toConfirm) {
      await tx.shiftAssignment.update({ where: { id: a.id }, data: { status: "CONFIRMED" } });

      if (a.staff.employmentType === "ARBEIT_TRANSPORT") {
        const schedule = await tx.staffDaySchedule.findUnique({
          where: { staffId_date: { staffId: a.staffId, date: a.date } },
        });
        if (schedule?.arbeitStatus === "AVAILABLE") {
          await tx.staffDaySchedule.update({
            where: { id: schedule.id },
            data: { arbeitStatus: "CONFIRMED" },
          });
        }
      }
    }
  });

  res.json({ confirmedCount: toConfirm.length, removedCount: pendingRemovals.length });
});

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
  const { facilityId, startTime, endTime, status, note } = req.body;
  try {
    const shiftAssignment = await prisma.shiftAssignment.update({
      where: { id: req.params.id },
      data: { facilityId, startTime, endTime, status, note },
    });
    res.json(shiftAssignment);
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      res.status(409).json({ error: "この職員は移動先の事業所に既に配置されています" });
      return;
    }
    throw err;
  }
});

shiftAssignmentsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.shiftAssignment.findUnique({
    where: { id: req.params.id },
    include: { staff: true },
  });
  if (!existing) {
    res.status(204).end();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.shiftAssignment.delete({ where: { id: existing.id } });
    // 常時稼働職員(2026-09-12追加)は削除の意思をStaffDayExclusionとして残し、
    // 次回の「仮の勤務表を作成」でその日だけ再配置されないようにする。
    if (existing.staff.isAlwaysOnDuty) {
      await tx.staffDayExclusion
        .create({ data: { staffId: existing.staffId, date: existing.date } })
        .catch(() => undefined);
    }
  });

  res.status(204).end();
});
