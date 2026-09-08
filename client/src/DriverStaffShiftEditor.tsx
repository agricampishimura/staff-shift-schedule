import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { getHolidayName } from "./holidays";
import { WEEKDAY_LABELS, type Staff, type StaffDaySchedule } from "./types";

interface TimeBlock {
  startTime: string;
  endTime: string;
}

const EMPTY_BLOCK: TimeBlock = { startTime: "", endTime: "" };

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

function blocksTotalHours(blocks: TimeBlock[]) {
  let totalMinutes = 0;
  for (const b of blocks) {
    if (!b.startTime || !b.endTime) continue;
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    totalMinutes += eh * 60 + em - (sh * 60 + sm);
  }
  return totalMinutes / 60;
}

function isValidBlocks(blocks: TimeBlock[]) {
  return blocks.length > 0 && blocks.every((b) => b.startTime && b.endTime);
}

function TimeBlockEditor({
  blocks,
  onChange,
}: {
  blocks: TimeBlock[];
  onChange: (blocks: TimeBlock[]) => void;
}) {
  const updateBlock = (i: number, field: "startTime" | "endTime", value: string) => {
    onChange(blocks.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  };
  const addBlock = () => onChange([...blocks, { ...EMPTY_BLOCK }]);
  const removeBlock = (i: number) => onChange(blocks.filter((_, idx) => idx !== i));

  return (
    <div className="time-block-editor">
      {blocks.map((b, i) => (
        <div key={i} className="time-block-row">
          <input
            type="time"
            value={b.startTime}
            onChange={(e) => updateBlock(i, "startTime", e.target.value)}
          />
          <span>〜</span>
          <input
            type="time"
            value={b.endTime}
            onChange={(e) => updateBlock(i, "endTime", e.target.value)}
          />
          {blocks.length > 1 && (
            <button type="button" onClick={() => removeBlock(i)}>
              削除
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addBlock}>
        ＋ 出勤時間帯を追加
      </button>
      <div className="hint">合計勤務時間: {blocksTotalHours(blocks).toFixed(2)}</div>
    </div>
  );
}

interface Props {
  staff: Staff;
  month: string;
  onBack: () => void;
}

// 運転専従パートのシフト作成画面。中抜け勤務(1日に複数の出退勤ブロック)に対応する。
// PartTimeStaffShiftEditorと画面構成を揃えつつ、時間設定部分だけ複数ブロック編集にしている。
export function DriverStaffShiftEditor({ staff, month, onBack }: Props) {
  const [year, mon] = month.split("-").map(Number);
  const weeks = useMemo(() => buildCalendarWeeks(month), [month]);
  const [schedules, setSchedules] = useState<Record<string, StaffDaySchedule>>({});
  const [baseBlocks, setBaseBlocks] = useState<TimeBlock[]>([{ ...EMPTY_BLOCK }]);
  const [copiedPattern, setCopiedPattern] = useState<TimeBlock[] | null>(null);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [popupStage, setPopupStage] = useState<"choices" | "blockEditor">("choices");
  const [editBlocks, setEditBlocks] = useState<TimeBlock[]>([{ ...EMPTY_BLOCK }]);

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
  };
  const closePopup = () => setPopupDate(null);

  const handleMarkAsWorkday = async (dateValue: string) => {
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType: "WORK",
      timeBlocks: [],
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

  const openBlockEditor = (dateValue: string) => {
    const existing = schedules[dateValue]?.timeBlocks;
    setEditBlocks(
      existing && existing.length > 0
        ? existing.map((b) => ({ startTime: b.startTime, endTime: b.endTime }))
        : [{ ...EMPTY_BLOCK }]
    );
    setPopupStage("blockEditor");
  };

  const handleSaveBlocks = async (dateValue: string) => {
    if (!isValidBlocks(editBlocks)) return;
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType: "WORK",
      timeBlocks: editBlocks,
    });
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
    setCopiedPattern(editBlocks);
    closePopup();
  };

  const handlePasteCopiedPattern = async (dateValue: string) => {
    if (!copiedPattern) return;
    const updated = await api.put<StaffDaySchedule>("/day-schedules", {
      staffId: staff.id,
      date: dateValue,
      dayType: "WORK",
      timeBlocks: copiedPattern,
    });
    setSchedules((prev) => ({ ...prev, [dateValue]: updated }));
    closePopup();
  };

  const applyBaseBlocks = async () => {
    if (!isValidBlocks(baseBlocks)) return;
    const targets = Object.keys(schedules).filter((d) => schedules[d]?.dayType === "WORK");
    await Promise.all(
      targets.map((dateValue) =>
        api.put<StaffDaySchedule>("/day-schedules", {
          staffId: staff.id,
          date: dateValue,
          dayType: "WORK",
          timeBlocks: baseBlocks,
        })
      )
    );
    setCopiedPattern(baseBlocks);
    load();
  };

  const isAllWorkdaysTimed = () => {
    return Object.values(schedules).every((s) => s.dayType !== "WORK" || s.timeBlocks.length > 0);
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
        "出勤日として選択されている日の中に、出勤時間帯が未設定の日があります。シフト作成トップでは「作成途中」として赤色で表示されます。"
      );
    }
    onBack();
  };

  return (
    <div>
      <div className="staff-editor-header">
        <h3>{staff.name} さんのシフト作成(運転専従)</h3>
        <button type="button" onClick={onBack}>
          ← シフト作成トップに戻る
        </button>
      </div>

      <p className="hint">①出勤日をカレンダーで選択してください。</p>

      <div className="base-time-selector base-time-selector-block">
        <label>②出勤時間の設定(中抜け勤務は複数の時間帯を追加できます): </label>
        <TimeBlockEditor blocks={baseBlocks} onChange={setBaseBlocks} />
        <button type="button" onClick={applyBaseBlocks} disabled={!isValidBlocks(baseBlocks)}>
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
                    {schedule?.dayType === "WORK" && schedule.timeBlocks.length > 0 && (
                      <div className="cell-code">
                        U
                        <br />
                        {blocksTotalHours(schedule.timeBlocks).toFixed(2)}
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
        <span>U: 出勤(下段は勤務時間数)</span>
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
                <button type="button" onClick={() => openBlockEditor(popupDate)}>
                  出勤時間帯を編集
                </button>
                {copiedPattern && (
                  <button type="button" onClick={() => handlePasteCopiedPattern(popupDate)}>
                    コピーしたパターンを貼り付け
                  </button>
                )}
                <button type="button" onClick={() => handleUnmark(popupDate)}>
                  出勤日から外す
                </button>
                <button type="button" onClick={closePopup}>
                  キャンセル
                </button>
              </div>
            )}
            {popupStage === "blockEditor" && (
              <div className="popup-choices">
                <TimeBlockEditor blocks={editBlocks} onChange={setEditBlocks} />
                <button
                  type="button"
                  onClick={() => handleSaveBlocks(popupDate)}
                  disabled={!isValidBlocks(editBlocks)}
                >
                  この内容で設定(他の日にも複製可能になります)
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
