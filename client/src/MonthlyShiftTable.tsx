import { useEffect, useState } from "react";
import { api } from "./api";
import { WEEKDAY_LABELS, type Staff, type StaffDaySchedule, type StaffEmploymentType } from "./types";

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, mon - 1, i + 1);
    return { day: i + 1, weekday: WEEKDAY_LABELS[date.getDay()] };
  });
}

// アルバイトは出勤可能日=可/出勤確定=出、運転専従パートは中抜け勤務の記号「U」
// (表示欄が小さいため時間数は表示しない)、パート(福祉職)は基本の出勤時間=①/
// 個別変更=②、正社員の任意設定は▲、それ以外は〇で表記する。
function cellLabel(s: StaffDaySchedule | undefined, employmentType: StaffEmploymentType | null) {
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

export function MonthlyShiftTable({ month }: { month: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedules, setSchedules] = useState<StaffDaySchedule[]>([]);

  useEffect(() => {
    api.get<Staff[]>("/staff").then(setStaff);
  }, []);

  useEffect(() => {
    api.get<StaffDaySchedule[]>(`/day-schedules?month=${month}`).then(setSchedules);
  }, [month]);

  const activeStaff = staff
    .filter((s) => s.employmentStatus === "ZAISEKI_CHU")
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const byStaffAndDate = new Map<string, StaffDaySchedule>();
  for (const s of schedules) {
    byStaffAndDate.set(`${s.staffId}_${s.date.slice(0, 10)}`, s);
  }

  const days = daysInMonth(month);

  return (
    <div className="shift-table-wrapper">
      <table className="shift-table">
        <thead>
          <tr>
            <th className="shift-table-name-col">氏名</th>
            {days.map((d) => (
              <th key={d.day} className={d.weekday === "日" || d.weekday === "土" ? "weekend" : ""}>
                {d.day}
                <br />
                {d.weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeStaff.map((s) => (
            <tr key={s.id}>
              <td className="shift-table-name-col">{s.name}</td>
              {days.map((d) => {
                const dateValue = `${month}-${String(d.day).padStart(2, "0")}`;
                const entry = byStaffAndDate.get(`${s.id}_${dateValue}`);
                return <td key={d.day}>{cellLabel(entry, s.employmentType)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
