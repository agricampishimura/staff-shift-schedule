import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { DriverStaffShiftEditor } from "./DriverStaffShiftEditor";
import { FullTimeStaffShiftEditor } from "./FullTimeStaffShiftEditor";
import { MonthlyShiftTable } from "./MonthlyShiftTable";
import { PartTimeStaffShiftEditor } from "./PartTimeStaffShiftEditor";
import { StaffDayScheduleModal } from "./StaffDayScheduleModal";
import type { Staff, StaffScheduleStatus, WorkTimeCategory } from "./types";

function monthOf(base: Date, offset: number) {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthValue({ year, month }: { year: number; month: number }) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel({ year, month }: { year: number; month: number }) {
  return `${year}年${month}月`;
}

// 対象月の選択肢: 前月・当月・翌月・翌々月(作成日基準)。デフォルトは翌月。
function useMonthOptions() {
  return useMemo(() => {
    const today = new Date();
    const options = [-1, 0, 1, 2].map((offset) => {
      const ym = monthOf(today, offset);
      return { value: monthValue(ym), label: monthLabel(ym) };
    });
    return { options, defaultValue: options[2].value };
  }, []);
}

// 「過去のシフト」で選べる月の一覧(当月より前、直近12ヶ月分)
function usePastMonthOptions() {
  return useMemo(() => {
    const today = new Date();
    const options = Array.from({ length: 12 }, (_, i) => {
      const ym = monthOf(today, -1 - i);
      return { value: monthValue(ym), label: monthLabel(ym) };
    });
    return { options, defaultValue: options[0].value };
  }, []);
}

const FULL_TIME_TYPES = ["FULL_TIME_40H", "FULL_TIME_32H"];
const PART_TIME_TYPES = ["PART_TIME_WELFARE", "PART_TIME_DRIVER"];
const ARBEIT_TYPES = ["ARBEIT_TRANSPORT"];

function StaffCard({
  staff,
  status,
  onClick,
}: {
  staff: Staff;
  status: "none" | "complete" | "incomplete";
  onClick: () => void;
}) {
  const statusClass =
    status === "complete"
      ? " staff-card-finalized"
      : status === "incomplete"
        ? " staff-card-incomplete"
        : "";
  return (
    <button type="button" className={`staff-card staff-card-button${statusClass}`} onClick={onClick}>
      <div className="staff-card-name">{staff.name}</div>
      {staff.primaryFacility && (
        <div className="staff-card-facility">{staff.primaryFacility.name}</div>
      )}
    </button>
  );
}

function RosterColumn({
  title,
  staff,
  statusMap,
  onSelect,
}: {
  title: string;
  staff: Staff[];
  statusMap: Map<string, boolean>;
  onSelect: (s: Staff) => void;
}) {
  return (
    <div className="roster-column">
      <h3>
        {title}
        <span className="roster-count">{staff.length}名</span>
      </h3>
      <div className="roster-cards">
        {staff.length === 0 && <p className="hint">対象職員なし</p>}
        {staff.map((s) => {
          const isComplete = statusMap.get(s.id);
          const status = isComplete === undefined ? "none" : isComplete ? "complete" : "incomplete";
          return <StaffCard key={s.id} staff={s} status={status} onClick={() => onSelect(s)} />;
        })}
      </div>
    </div>
  );
}

type ViewMode = "roster" | "table" | "history" | "staffDetail";

export function ShiftAssignmentsSection() {
  const { options: monthOptions, defaultValue: defaultMonth } = useMonthOptions();
  const { options: pastMonthOptions, defaultValue: defaultPastMonth } = usePastMonthOptions();

  const [viewMode, setViewMode] = useState<ViewMode>("roster");
  const [month, setMonth] = useState(defaultMonth);
  const [historyMonth, setHistoryMonth] = useState(defaultPastMonth);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [workTimeCategories, setWorkTimeCategories] = useState<WorkTimeCategory[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [statusMap, setStatusMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    api.get<Staff[]>("/staff").then(setStaff);
    api.get<WorkTimeCategory[]>("/work-time-categories").then(setWorkTimeCategories);
  }, []);

  const loadStatusMap = () => {
    api.get<StaffScheduleStatus[]>(`/staff-schedule-status?month=${month}`).then((list) => {
      setStatusMap(
        new Map(list.filter((s) => s.isFinalized).map((s) => [s.staffId, s.isComplete]))
      );
    });
  };

  useEffect(() => {
    if (viewMode === "roster") loadStatusMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, month]);

  // シフト作成の対象は在籍中の職員のみ。休職中・リワーク・退職は対象外。
  const activeStaff = staff.filter((s) => s.employmentStatus === "ZAISEKI_CHU");
  const fullTimeStaff = activeStaff.filter(
    (s) => s.employmentType && FULL_TIME_TYPES.includes(s.employmentType)
  );
  const partTimeStaff = activeStaff.filter(
    (s) => s.employmentType && PART_TIME_TYPES.includes(s.employmentType)
  );
  const arbeitStaff = activeStaff.filter(
    (s) => s.employmentType && ARBEIT_TYPES.includes(s.employmentType)
  );

  const handleSelectStaff = (s: Staff) => {
    setSelectedStaff(s);
    if (
      s.employmentType &&
      (FULL_TIME_TYPES.includes(s.employmentType) || PART_TIME_TYPES.includes(s.employmentType))
    ) {
      setViewMode("staffDetail");
    }
  };

  const handleBackFromDetail = () => {
    setSelectedStaff(null);
    setViewMode("roster");
  };

  if (viewMode === "staffDetail" && selectedStaff) {
    const isFullTime =
      selectedStaff.employmentType && FULL_TIME_TYPES.includes(selectedStaff.employmentType);
    const isDriver = selectedStaff.employmentType === "PART_TIME_DRIVER";
    return (
      <section>
        {isFullTime ? (
          <FullTimeStaffShiftEditor
            staff={selectedStaff}
            month={month}
            workTimeCategories={workTimeCategories}
            onBack={handleBackFromDetail}
          />
        ) : isDriver ? (
          <DriverStaffShiftEditor staff={selectedStaff} month={month} onBack={handleBackFromDetail} />
        ) : (
          <PartTimeStaffShiftEditor staff={selectedStaff} month={month} onBack={handleBackFromDetail} />
        )}
      </section>
    );
  }

  return (
    <section>
      <h2>シフト作成</h2>

      <div className="view-mode-buttons">
        <button
          type="button"
          className={viewMode === "table" ? "active" : ""}
          onClick={() => setViewMode(viewMode === "table" ? "roster" : "table")}
        >
          シフト表作成
        </button>
        <button
          type="button"
          className={viewMode === "history" ? "active" : ""}
          onClick={() => setViewMode(viewMode === "history" ? "roster" : "history")}
        >
          過去のシフト
        </button>
      </div>

      {viewMode === "roster" && (
        <>
          <label>
            対象月:{" "}
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <p className="hint">名前カードをクリックすると、その職員の月間シフトを設定できます。</p>

          <div className="staff-roster">
            <RosterColumn
              title="正社員(短時間正社員含む)"
              staff={fullTimeStaff}
              statusMap={statusMap}
              onSelect={handleSelectStaff}
            />
            <RosterColumn
              title="パート"
              staff={partTimeStaff}
              statusMap={statusMap}
              onSelect={handleSelectStaff}
            />
            <RosterColumn
              title="アルバイト"
              staff={arbeitStaff}
              statusMap={statusMap}
              onSelect={handleSelectStaff}
            />
          </div>
        </>
      )}

      {viewMode === "table" && (
        <>
          <label>
            対象月:{" "}
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <MonthlyShiftTable month={month} />
        </>
      )}

      {viewMode === "history" && (
        <>
          <label>
            対象月:{" "}
            <select value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)}>
              {pastMonthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <MonthlyShiftTable month={historyMonth} />
        </>
      )}

      {selectedStaff &&
        viewMode === "roster" &&
        selectedStaff.employmentType &&
        ARBEIT_TYPES.includes(selectedStaff.employmentType) && (
          <StaffDayScheduleModal
            staff={selectedStaff}
            month={month}
            onClose={() => setSelectedStaff(null)}
          />
        )}
    </section>
  );
}
