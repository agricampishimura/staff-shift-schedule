import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { ArbeitStaffShiftEditor } from "./ArbeitStaffShiftEditor";
import { DriverStaffShiftEditor } from "./DriverStaffShiftEditor";
import { FullTimeStaffShiftEditor } from "./FullTimeStaffShiftEditor";
import { MonthlyShiftTable } from "./MonthlyShiftTable";
import { PartTimeStaffShiftEditor } from "./PartTimeStaffShiftEditor";
import { ShiftCheckView } from "./ShiftCheckView";
import { clearShiftCheckProgress, loadShiftCheckProgress } from "./shiftCheckProgress";
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

type ViewMode = "roster" | "table" | "check" | "history" | "staffDetail";

export function ShiftAssignmentsSection() {
  const { options: monthOptions, defaultValue: defaultMonth } = useMonthOptions();
  const { options: pastMonthOptions, defaultValue: defaultPastMonth } = usePastMonthOptions();

  const [viewMode, setViewMode] = useState<ViewMode>("roster");
  const [month, setMonth] = useState(defaultMonth);
  // 勤務表チェックの対象月はトップ画面(ロースター)の対象月とは独立させる
  // (2026-09-12追加)。共有すると、トップ画面で別の月を見ただけで進行中の
  // チェック内容が意図せずリセットされてしまうため。
  // 初期値はlocalStorageの保存内容から復元する(ページ再読み込み後も
  // 「作成中のシフト作成に戻る」で復帰できるようにするため)。
  const [checkMonth, setCheckMonth] = useState(() => loadShiftCheckProgress()?.month ?? defaultMonth);
  const [hasCheckProgress, setHasCheckProgress] = useState(() => loadShiftCheckProgress() !== null);
  const [initialSelectedDay, setInitialSelectedDay] = useState<string | null>(
    () => loadShiftCheckProgress()?.selectedDay ?? null
  );
  // 「最初からシフト作成を行う」で押下時にキーを変えてShiftCheckViewを強制的に
  // 再マウントし、内部状態(選択中の日付・取得済みデータ等)を完全にリセットする。
  const [checkResumeKey, setCheckResumeKey] = useState(0);
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
    setViewMode("staffDetail");
  };

  const handleBackFromDetail = () => {
    setSelectedStaff(null);
    setViewMode("roster");
  };

  // 「最初からシフト作成を行う」(2026-09-12追加): 作成途中の保存内容を破棄し、
  // 対象月をトップ画面(ロースター)で選択中の月に合わせたうえで、ShiftCheckViewを
  // 強制再マウントしてまっさらな状態から勤務表チェックを開始する。
  const handleStartOver = () => {
    if (
      !window.confirm(
        "作成中の勤務表チェックの内容を破棄して、最初からやり直しますか?(すでに保存済みの配置データ自体は削除されません)"
      )
    )
      return;
    clearShiftCheckProgress();
    setCheckMonth(month);
    setInitialSelectedDay(null);
    setCheckResumeKey((k) => k + 1);
    setHasCheckProgress(true);
    setViewMode("check");
  };

  const handleCheckConfirmed = () => {
    setHasCheckProgress(false);
  };

  const isFullTime =
    selectedStaff?.employmentType && FULL_TIME_TYPES.includes(selectedStaff.employmentType);
  const isDriver = selectedStaff?.employmentType === "PART_TIME_DRIVER";
  const isArbeit = selectedStaff?.employmentType === "ARBEIT_TRANSPORT";

  return (
    <section>
      {viewMode === "staffDetail" && selectedStaff ? (
        isFullTime ? (
          <FullTimeStaffShiftEditor
            staff={selectedStaff}
            month={month}
            workTimeCategories={workTimeCategories}
            onBack={handleBackFromDetail}
          />
        ) : isDriver ? (
          <DriverStaffShiftEditor staff={selectedStaff} month={month} onBack={handleBackFromDetail} />
        ) : isArbeit ? (
          <ArbeitStaffShiftEditor staff={selectedStaff} month={month} onBack={handleBackFromDetail} />
        ) : (
          <PartTimeStaffShiftEditor staff={selectedStaff} month={month} onBack={handleBackFromDetail} />
        )
      ) : (
        <>
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
              className={viewMode === "check" ? "active" : ""}
              onClick={() => {
                // 作成途中の状態が無い(=新規にチェックを始める)場合は、勤務表チェックの
                // 対象月をトップ画面(ロースター)で選択中の月に合わせる(2026-09-12修正)。
                // これを行わないと、シフト表作成で入力した月と勤務表チェックの対象月が
                // 食い違い、他職員の配置が仮の勤務表に反映されないという不具合になる。
                // 既に作成途中の状態がある場合は、その対象月を変えずに維持する
                // (トップ画面で別の月を見ただけで進行中のチェックが失われないようにするため)。
                if (!hasCheckProgress) {
                  setCheckMonth(month);
                }
                setHasCheckProgress(true);
                setViewMode(viewMode === "check" ? "roster" : "check");
              }}
            >
              勤務表チェック
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
              {hasCheckProgress && (
                <p className="resume-check-banner">
                  作成中の勤務表チェックがあります。
                  <button type="button" onClick={() => setViewMode("check")}>
                    作成中のシフト作成に戻る
                  </button>
                  <button type="button" onClick={handleStartOver}>
                    最初からシフト作成を行う
                  </button>
                </p>
              )}

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
        </>
      )}

      {/* 進行中の勤務表チェックは、他のビュー(トップ画面・個別編集画面等)に
          移動しても状態を保持するため、viewModeに関わらず常にマウントしたまま
          hidden属性で表示/非表示を切り替える(2026-09-12追加)。 */}
      {hasCheckProgress && (
        <div hidden={viewMode !== "check"}>
          <button type="button" className="back-to-top-button" onClick={() => setViewMode("roster")}>
            ← シフト作成トップに戻る
          </button>
          <label>
            対象月:{" "}
            <select value={checkMonth} onChange={(e) => setCheckMonth(e.target.value)}>
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <ShiftCheckView
            key={checkResumeKey}
            month={checkMonth}
            initialSelectedDay={initialSelectedDay}
            onConfirmed={handleCheckConfirmed}
          />
        </div>
      )}
    </section>
  );
}
