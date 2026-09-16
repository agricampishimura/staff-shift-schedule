// シフト確定時のExcel出力(2026-09-16追加)。
// 「新シフト表_<年>.xlsx」を年ごとに1ファイル作成し、月次確定のたびに
// 「<年>年<月>月全体」「<年>年<月>月内訳」の2シートを追加(既存の同名シートは置き換え)する。
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db.js";

// 保存先(共有ドライブ)。未設定時はローカルのstorage/exports(開発用フォールバック)。
function resolveExportDir() {
  const configured = process.env.SHIFT_EXCEL_EXPORT_DIR;
  return configured ? path.resolve(configured) : path.resolve("storage/exports");
}

// 確定済みシフト表の編集制限パスワード(2026-09-16追加。ユーザー指定の既定値)。
// シート保護のパスワードのため、閲覧は誰でも可能・編集(セル変更・行列操作等)のみ
// このパスワードを知っている人に限定される。
const EDIT_PASSWORD = process.env.SHIFT_EXCEL_PASSWORD || "agri-camp";
const PROTECTION_OPTIONS: Partial<ExcelJS.WorksheetProtection> = {
  selectLockedCells: true,
  selectUnlockedCells: true,
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { gte: start, lt: end };
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateKeyFor(year: number, mon: number, day: number) {
  return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  return Array.from({ length: count }, (_, i) => i + 1);
}

function weekdayLabel(year: number, mon: number, day: number) {
  return WEEKDAY_LABELS[new Date(year, mon - 1, day).getDay()];
}

function isWeekend(year: number, mon: number, day: number) {
  const d = new Date(year, mon - 1, day).getDay();
  return d === 0 || d === 6;
}

// client/src/MonthlyShiftTable.tsx の cellLabel と同じロジック(サーバー側で複製)。
type ScheduleForLabel = {
  dayType: string;
  arbeitStatus: string | null;
  workTimeCategory: { code: string } | null;
  customStartTime: string | null;
  customEndTime: string | null;
  isOverride: boolean;
  timeBlocks: { startTime: string; endTime: string }[];
};

function cellLabel(s: ScheduleForLabel | undefined, employmentType: string | null) {
  if (!s) return "";
  if (employmentType === "ARBEIT_TRANSPORT") {
    if (s.arbeitStatus === "CONFIRMED") return "出";
    if (s.arbeitStatus === "AVAILABLE") return "可";
    return "";
  }
  if (s.dayType === "OFF") return "休";
  if (employmentType === "PART_TIME_DRIVER") {
    return s.timeBlocks.length > 0 ? "U" : "";
  }
  if (s.workTimeCategory) return s.workTimeCategory.code;
  if (s.customStartTime && s.customEndTime) {
    if (employmentType === "PART_TIME_WELFARE") {
      return s.isOverride ? "②" : "①";
    }
    return "▲";
  }
  return "〇";
}

function styleHeaderRow(row: ExcelJS.Row, year: number, mon: number, days: number[]) {
  row.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = THIN_BORDER;
    if (colNumber > 1) {
      const day = days[colNumber - 2];
      if (isWeekend(year, mon, day)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4DCDC" } };
      }
    }
  });
}

function addHeaderRow(sheet: ExcelJS.Worksheet, year: number, mon: number, days: number[]) {
  const row = sheet.addRow(["氏名", ...days.map((d) => `${d}\n${weekdayLabel(year, mon, d)}`)]);
  styleHeaderRow(row, year, mon, days);
  return row;
}

function styleDataRow(row: ExcelJS.Row, columnCount: number) {
  for (let c = 1; c <= columnCount; c++) {
    const cell = row.getCell(c);
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: c === 1 ? "left" : "center", vertical: "middle" };
  }
}

function setColumnWidths(sheet: ExcelJS.Worksheet, days: number[]) {
  sheet.getColumn(1).width = 14;
  for (let i = 0; i < days.length; i++) {
    sheet.getColumn(i + 2).width = 4;
  }
}

// ---------------------------------------------------------------------------
// シート1: 全体(氏名 x 日付。過去のシフト画面のMonthlyShiftTableと同じ内容)
// ---------------------------------------------------------------------------

async function loadOverallData(month: string) {
  const range = monthRange(month);
  const staff = await prisma.staff.findMany({ where: { employmentStatus: "ZAISEKI_CHU" } });
  const activeStaff = staff.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const schedules = await prisma.staffDaySchedule.findMany({
    where: { date: range },
    include: { workTimeCategory: true, timeBlocks: { orderBy: { sortOrder: "asc" } } },
  });
  const byStaffAndDate = new Map<string, (typeof schedules)[number]>();
  for (const s of schedules) {
    byStaffAndDate.set(`${s.staffId}_${toDateKey(s.date)}`, s);
  }

  return { activeStaff, byStaffAndDate };
}

async function buildOverallSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  year: number,
  mon: number,
  days: number[],
  data: Awaited<ReturnType<typeof loadOverallData>>
) {
  const sheet = workbook.addWorksheet(sheetName);
  addHeaderRow(sheet, year, mon, days);

  for (const s of data.activeStaff) {
    const row = sheet.addRow([
      s.name,
      ...days.map((d) => cellLabel(data.byStaffAndDate.get(`${s.id}_${dateKeyFor(year, mon, d)}`), s.employmentType)),
    ]);
    styleDataRow(row, days.length + 1);
  }

  setColumnWidths(sheet, days);
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  // 編集者を限定するためのシート保護(2026-09-16追加)。閲覧・選択は誰でも可能。
  await sheet.protect(EDIT_PASSWORD, PROTECTION_OPTIONS);
}

// ---------------------------------------------------------------------------
// シート2: 内訳(事業所ごとに配置職員を氏名 x 日付で表示)
// ---------------------------------------------------------------------------

async function loadBreakdownData(month: string) {
  const range = monthRange(month);
  const facilities = await prisma.facility.findMany({ orderBy: { createdAt: "asc" } });
  const assignments = await prisma.shiftAssignment.findMany({
    where: { date: range, status: "CONFIRMED" },
    include: { staff: true },
  });
  const schedules = await prisma.staffDaySchedule.findMany({
    where: { date: range },
    include: { workTimeCategory: true, timeBlocks: { orderBy: { sortOrder: "asc" } } },
  });

  const scheduleByStaffDate = new Map<string, (typeof schedules)[number]>();
  for (const s of schedules) {
    scheduleByStaffDate.set(`${s.staffId}_${toDateKey(s.date)}`, s);
  }

  const assignmentsByFacility = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = assignmentsByFacility.get(a.facilityId) ?? [];
    list.push(a);
    assignmentsByFacility.set(a.facilityId, list);
  }

  return { facilities, assignmentsByFacility, scheduleByStaffDate };
}

async function buildBreakdownSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  year: number,
  mon: number,
  days: number[],
  data: Awaited<ReturnType<typeof loadBreakdownData>>
) {
  const sheet = workbook.addWorksheet(sheetName);
  const totalCols = days.length + 1;

  for (const facility of data.facilities) {
    const titleRow = sheet.addRow([facility.name]);
    sheet.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
    titleRow.getCell(1).font = { bold: true, size: 12 };

    addHeaderRow(sheet, year, mon, days);

    const facilityAssignments = data.assignmentsByFacility.get(facility.id) ?? [];
    const staffMap = new Map(facilityAssignments.map((a) => [a.staffId, a.staff]));
    const assignedDatesByStaff = new Map<string, Set<string>>();
    for (const a of facilityAssignments) {
      const set = assignedDatesByStaff.get(a.staffId) ?? new Set<string>();
      set.add(toDateKey(a.date));
      assignedDatesByStaff.set(a.staffId, set);
    }
    const sortedStaffIds = [...staffMap.keys()].sort((a, b) =>
      staffMap.get(a)!.name.localeCompare(staffMap.get(b)!.name, "ja")
    );

    if (sortedStaffIds.length === 0) {
      const emptyRow = sheet.addRow(["(配置なし)"]);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF888888" } };
    } else {
      for (const staffId of sortedStaffIds) {
        const staffInfo = staffMap.get(staffId)!;
        const assignedDates = assignedDatesByStaff.get(staffId)!;
        const row = sheet.addRow([
          staffInfo.name,
          ...days.map((d) => {
            const dateKey = dateKeyFor(year, mon, d);
            if (!assignedDates.has(dateKey)) return "";
            // 常時稼働職員(isAlwaysOnDuty)等、ShiftAssignmentはあるがStaffDaySchedule
            // レコードを持たない職員がいるため、その場合は単純な出勤マーク「〇」を表示する。
            return cellLabel(data.scheduleByStaffDate.get(`${staffId}_${dateKey}`), staffInfo.employmentType) || "〇";
          }),
        ]);
        styleDataRow(row, totalCols);
      }
    }

    sheet.addRow([]);
  }

  setColumnWidths(sheet, days);
  // 編集者を限定するためのシート保護(2026-09-16追加)。閲覧・選択は誰でも可能。
  await sheet.protect(EDIT_PASSWORD, PROTECTION_OPTIONS);
}

// ---------------------------------------------------------------------------

export async function exportShiftExcel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const overallSheetName = `${year}年${mon}月全体`;
  const breakdownSheetName = `${year}年${mon}月内訳`;
  const filename = `新シフト表_${year}.xlsx`;
  const exportDir = resolveExportDir();
  const filePath = path.join(exportDir, filename);

  fs.mkdirSync(exportDir, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
  }

  // 同じ月を再確定した場合に備え、既存の同名シートは置き換える。
  for (const name of [overallSheetName, breakdownSheetName]) {
    const existing = workbook.getWorksheet(name);
    if (existing) workbook.removeWorksheet(existing.id);
  }

  const days = daysInMonth(month);
  const overallData = await loadOverallData(month);
  await buildOverallSheet(workbook, overallSheetName, year, mon, days, overallData);

  const breakdownData = await loadBreakdownData(month);
  await buildBreakdownSheet(workbook, breakdownSheetName, year, mon, days, breakdownData);

  await workbook.xlsx.writeFile(filePath);
  const bufferData = await workbook.xlsx.writeBuffer();

  return { buffer: Buffer.from(bufferData), filename, overallSheetName, breakdownSheetName };
}
