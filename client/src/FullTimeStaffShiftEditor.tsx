import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { getHolidayName } from "./holidays";
import {
  WEEKDAY_LABELS,
  type OffType,
  type Staff,
  type StaffDaySchedule,
  type WorkTimeCategory,
} from "./types";

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
  workTimeCategories: WorkTimeCategory[];
  onBack: () => void;
}

export function FullTimeStaffShiftEditor({ staff, month, workTimeCategories, onBack }: Props) {
  const [year, mon] = month.split("-").map(Number);
  const weeks = useMemo(() => buildCalendarWeeks(month), [month]);
  const [schedules, setSchedules] = useState<Record<string, StaffDaySchedule>>({});
  const [baseCategoryId, setBaseCategoryId] = useState("");
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupStage, setPopupStage] = useState<"choices" | "timeList" | "customTime">("choices");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

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

  const saveDay = async (
    dateValue: string,
    patch: {
      dayType: "WORK" | "OFF";
      offType?: OffType | null;
      workTimeCategoryId?: string | null;
      customStartTime?: string | null;
      customEndTime?: string | null;
    }
  ) => {
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType: patch.dayType,
      offType: patch.offType ?? null,
      workTimeCategoryId: patch.workTimeCategoryId ?? null,
      customStartTime: patch.customStartTime ?? null,
      customEndTime: patch.customEndTime ?? null,
    });
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
  };

  const openPopup = (dateValue: string) => {
    setPopupDate(dateValue);
    setPopupStage("choices");
    setCustomStart("");
    setCustomEnd("");
  };
  const closePopup = () => setPopupDate(null);

  const handleOff = async (dateValue: string, offType: OffType) => {
    await saveDay(dateValue, { dayType: "OFF", offType });
    closePopup();
  };

  const handleTimeChange = async (dateValue: string, categoryId: string) => {
    await saveDay(dateValue, { dayType: "WORK", workTimeCategoryId: categoryId });
    closePopup();
  };

  const handleCustomTimeSave = async (dateValue: string) => {
    if (!customStart || !customEnd) return;
    await saveDay(dateValue, {
      dayType: "WORK",
      workTimeCategoryId: null,
      customStartTime: customStart,
      customEndTime: customEnd,
    });
    closePopup();
  };

  const applyBaseCategory = async () => {
    if (!baseCategoryId) return;
    const daysCount = new Date(year, mon, 0).getDate();
    const targets: string[] = [];
    for (let d = 1; d <= daysCount; d++) {
      const dateValue = `${month}-${String(d).padStart(2, "0")}`;
      if (schedules[dateValue]?.dayType === "OFF") continue;
      targets.push(dateValue);
    }
    await Promise.all(
      targets.map((dateValue) =>
        api.put<StaffDaySchedule>("/day-schedules", {
          staffId: staff.id,
          date: dateValue,
          dayType: "WORK",
          offType: null,
          workTimeCategoryId: baseCategoryId,
        })
      )
    );
    load();
  };

  const handleFinish = async () => {
    await api.put("/staff-schedule-status", { staffId: staff.id, month, isFinalized: true });
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

      <div className="base-time-selector">
        <label>
          基本の勤務時間:{" "}
          <select value={baseCategoryId} onChange={(e) => setBaseCategoryId(e.target.value)}>
            <option value="">選択してください</option>
            {workTimeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={applyBaseCategory} disabled={!baseCategoryId}>
          出勤日に適用
        </button>
        <span className="hint">(休日指定済みの日には適用されません)</span>
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
                const bgClass =
                  schedule?.dayType === "OFF"
                    ? schedule.offType === "PAID_LEAVE"
                      ? "bg-paid-leave"
                      : "bg-requested-off"
                    : "";
                return (
                  <td
                    key={di}
                    className={`calendar-cell ${textClass} ${bgClass}`.trim()}
                    title={holiday ?? undefined}
                    onClick={() => openPopup(dateValue)}
                  >
                    <div className="cell-day">{day}</div>
                    {schedule?.dayType === "WORK" && schedule.workTimeCategory && (
                      <div className="cell-code">{schedule.workTimeCategory.code}</div>
                    )}
                    {schedule?.dayType === "WORK" &&
                      !schedule.workTimeCategory &&
                      schedule.customStartTime &&
                      schedule.customEndTime && (
                        <div className="cell-code" title={`${schedule.customStartTime}〜${schedule.customEndTime}`}>
                          ▲
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
        <span>
          <i className="legend-swatch bg-requested-off" />
          希望休
        </span>
        <span>
          <i className="legend-swatch bg-paid-leave" />
          有給
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
            {popupStage === "choices" && (
              <div className="popup-choices">
                <button type="button" onClick={() => handleOff(popupDate, "REQUESTED")}>
                  希望休
                </button>
                <button type="button" onClick={() => handleOff(popupDate, "PAID_LEAVE")}>
                  有給
                </button>
                <button type="button" onClick={() => setPopupStage("timeList")}>
                  時間変更
                </button>
                <button type="button" onClick={closePopup}>
                  キャンセル
                </button>
              </div>
            )}
            {popupStage === "timeList" && (
              <div className="popup-choices">
                {workTimeCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleTimeChange(popupDate, c.id)}
                  >
                    {c.code}: {c.label}
                  </button>
                ))}
                <button type="button" onClick={() => setPopupStage("customTime")}>
                  ▲: 任意設定(時間を入力)
                </button>
                <button type="button" onClick={() => setPopupStage("choices")}>
                  戻る
                </button>
              </div>
            )}
            {popupStage === "customTime" && (
              <div className="popup-choices">
                <div className="custom-time-inputs">
                  <input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                  <span>〜</span>
                  <input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleCustomTimeSave(popupDate)}
                  disabled={!customStart || !customEnd}
                >
                  この時間で設定
                </button>
                <button type="button" onClick={() => setPopupStage("timeList")}>
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
