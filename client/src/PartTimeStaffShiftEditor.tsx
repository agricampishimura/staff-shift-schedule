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

// パート職員のシフト作成画面。
// 正社員の画面(FullTimeStaffShiftEditor)とデザインを揃えつつ、以下を変更している:
// - 勤務時間区分(A〜J)の選択がない代わりに、任意の「出勤時間の設定」を一括適用する。
// - 出勤日はカレンダーで個別に選択する(正社員のように全日出勤が前提ではない)。
// - カレンダー・シフト表上は、基本の出勤時間の日を「①」、個別に変更した日を「②」と表記する。
export function PartTimeStaffShiftEditor({ staff, month, onBack }: Props) {
  const [year, mon] = month.split("-").map(Number);
  const weeks = useMemo(() => buildCalendarWeeks(month), [month]);
  const [schedules, setSchedules] = useState<Record<string, StaffDaySchedule>>({});
  const [baseStart, setBaseStart] = useState("");
  const [baseEnd, setBaseEnd] = useState("");
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupStage, setPopupStage] = useState<"choices" | "timeInput">("choices");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

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

  const openPopup = (dateValue: string) => {
    setPopupDate(dateValue);
    setPopupStage("choices");
    const s = schedules[dateValue];
    setEditStart(s?.customStartTime ?? "");
    setEditEnd(s?.customEndTime ?? "");
  };
  const closePopup = () => setPopupDate(null);

  // まだ出勤日として選択されていない日を「出勤日にする」(時間は未設定のまま)
  const handleMarkAsWorkday = async (dateValue: string) => {
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType: "WORK",
      customStartTime: null,
      customEndTime: null,
      isOverride: false,
    });
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
    closePopup();
  };

  // 既に出勤日として選択済みの日を出勤日から外す(レコード削除)
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

  // その日だけ個別に出勤時間を変更(②)
  const handleSaveIndividualTime = async (dateValue: string) => {
    if (!editStart || !editEnd) return;
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType: "WORK",
      customStartTime: editStart,
      customEndTime: editEnd,
      isOverride: true,
    });
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
    closePopup();
  };

  // 「出勤時間の設定」: 出勤日として選択済みの全日に基本の出勤時間を一括適用(①)
  const applyBaseTime = async () => {
    if (!baseStart || !baseEnd) return;
    const targets = Object.keys(schedules).filter((d) => schedules[d]?.dayType === "WORK");
    await Promise.all(
      targets.map((dateValue) =>
        api.put<StaffDaySchedule>("/day-schedules", {
          staffId: staff.id,
          date: dateValue,
          dayType: "WORK",
          customStartTime: baseStart,
          customEndTime: baseEnd,
          isOverride: false,
        })
      )
    );
    load();
  };

  const isAllWorkdaysTimed = () => {
    return Object.values(schedules).every(
      (s) => s.dayType !== "WORK" || (s.customStartTime && s.customEndTime)
    );
  };

  const handleFinish = async () => {
    const isComplete = Object.keys(schedules).length > 0 && isAllWorkdaysTimed();
    await api.put("/staff-schedule-status", {
      staffId: staff.id,
      month,
      isFinalized: true,
      isComplete,
    });
    if (!isComplete) {
      window.alert(
        "出勤日として選択されている日の中に、出勤時間が未設定の日があります。シフト作成トップでは「作成途中」として赤色で表示されます。"
      );
    }
    onBack();
  };

  return (
    <div>
      <div className="staff-editor-header">
        <h3>{staff.name} さんのシフト作成</h3>
        <button type="button" onClick={onBack}>
          ← シフト作成トップに戻る
        </button>
      </div>

      <p className="hint">①出勤日をカレンダーで選択してください。</p>

      <div className="base-time-selector">
        <label>②出勤時間の設定: </label>
        <input type="time" value={baseStart} onChange={(e) => setBaseStart(e.target.value)} />
        <span>〜</span>
        <input type="time" value={baseEnd} onChange={(e) => setBaseEnd(e.target.value)} />
        <button type="button" onClick={applyBaseTime} disabled={!baseStart || !baseEnd}>
          出勤予定日に適用
        </button>
        <span className="hint">(出勤日として選択済みの日にまとめて反映します)</span>
      </div>

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
                const bgClass = schedule?.dayType === "WORK" ? "bg-workday" : "";
                return (
                  <td
                    key={di}
                    className={`calendar-cell ${textClass} ${bgClass}`.trim()}
                    title={holiday ?? undefined}
                    onClick={() => openPopup(dateValue)}
                  >
                    <div className="cell-day">{day}</div>
                    {schedule?.dayType === "WORK" && schedule.customStartTime && schedule.customEndTime && (
                      <div
                        className="cell-code"
                        title={`${schedule.customStartTime}〜${schedule.customEndTime}`}
                      >
                        {schedule.isOverride ? "②" : "①"}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="calendar-legend">
        <span>①: 基本の出勤時間</span>
        <span>②: 時間変更あり</span>
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
            {popupStage === "choices" && !schedules[popupDate] && (
              <div className="popup-choices">
                <button type="button" onClick={() => handleMarkAsWorkday(popupDate)}>
                  出勤日にする
                </button>
                <button type="button" onClick={closePopup}>
                  キャンセル
                </button>
              </div>
            )}
            {popupStage === "choices" && schedules[popupDate] && (
              <div className="popup-choices">
                <button type="button" onClick={() => setPopupStage("timeInput")}>
                  出勤時間を変更
                </button>
                <button type="button" onClick={() => handleUnmark(popupDate)}>
                  出勤日から外す
                </button>
                <button type="button" onClick={closePopup}>
                  キャンセル
                </button>
              </div>
            )}
            {popupStage === "timeInput" && (
              <div className="popup-choices">
                <div className="custom-time-inputs">
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                  />
                  <span>〜</span>
                  <input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveIndividualTime(popupDate)}
                  disabled={!editStart || !editEnd}
                >
                  この時間で設定
                </button>
                <button type="button" onClick={() => setPopupStage("choices")}>
                  戻る
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
