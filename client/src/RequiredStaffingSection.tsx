import { useEffect, useState } from "react";
import { api } from "./api";
import { WEEKDAY_LABELS, type Facility, type RequiredStaffing } from "./types";

export function RequiredStaffingSection() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [required, setRequired] = useState<RequiredStaffing[]>([]);
  const [weekday, setWeekday] = useState(1);
  const [requiredCount, setRequiredCount] = useState(1);
  const [severeBehaviorAdditionCount, setSevereBehaviorAdditionCount] = useState(0);
  const [severeBehaviorAdditionQualification, setSevereBehaviorAdditionQualification] = useState("");
  const [instructorAdditionCount, setInstructorAdditionCount] = useState(0);
  const [instructorAdditionQualification, setInstructorAdditionQualification] = useState("");

  useEffect(() => {
    api.get<Facility[]>("/facilities").then((fs) => {
      setFacilities(fs);
      if (fs.length > 0) setFacilityId(fs[0].id);
    });
  }, []);

  const load = (fid: string) => {
    if (!fid) return;
    api.get<RequiredStaffing[]>(`/required-staffing?facilityId=${fid}`).then(setRequired);
  };

  useEffect(() => {
    load(facilityId);
  }, [facilityId]);

  const selectedFacility = facilities.find((f) => f.id === facilityId);
  const isDayService = selectedFacility?.serviceType === "AFTER_SCHOOL_DAY_SERVICE";

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;
    await api.post("/required-staffing", {
      facilityId,
      weekday,
      requiredCount,
      severeBehaviorAdditionCount: isDayService ? severeBehaviorAdditionCount : null,
      severeBehaviorAdditionQualification: isDayService ? severeBehaviorAdditionQualification : null,
      instructorAdditionCount: isDayService ? instructorAdditionCount : null,
      instructorAdditionQualification: isDayService ? instructorAdditionQualification : null,
    });
    load(facilityId);
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/required-staffing/${id}`);
    load(facilityId);
  };

  return (
    <section>
      <h2>必要配置人数マスタ</h2>
      <p className="hint">
        曜日ごとの固定人数を設定します。放課後等デイサービスは、基礎の必要配置人数に加えて、児童指導員配置加算・強度行動障害児支援加算をそれぞれ別に登録できます。
      </p>
      <label className="checkbox-label">
        事業所:
        <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {selectedFacility && (
        <span className="hint">定員: {selectedFacility.capacity ?? "未設定"}名</span>
      )}

      <form onSubmit={handleAdd} className="inline-form">
        <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={i} value={i}>
              {label}曜日
            </option>
          ))}
        </select>
        <label className="checkbox-label">
          {isDayService ? "①必要配置人数:" : "必要配置人数:"}
          <input
            type="number"
            min={0}
            value={requiredCount}
            onChange={(e) => setRequiredCount(Number(e.target.value))}
          />
        </label>
        {isDayService && (
          <>
            <fieldset className="addition-fieldset">
              <legend>②児童指導員配置加算を取る場合</legend>
              <label className="checkbox-label">
                追加人数:
                <input
                  type="number"
                  min={0}
                  value={instructorAdditionCount}
                  onChange={(e) => setInstructorAdditionCount(Number(e.target.value))}
                />
              </label>
              <label className="checkbox-label">
                必要資格:
                <input
                  type="text"
                  value={instructorAdditionQualification}
                  onChange={(e) => setInstructorAdditionQualification(e.target.value)}
                  placeholder="例: 児童指導員"
                />
              </label>
            </fieldset>
            <fieldset className="addition-fieldset">
              <legend>③強度行動障害児支援加算を取る場合</legend>
              <label className="checkbox-label">
                追加人数:
                <input
                  type="number"
                  min={0}
                  value={severeBehaviorAdditionCount}
                  onChange={(e) => setSevereBehaviorAdditionCount(Number(e.target.value))}
                />
              </label>
              <label className="checkbox-label">
                必要資格:
                <input
                  type="text"
                  value={severeBehaviorAdditionQualification}
                  onChange={(e) => setSevereBehaviorAdditionQualification(e.target.value)}
                  placeholder="例: 実践研修修了者"
                />
              </label>
            </fieldset>
          </>
        )}
        <button type="submit">設定</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>曜日</th>
            <th>{isDayService ? "①必要配置人数" : "必要配置人数"}</th>
            {isDayService && (
              <>
                <th>②児童指導員配置加算(追加人数/資格)</th>
                <th>③強度行動障害児支援加算(追加人数/資格)</th>
              </>
            )}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {required.map((r) => (
            <tr key={r.id}>
              <td>{WEEKDAY_LABELS[r.weekday]}曜日</td>
              <td>{r.requiredCount}</td>
              {isDayService && (
                <>
                  <td>
                    {r.instructorAdditionCount ?? "-"}
                    {r.instructorAdditionQualification ? ` / ${r.instructorAdditionQualification}` : ""}
                  </td>
                  <td>
                    {r.severeBehaviorAdditionCount ?? "-"}
                    {r.severeBehaviorAdditionQualification ? ` / ${r.severeBehaviorAdditionQualification}` : ""}
                  </td>
                </>
              )}
              <td>
                <button onClick={() => handleDelete(r.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
