import { useState } from "react";
import { api } from "./api";
import {
  EMPLOYMENT_TYPE_LABELS,
  OFF_TYPE_LABELS,
  PERMISSION_LEVEL_LABELS,
  WEEKDAY_LABELS,
  type AvailableStaffCard,
  type FacilityCheckStatus,
  type PlaceShiftAssignmentResult,
  type ShiftAssignment,
  type ShiftCheckDay,
  type Staff,
  type StaffDaySchedule,
} from "./types";

const COLUMN_STATUS_CLASS: Record<FacilityCheckStatus, string> = {
  RED: "shift-check-column-red",
  YELLOW: "shift-check-column-yellow",
  GREEN: "shift-check-column-green",
  CLOSED: "shift-check-column-closed",
  UNCONFIGURED: "shift-check-column-closed",
};

const STATUS_BADGE_LABELS: Record<FacilityCheckStatus, string> = {
  RED: "人数不足",
  YELLOW: "過剰配置",
  GREEN: "適正",
  CLOSED: "休業日",
  UNCONFIGURED: "未設定",
};

// アルバイトの出勤希望充足率がこれを下回りそうな削除操作には注意喚起する(2026-09-12追加)。
const ARBEIT_FULFILLMENT_ALERT_THRESHOLD = 0.7;

type DragPayload = { kind: "existing"; shiftAssignmentId: string } | { kind: "new"; staffId: string };

function buildAvailableStaff(
  day: ShiftCheckDay,
  staff: Staff[],
  daySchedules: StaffDaySchedule[]
): AvailableStaffCard[] {
  const assignedStaffIds = new Set(day.facilities.flatMap((f) => f.assignedStaff.map((s) => s.staffId)));
  const scheduleByStaffId = new Map(
    daySchedules.filter((s) => s.date.slice(0, 10) === day.date).map((s) => [s.staffId, s])
  );

  return staff
    .filter((s) => s.employmentStatus === "ZAISEKI_CHU" && !assignedStaffIds.has(s.id))
    .map((s) => {
      const schedule = scheduleByStaffId.get(s.id);
      return {
        staffId: s.id,
        name: s.name,
        employmentType: s.employmentType,
        permissionLevel: s.permissionLevel,
        canBeChildInstructor: s.canBeChildInstructor,
        hasSevereBehaviorTraining: s.hasSevereBehaviorTraining,
        offType: schedule?.dayType === "OFF" ? schedule.offType : null,
        isLocked: s.isServiceManager,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

// その月の出勤可能日(可・出いずれも)を日付番号の配列で返す(2026-09-12追加)。
function monthAvailableDays(staffId: string, daySchedules: StaffDaySchedule[], monthPrefix: string): number[] {
  return daySchedules
    .filter(
      (s) =>
        s.staffId === staffId &&
        s.date.slice(0, 7) === monthPrefix &&
        s.dayType === "WORK" &&
        s.arbeitStatus != null
    )
    .map((s) => Number(s.date.slice(8, 10)))
    .sort((a, b) => a - b);
}

// 出勤希望日数(その月に可/出のいずれかで登録されている日数)。
function requestedDaysCount(staffId: string, daySchedules: StaffDaySchedule[], monthPrefix: string): number {
  return monthAvailableDays(staffId, daySchedules, monthPrefix).length;
}

// 出勤設定日数(削除保留中を除いた、その月の現在の配置日数)。
function scheduledDaysCount(staffId: string, assignments: ShiftAssignment[], monthPrefix: string): number {
  return assignments.filter(
    (a) => a.staffId === staffId && a.date.slice(0, 7) === monthPrefix && a.status !== "PENDING_REMOVAL"
  ).length;
}

export function ShiftCheckDayDetail({
  day,
  staff,
  daySchedules,
  assignments,
  onChanged,
}: {
  day: ShiftCheckDay;
  staff: Staff[];
  daySchedules: StaffDaySchedule[];
  assignments: ShiftAssignment[];
  onChanged: () => void;
}) {
  const [dragOverFacilityId, setDragOverFacilityId] = useState<string | null>(null);
  const [paletteDragOver, setPaletteDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const availableStaff = buildAvailableStaff(day, staff, daySchedules);
  const hasShortage = day.facilities.some((f) => f.status === "RED");
  const monthPrefix = day.date.slice(0, 7);

  const wouldDropBelowThreshold = (staffId: string) => {
    const requested = requestedDaysCount(staffId, daySchedules, monthPrefix);
    if (requested === 0) return false;
    const scheduled = scheduledDaysCount(staffId, assignments, monthPrefix);
    return (scheduled - 1) / requested < ARBEIT_FULFILLMENT_ALERT_THRESHOLD;
  };

  const moveAssignment = async (shiftAssignmentId: string, facilityId: string) => {
    setBusy(true);
    try {
      // status: "DRAFT" を常に送ることで、削除保留(PENDING_REMOVAL)からの復帰も兼ねる。
      await api.put<ShiftAssignment>(`/shift-assignments/${shiftAssignmentId}`, {
        facilityId,
        status: "DRAFT",
      });
      onChanged();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "配置の変更に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteAssignment = async (shiftAssignmentId: string, staffName: string) => {
    if (!window.confirm(`${staffName}をこの日の配置から削除しますか?`)) return;
    setBusy(true);
    try {
      await api.delete(`/shift-assignments/${shiftAssignmentId}`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  // アルバイトの削除は即時削除せず「削除保留」にする(2026-09-12追加)。
  // 月次の「この内容でシフトを確定する」操作で初めて実際に削除される。
  const requestPendingRemoval = async (shiftAssignmentId: string, staffId: string, staffName: string) => {
    const warning = wouldDropBelowThreshold(staffId)
      ? "\n\n⚠ この職員は出勤希望に対する充足率が70%を下回る可能性があります。"
      : "";
    if (!window.confirm(`${staffName}さんのこの日の出勤を取り消しますか?${warning}`)) return;
    setBusy(true);
    try {
      await api.put(`/shift-assignments/${shiftAssignmentId}`, { status: "PENDING_REMOVAL" });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const reinstateAssignment = async (
    shiftAssignmentId: string,
    facilityId: string,
    staffName: string,
    facilityName: string
  ) => {
    if (!window.confirm(`${staffName}さんを${facilityName}への配置に戻しますか?`)) return;
    await moveAssignment(shiftAssignmentId, facilityId);
  };

  const placeAssignment = async (card: AvailableStaffCard, facilityId: string, facilityName: string) => {
    const confirmMessage = card.offType
      ? `${card.name}さんの${OFF_TYPE_LABELS[card.offType]}を取り消して、${facilityName}に出勤登録しますか?`
      : `${card.name}さんを${facilityName}に配置しますか?`;
    if (!window.confirm(confirmMessage)) return;
    setBusy(true);
    try {
      await api.post<PlaceShiftAssignmentResult>("/shift-assignments/place", {
        staffId: card.staffId,
        date: day.date,
        facilityId,
      });
      onChanged();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "配置に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const closeFacility = async (facilityId: string, facilityName: string) => {
    if (!window.confirm(`${facilityName}をこの日は休業(開所しない)にしますか?`)) return;
    setBusy(true);
    try {
      await api.post("/facility-closures", { facilityId, date: day.date });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const reopenFacility = async (facilityId: string) => {
    setBusy(true);
    try {
      await api.delete(`/facility-closures?facilityId=${facilityId}&date=${day.date}`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent, facilityId: string) => {
    e.preventDefault();
    setDragOverFacilityId(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.kind === "existing") {
      moveAssignment(payload.shiftAssignmentId, facilityId);
    } else {
      const card = availableStaff.find((s) => s.staffId === payload.staffId);
      const facility = day.facilities.find((f) => f.facilityId === facilityId);
      if (card && facility) placeAssignment(card, facilityId, facility.facilityName);
    }
  };

  const handlePaletteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPaletteDragOver(false);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.kind !== "existing") return;
    const assigned = day.facilities
      .flatMap((f) => f.assignedStaff)
      .find((s) => s.shiftAssignmentId === payload.shiftAssignmentId);
    if (!assigned) return;
    if (assigned.employmentType === "ARBEIT_TRANSPORT") {
      requestPendingRemoval(assigned.shiftAssignmentId, assigned.staffId, assigned.staffName);
    } else {
      deleteAssignment(assigned.shiftAssignmentId, assigned.staffName);
    }
  };

  return (
    <div className="shift-check-day-detail">
      <h4>
        {day.date}({WEEKDAY_LABELS[day.weekday]}
        {day.holidayName ? `・${day.holidayName}` : ""})の内訳
      </h4>
      <p className="hint">名前カードは事業所間でドラッグ&ドロップで移動、クリックで削除できます。</p>
      <div className="shift-check-facility-columns">
        {day.facilities.map((f) => (
          <div
            key={f.facilityId}
            className={`shift-check-facility-column ${COLUMN_STATUS_CLASS[f.status]}${
              dragOverFacilityId === f.facilityId ? " drag-over" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverFacilityId(f.facilityId);
            }}
            onDragLeave={() => setDragOverFacilityId((cur) => (cur === f.facilityId ? null : cur))}
            onDrop={(e) => handleDrop(e, f.facilityId)}
          >
            <h5>
              {f.facilityName}
              <span className="shift-check-column-badge">{STATUS_BADGE_LABELS[f.status]}</span>
            </h5>
            <p className="hint">
              必要人数: {f.requiredCount ?? "-"}名 / 配置人数: {f.assignedCount}名
              {f.totalAssignedCount !== f.assignedCount &&
                `(実配置${f.totalAssignedCount}名・サビ管/自発管とアルバイトを除く)`}
            </p>
            <div className="roster-cards">
              {f.assignedStaff.length === 0 && <p className="hint">配置なし</p>}
              {f.assignedStaff.map((s) => {
                const isArbeit = s.employmentType === "ARBEIT_TRANSPORT";
                const availableDays = isArbeit ? monthAvailableDays(s.staffId, daySchedules, monthPrefix) : [];
                return (
                  <div
                    key={s.shiftAssignmentId}
                    className={`staff-card staff-card-button${s.isServiceManager ? " staff-card-locked" : ""}${
                      isArbeit ? " staff-card-arbeit" : ""
                    }`}
                    draggable={!busy && !s.isServiceManager}
                    title={
                      s.isServiceManager
                        ? "サービス管理責任者/児童発達支援管理責任者(サビ管/自発管)は事業所専従のため、他事業所へ移動できません"
                        : undefined
                    }
                    onDragStart={(e) => {
                      if (s.isServiceManager) {
                        e.preventDefault();
                        return;
                      }
                      const payload: DragPayload = { kind: "existing", shiftAssignmentId: s.shiftAssignmentId };
                      e.dataTransfer.setData("text/plain", JSON.stringify(payload));
                    }}
                    onClick={() =>
                      isArbeit
                        ? requestPendingRemoval(s.shiftAssignmentId, s.staffId, s.staffName)
                        : deleteAssignment(s.shiftAssignmentId, s.staffName)
                    }
                  >
                    <div className="staff-card-name">
                      {s.staffName}
                      {s.canBeChildInstructor && <span className="staff-card-badge" title="児童指導員可">児</span>}
                      {s.hasSevereBehaviorTraining && (
                        <span className="staff-card-badge" title="強度行動障害研修修了">行</span>
                      )}
                      {s.isServiceManager && (
                        <span
                          className="staff-card-badge staff-card-badge-warning"
                          title="サービス管理責任者/児童発達支援管理責任者(事業所専従)"
                        >
                          管
                        </span>
                      )}
                    </div>
                    {isArbeit ? (
                      <div className="staff-card-facility">
                        出勤可能日: {availableDays.length > 0 ? availableDays.join("、") : "登録なし"}
                      </div>
                    ) : (
                      s.employmentType && (
                        <div className="staff-card-facility">{EMPLOYMENT_TYPE_LABELS[s.employmentType]}</div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            {f.alerts.length > 0 && (
              <ul className="shift-check-alert-list">
                {f.alerts.map((alert, i) => (
                  <li key={i}>{alert}</li>
                ))}
              </ul>
            )}
            {f.status === "RED" && (
              <button
                type="button"
                className="shift-check-closure-button"
                disabled={busy}
                onClick={() => closeFacility(f.facilityId, f.facilityName)}
              >
                この日は休業にする
              </button>
            )}
            {f.closedReason === "MANUAL" && (
              <div className="shift-check-closure-note">
                <p className="hint">手動で休業に設定されています。</p>
                <button
                  type="button"
                  className="shift-check-closure-button"
                  disabled={busy}
                  onClick={() => reopenFacility(f.facilityId)}
                >
                  休業設定を解除
                </button>
              </div>
            )}
          </div>
        ))}

        {hasShortage && (
          <div
            className={`shift-check-facility-column shift-check-palette-column${
              paletteDragOver ? " drag-over" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setPaletteDragOver(true);
            }}
            onDragLeave={() => setPaletteDragOver(false)}
            onDrop={handlePaletteDrop}
          >
            <h5>配置可能な職員</h5>
            <p className="hint">
              この日まだ配置されていない職員です。ドラッグして不足している事業所へ配置、または事業所のカードをここへドラッグして配置を取り消せます。
            </p>
            <div className="roster-cards">
              {availableStaff.length === 0 && <p className="hint">配置可能な職員がいません</p>}
              {availableStaff.map((s) => (
                <div
                  key={s.staffId}
                  className={`staff-card${s.isLocked ? " staff-card-locked" : ""}`}
                  draggable={!busy && !s.isLocked}
                  title={
                    s.isLocked
                      ? "サービス管理責任者/児童発達支援管理責任者(サビ管/自発管)は事業所専従のため、この画面から配置できません"
                      : undefined
                  }
                  onDragStart={(e) => {
                    if (s.isLocked) {
                      e.preventDefault();
                      return;
                    }
                    const payload: DragPayload = { kind: "new", staffId: s.staffId };
                    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
                  }}
                >
                  <div className="staff-card-name">
                    {s.name}
                    {s.canBeChildInstructor && <span className="staff-card-badge" title="児童指導員可">児</span>}
                    {s.hasSevereBehaviorTraining && (
                      <span className="staff-card-badge" title="強度行動障害研修修了">行</span>
                    )}
                    {s.isLocked && (
                      <span
                        className="staff-card-badge staff-card-badge-warning"
                        title="サービス管理責任者/児童発達支援管理責任者(事業所専従)"
                      >
                        管
                      </span>
                    )}
                  </div>
                  <div className="staff-card-facility">
                    {s.employmentType ? EMPLOYMENT_TYPE_LABELS[s.employmentType] : PERMISSION_LEVEL_LABELS[s.permissionLevel]}
                    {s.offType && ` ・${OFF_TYPE_LABELS[s.offType]}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {day.pendingRemovalStaff.length > 0 && (
        <div className="shift-check-pending-removal">
          <h5>この日の勤務の削除を行ったアルバイト</h5>
          <p className="hint">
            クリックすると元の事業所配置に戻せます。事業所のカードへドラッグして別の事業所に戻すこともできます。
            「この内容でシフトを確定する」を押すと実際に削除されます。
          </p>
          <div className="roster-cards">
            {day.pendingRemovalStaff.map((s) => (
              <div
                key={s.shiftAssignmentId}
                className="staff-card staff-card-arbeit staff-card-pending-removal"
                draggable={!busy}
                onDragStart={(e) => {
                  const payload: DragPayload = { kind: "existing", shiftAssignmentId: s.shiftAssignmentId };
                  e.dataTransfer.setData("text/plain", JSON.stringify(payload));
                }}
                onClick={() =>
                  reinstateAssignment(s.shiftAssignmentId, s.facilityId, s.staffName, s.facilityName)
                }
              >
                <div className="staff-card-name">{s.staffName}</div>
                <div className="staff-card-facility">元: {s.facilityName}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
