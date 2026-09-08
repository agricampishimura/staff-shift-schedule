import { useEffect, useState } from "react";
import { api } from "./api";
import { WEEKDAY_LABELS, type Staff, type StaffDaySchedule } from "./types";

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, mon - 1, i + 1);
    return {
      dateValue: `${year}-${String(mon).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
      day: i + 1,
      weekday: WEEKDAY_LABELS[date.getDay()],
    };
  });
}

interface Props {
  staff: Staff;
  month: string;
  onClose: () => void;
}

// アルバイト専用: 出勤/休みのみを管理する(時間設定なし)。
export function StaffDayScheduleModal({ staff, month, onClose }: Props) {
  const [schedules, setSchedules] = useState<Record<string, StaffDaySchedule>>({});

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

  const save = async (dateValue: string, dayType: "WORK" | "OFF") => {
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType,
    });
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {staff.name} さんの{month.replace("-", "年")}月シフト
          </h3>
          <button type="button" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="day-schedule-list">
          {daysInMonth(month).map(({ dateValue, day, weekday }) => {
            const s = schedules[dateValue];
            return (
              <div key={dateValue} className="day-schedule-row">
                <span className="day-schedule-date">
                  {day}日({weekday})
                </span>
                <label className="day-off-toggle">
                  <input
                    type="checkbox"
                    checked={s?.dayType === "WORK"}
                    onChange={(e) => save(dateValue, e.target.checked ? "WORK" : "OFF")}
                  />
                  出勤
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
