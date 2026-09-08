import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { getHolidayName } from "./holidays";
import { WEEKDAY_LABELS, type Staff, type StaffDaySchedule } from "./types";

function buildCalendarWeeks(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const firstDay = new Date(year, mon - 1, 1);
  const daysCount = new Date(year, mon, 0).getDate();
  const startWeekday = firstDay.getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysCount; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

interface Props {
  staff: Staff;
  month: string;
  onBack: () => void;
}

// アルバイトのシフト作成画面。
// 正社員・パートの画面とデザインを揃えつつ、時間設定はなく2段階のステータスのみ扱う。
// ①出勤可能日をカレンダーで登録(記号「可」) → ②必要人数を見ながら管理者が手動で
// 実際の出勤日として確定(記号「出」)する、という運用に合わせている。
export function ArbeitStaffShiftEditor({ staff, month, onBack }: Props) {
  const [year, mon] = month.split("-").map(Number);
  const weeks = useMemo(() => buildCalendarWeeks(month), [month]);
  const [schedules, setSchedules] = useState<Record<string, StaffDaySchedule>>({});
  const [popupDate, setPopupDate] = useState<string | null>(null);

  const load = () => {
    api
      .get<StaffDaySchedule[]>(`/day-schedules?staffId=${staff.id}&month=${month}`)
      .then((list) => {
        const byDate: Record<string, StaffDaySchedule> = {};
        for (const s of list) byDate[s.date.slice(0, 10)] = s;
        setSchedules(byDate);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.id, month]);

  const openPopup = (dateValue: string) => setPopupDate(dateValue);
  const closePopup = () => setPopupDate(null);

  const setStatus = async (dateValue: string, arbeitStatus: "AVAILABLE" | "CONFIRMED") => {
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType: "WORK",
      arbeitStatus,
    });
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
    closePopup();
  };

  const handleUnmark = async (dateValue: string) => {
    const existing = schedules[dateValue];
    if (existing) {
      await api.delete(`/day-schedules/${existing.id}`);
      setSchedules((prev) => {
        const next = { ...prev };
        delete next[dateValue];
        return next;
      });
    }
    closePopup();
  };

  const handleFinish = async () => {
    await api.put("/staff-schedule-status", {
      staffId: staff.id,
      month,
      isFinalized: true,
      // 出勤可能日はゼロ件でも成立する運用のため、常に「完了」扱いとする。
      isComplete: true,
    });
    onBack();
  };

  return (
    <div>
      <div className="staff-editor-header">
        <h3>{staff.name} さんのシフト作成(アルバイト)</h3>
        <button type="button" onClick={onBack}>
          ← シフト作成トップに戻る
        </button>
      </div>

      <p className="hint">
        ①出勤可能日をカレンダーで選択してください(まずは「可」として登録します)。
      </p>

      <table className="mini-calendar">
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((label, i) => (
              <th key={label} className={i === 0 ? "text-red" : i === 6 ? "text-blue" : ""}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null) return <td key={di} className="empty-cell" />;
                const dateValue = `${month}-${String(day).padStart(2, "0")}`;
                const dateObj = new Date(year, mon - 1, day);
                const holiday = getHolidayName(dateObj);
                const schedule = schedules[dateValue];
                const textClass = di === 0 || holiday ? "text-red" : di === 6 ? "text-blue" : "";
                const bgClass =
                  schedule?.arbeitStatus === "CONFIRMED"
                    ? "bg-confirmed"
                    : schedule?.arbeitStatus === "AVAILABLE"
                      ? "bg-available"
                      : "";
                return (
                  <td
                    key={di}
                    className={`calendar-cell ${textClass} ${bgClass}`.trim()}
                    title={holiday ?? undefined}
                    onClick={() => openPopup(dateValue)}
                  >
                    <div className="cell-day">{day}</div>
                    {schedule?.arbeitStatus === "CONFIRMED" && <div className="cell-code">出</div>}
                    {schedule?.arbeitStatus === "AVAILABLE" && <div className="cell-code">可</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="calendar-legend">
        <span>
          <i className="legend-swatch bg-available" />
          可: 出勤可能日
        </span>
        <span>
          <i className="legend-swatch bg-confirmed" />
          出: 出勤確定
        </span>
        <span className="text-red">日曜・祝日</span>
        <span className="text-blue">土曜</span>
      </div>

      <div className="staff-editor-footer">
        <button type="button" onClick={handleFinish}>
          設定終了
        </button>
      </div>

      {popupDate && (
        <div className="modal-backdrop" onClick={closePopup}>
          <div className="day-popup" onClick={(e) => e.stopPropagation()}>
            <h4>{popupDate}</h4>
            <div className="popup-choices">
              {!schedules[popupDate] && (
                <button type="button" onClick={() => setStatus(popupDate, "AVAILABLE")}>
                  出勤可能日にする(可)
                </button>
              )}
              {schedules[popupDate]?.arbeitStatus === "AVAILABLE" && (
                <button type="button" onClick={() => setStatus(popupDate, "CONFIRMED")}>
                  出勤日として確定する(出)
                </button>
              )}
              {schedules[popupDate]?.arbeitStatus === "CONFIRMED" && (
                <button type="button" onClick={() => setStatus(popupDate, "AVAILABLE")}>
                  出勤可能日に戻す(可)
                </button>
              )}
              {schedules[popupDate] && (
                <button type="button" onClick={() => handleUnmark(popupDate)}>
                  登録から外す
                </button>
              )}
              <button type="button" onClick={closePopup}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
