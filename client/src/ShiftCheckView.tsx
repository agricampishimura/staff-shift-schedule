import { useEffect, useRef, useState } from "react";
import { api, postDownload, saveBlobAsFile } from "./api";
import { ShiftCheckDayDetail } from "./ShiftCheckDayDetail";
import { clearShiftCheckProgress, saveShiftCheckProgress } from "./shiftCheckProgress";
import {
  ADDITION_TYPE_LABELS,
  WEEKDAY_LABELS,
  type ConfirmMonthResult,
  type Facility,
  type FacilityCheckStatus,
  type GenerateShiftAssignmentsResult,
  type ShiftAssignment,
  type ShiftCheckResult,
  type Staff,
  type StaffDaySchedule,
} from "./types";

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, mon - 1, i + 1);
    return { day: i + 1, weekday: WEEKDAY_LABELS[date.getDay()] };
  });
}

const STATUS_CLASS: Record<FacilityCheckStatus, string> = {
  RED: "shift-check-red",
  YELLOW: "shift-check-yellow",
  GREEN: "shift-check-green",
  CLOSED: "shift-check-closed",
  UNCONFIGURED: "shift-check-closed",
};

export function ShiftCheckView({
  month,
  initialSelectedDay = null,
  onConfirmed,
}: {
  month: string;
  initialSelectedDay?: string | null;
  onConfirmed?: () => void;
}) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [daySchedules, setDaySchedules] = useState<StaffDaySchedule[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [generateInfo, setGenerateInfo] = useState<GenerateShiftAssignmentsResult | null>(null);
  const [confirmInfo, setConfirmInfo] = useState<ConfirmMonthResult | null>(null);
  const [exportedFilename, setExportedFilename] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<ShiftCheckResult | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(initialSelectedDay);
  const [loading, setLoading] = useState(false);
  // [month]エフェクトで「本当に月が変わったか」を判定するための直前値(2026-09-12追加)。
  // StrictMode(開発時)はマウント時のエフェクトを2回連続で実行するため、単純な
  // 「初回フラグ」だと2回目の呼び出しで復元したselectedDayを消してしまう。
  // 「前回のmonthと比較して変化していなければ何もしない」方式にすることで、
  // 同じmonthでの再実行(初回・StrictModeの2回目とも)を安全にスキップできる。
  const previousMonthRef = useRef(month);

  useEffect(() => {
    api.get<Facility[]>("/facilities").then(setFacilities);
  }, []);

  const loadAssignments = () =>
    api.get<ShiftAssignment[]>(`/shift-assignments?month=${month}`).then(setAssignments);
  const loadStaff = () => api.get<Staff[]>("/staff").then(setStaff);
  const loadDaySchedules = () =>
    api.get<StaffDaySchedule[]>(`/day-schedules?month=${month}`).then(setDaySchedules);

  useEffect(() => {
    loadAssignments();
    loadStaff();
    loadDaySchedules();
    if (previousMonthRef.current !== month) {
      setGenerateInfo(null);
      setConfirmInfo(null);
      setCheckResult(null);
      setSelectedDay(null);
    }
    previousMonthRef.current = month;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // 作成途中の状態への復帰(2026-09-12追加): 選択中の日付があれば
  // (=以前「勤務表のチェック」まで進めていた)、チェック結果を自動的に取得し直す。
  useEffect(() => {
    if (initialSelectedDay) {
      api.get<ShiftCheckResult>(`/shift-check?month=${month}`).then(setCheckResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 選択中の日付・対象月をlocalStorageへ保存し、シフト作成トップ画面に戻った後も
  // 「作成中のシフト作成に戻る」で復帰できるようにする(2026-09-12追加)。
  useEffect(() => {
    saveShiftCheckProgress({ month, selectedDay });
  }, [month, selectedDay]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await api.post<GenerateShiftAssignmentsResult>(
        `/shift-assignments/generate?month=${month}`,
        {}
      );
      setGenerateInfo(result);
      setCheckResult(null);
      setSelectedDay(null);
      await loadAssignments();
    } finally {
      setLoading(false);
    }
  };

  const refreshCheck = () => api.get<ShiftCheckResult>(`/shift-check?month=${month}`).then(setCheckResult);

  const handleCheck = async () => {
    setLoading(true);
    try {
      await refreshCheck();
    } finally {
      setLoading(false);
    }
  };

  const handleDayChanged = async () => {
    await Promise.all([loadAssignments(), loadDaySchedules(), refreshCheck()]);
  };

  const handleConfirmMonth = async () => {
    if (
      !window.confirm(
        "この内容でシフトを確定しますか?削除保留中の配置は実際に削除され、残りの配置は確定済みになります。"
      )
    )
      return;
    setLoading(true);
    setExportedFilename(null);
    setExportError(null);
    try {
      const result = await api.post<ConfirmMonthResult>(`/shift-assignments/confirm-month?month=${month}`, {});
      setConfirmInfo(result);
      await Promise.all([loadAssignments(), loadDaySchedules(), refreshCheck()]);
      // 確定後はもう「作成途中」ではないため、復帰用の保存内容をクリアする(2026-09-12追加)。
      clearShiftCheckProgress();

      // 確定したシフトをExcelファイルとして書き出し、そのままダウンロードする
      // (2026-09-16追加。出力先: storage/exports/新シフト表_<年>.xlsx)。
      try {
        const { blob, filename } = await postDownload(`/shift-assignments/export-excel?month=${month}`);
        saveBlobAsFile(blob, filename);
        setExportedFilename(filename);
      } catch (err) {
        setExportError(err instanceof Error ? err.message : String(err));
      }

      onConfirmed?.();
    } finally {
      setLoading(false);
    }
  };

  const days = daysInMonth(month);

  const countByFacilityDate = new Map<string, number>();
  for (const a of assignments) {
    const key = `${a.facilityId}_${a.date.slice(0, 10)}`;
    countByFacilityDate.set(key, (countByFacilityDate.get(key) ?? 0) + 1);
  }

  const dayResult = selectedDay ? checkResult?.days.find((d) => d.date === selectedDay) : undefined;

  return (
    <section>
      <div className="shift-check-actions">
        <button type="button" onClick={handleGenerate} disabled={loading}>
          仮の勤務表を作成
        </button>
        <button type="button" onClick={handleCheck} disabled={loading || assignments.length === 0}>
          勤務表のチェック
        </button>
        <button type="button" onClick={handleConfirmMonth} disabled={loading || assignments.length === 0}>
          この内容でシフトを確定する
        </button>
      </div>

      {generateInfo && (
        <p className="hint">
          {generateInfo.generatedCount}件の配置を追加、{generateInfo.removedCount}件の配置を削除しました(手動で調整済みの配置はそのまま保持されます)。
          {generateInfo.unassignedStaff.length > 0 && (
            <span className="shift-check-warning-text">
              {" "}
              主な所属事業所が未設定のため配置できなかった職員: {generateInfo.unassignedStaff.join("、")}
            </span>
          )}
        </p>
      )}

      {confirmInfo && (
        <p className="hint">
          {confirmInfo.confirmedCount}件の配置を確定し、{confirmInfo.removedCount}件の削除保留分を実際に削除しました。
        </p>
      )}

      {exportedFilename && (
        <p className="hint">
          シフト表(Excel)「{exportedFilename}」をダウンロードし、共有ドライブ(アソシエイト共有書類\全員出勤表\シフト表)にも保存しました。
          編集にはパスワードが必要です(閲覧は誰でも可能)。ファイルを開いて印刷・保存してください。
        </p>
      )}
      {exportError && (
        <p className="hint shift-check-warning-text">
          シフト確定は完了しましたが、Excelファイルの出力に失敗しました: {exportError}
        </p>
      )}

      {assignments.length === 0 && (
        <p className="hint">
          「仮の勤務表を作成」を押すと、入力済みの勤務予定から事業所別の配置人数を集計します。
        </p>
      )}

      {assignments.length > 0 && (
        <div className="shift-table-wrapper">
          <table className="shift-table">
            <thead>
              <tr>
                <th className="shift-table-name-col">事業所</th>
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
              {facilities.map((f) => (
                <tr key={f.id}>
                  <td className="shift-table-name-col">{f.name}</td>
                  {days.map((d) => {
                    const dateValue = `${month}-${String(d.day).padStart(2, "0")}`;
                    const count = countByFacilityDate.get(`${f.id}_${dateValue}`) ?? 0;
                    return <td key={d.day}>{count > 0 ? count : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {checkResult && (
        <>
          <h3>勤務表チェック結果</h3>
          <div className="shift-check-legend">
            <span className="shift-check-legend-item shift-check-red">人数不足</span>
            <span className="shift-check-legend-item shift-check-yellow">過剰配置</span>
            <span className="shift-check-legend-item shift-check-green">適正</span>
            <span className="shift-check-legend-item shift-check-closed">休業日/未設定</span>
          </div>
          <div className="shift-check-calendar">
            {checkResult.days.map((d) => (
              <button
                key={d.date}
                type="button"
                className={`shift-check-cell ${STATUS_CLASS[d.overallStatus]}${
                  selectedDay === d.date ? " selected" : ""
                }`}
                title={d.holidayName ?? undefined}
                onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}
              >
                {Number(d.date.slice(8, 10))}
                {d.holidayName && <div className="shift-check-cell-holiday">祝</div>}
              </button>
            ))}
          </div>

          {dayResult && (
            <ShiftCheckDayDetail
              day={dayResult}
              staff={staff}
              daySchedules={daySchedules}
              assignments={assignments}
              onChanged={handleDayChanged}
            />
          )}

          {checkResult.additionRates.length > 0 && (
            <div className="shift-check-addition-rates">
              <h4>加算充足率</h4>
              <table>
                <thead>
                  <tr>
                    <th>事業所</th>
                    <th>加算</th>
                    <th>充足率</th>
                  </tr>
                </thead>
                <tbody>
                  {checkResult.additionRates.map((r) => (
                    <tr key={`${r.facilityId}_${r.type}`}>
                      <td>{r.facilityName}</td>
                      <td>{ADDITION_TYPE_LABELS[r.type]}</td>
                      <td>
                        {r.percentage ?? "-"}%({r.metDays}/{r.applicableDays}日)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
