import { useEffect, useState } from "react";
import { api } from "./api";
import {
  WEEKDAY_LABELS,
  type Staff,
  type StaffDaySchedule,
  type WorkTimeCategory,
} from "./types";

const FULL_TIME_TYPES = ["FULL_TIME_40H", "FULL_TIME_32H"];
const PART_TIME_TYPES = ["PART_TIME_WELFARE", "PART_TIME_DRIVER"];

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
  workTimeCategories: WorkTimeCategory[];
  onClose: () => void;
  onCategoryCreated: (category: WorkTimeCategory) => void;
}

export function StaffDayScheduleModal({
  staff,
  month,
  workTimeCategories,
  onClose,
  onCategoryCreated,
}: Props) {
  const [schedules, setSchedules] = useState<Record<string, StaffDaySchedule>>({});
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState({
    code: "",
    startTime: "",
    endTime: "",
    breakMinutes: 60,
    workHours: 8,
  });

  const isFullTime = !!staff.employmentType && FULL_TIME_TYPES.includes(staff.employmentType);
  const isPartTime = !!staff.employmentType && PART_TIME_TYPES.includes(staff.employmentType);
  const isArbeit = staff.employmentType === "ARBEIT_TRANSPORT";

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

  const save = async (dateValue: string, patch: Partial<StaffDaySchedule>) => {
    const current = schedules[dateValue];
    const body = {
      staffId: staff.id,
      date: dateValue,
      dayType: patch.dayType ?? current?.dayType ?? "WORK",
      workTimeCategoryId:
        patch.workTimeCategoryId !== undefined
          ? patch.workTimeCategoryId
          : current?.workTimeCategoryId ?? null,
      customStartTime:
        patch.customStartTime !== undefined
          ? patch.customStartTime
          : current?.customStartTime ?? null,
      customEndTime:
        patch.customEndTime !== undefined ? patch.customEndTime : current?.customEndTime ?? null,
    };
    const updated = await api.put<StaffDaySchedule>("/day-schedules", body);
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.code.trim() || !newCategory.startTime || !newCategory.endTime) return;
    const created = await api.post<WorkTimeCategory>("/work-time-categories", {
      code: newCategory.code,
      label: `${newCategory.startTime}〜${newCategory.endTime}`,
      startTime: newCategory.startTime,
      endTime: newCategory.endTime,
      breakMinutes: newCategory.breakMinutes,
      workHours: newCategory.workHours,
      note: null,
    });
    onCategoryCreated(created);
    setNewCategory({ code: "", startTime: "", endTime: "", breakMinutes: 60, workHours: 8 });
    setShowNewCategoryForm(false);
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

        {isFullTime && (
          <div className="category-manager">
            <button type="button" onClick={() => setShowNewCategoryForm((v) => !v)}>
              ＋ 勤務時間区分を追加
            </button>
            {showNewCategoryForm && (
              <form onSubmit={handleAddCategory} className="inline-form">
                <input
                  value={newCategory.code}
                  onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value })}
                  placeholder="区分コード(例: J)"
                  maxLength={4}
                />
                <input
                  type="time"
                  value={newCategory.startTime}
                  onChange={(e) => setNewCategory({ ...newCategory, startTime: e.target.value })}
                />
                <span>〜</span>
                <input
                  type="time"
                  value={newCategory.endTime}
                  onChange={(e) => setNewCategory({ ...newCategory, endTime: e.target.value })}
                />
                <label>
                  休憩(分):
                  <input
                    type="number"
                    min={0}
                    value={newCategory.breakMinutes}
                    onChange={(e) =>
                      setNewCategory({ ...newCategory, breakMinutes: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  実働(h):
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={newCategory.workHours}
                    onChange={(e) =>
                      setNewCategory({ ...newCategory, workHours: Number(e.target.value) })
                    }
                  />
                </label>
                <button type="submit">追加</button>
              </form>
            )}
          </div>
        )}

        <div className="day-schedule-list">
          {daysInMonth(month).map(({ dateValue, day, weekday }) => {
            const s = schedules[dateValue];
            const dayType = s?.dayType ?? null;
            return (
              <div key={dateValue} className="day-schedule-row">
                <span className="day-schedule-date">
                  {day}日({weekday})
                </span>

                {isFullTime && (
                  <select
                    value={dayType === "OFF" ? "OFF" : s?.workTimeCategoryId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "OFF") {
                        save(dateValue, { dayType: "OFF", workTimeCategoryId: null });
                      } else if (value === "") {
                        save(dateValue, { dayType: "WORK", workTimeCategoryId: null });
                      } else {
                        save(dateValue, { dayType: "WORK", workTimeCategoryId: value });
                      }
                    }}
                  >
                    <option value="">未設定</option>
                    <option value="OFF">休日</option>
                    {workTimeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.label}
                      </option>
                    ))}
                  </select>
                )}

                {isPartTime && (
                  <>
                    <label className="day-off-toggle">
                      <input
                        type="checkbox"
                        checked={dayType === "OFF"}
                        onChange={(e) =>
                          save(dateValue, { dayType: e.target.checked ? "OFF" : "WORK" })
                        }
                      />
                      休日
                    </label>
                    <input
                      type="time"
                      disabled={dayType === "OFF"}
                      value={s?.customStartTime ?? ""}
                      onChange={(e) =>
                        save(dateValue, { dayType: "WORK", customStartTime: e.target.value })
                      }
                    />
                    <span>〜</span>
                    <input
                      type="time"
                      disabled={dayType === "OFF"}
                      value={s?.customEndTime ?? ""}
                      onChange={(e) =>
                        save(dateValue, { dayType: "WORK", customEndTime: e.target.value })
                      }
                    />
                  </>
                )}

                {isArbeit && (
                  <label className="day-off-toggle">
                    <input
                      type="checkbox"
                      checked={dayType === "WORK"}
                      onChange={(e) =>
                        save(dateValue, { dayType: e.target.checked ? "WORK" : "OFF" })
                      }
                    />
                    出勤
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
