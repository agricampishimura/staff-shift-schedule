import { useEffect, useState } from "react";
import { api } from "./api";
import { WEEKDAY_LABELS, type Facility, type RequiredStaffing } from "./types";

export function RequiredStaffingSection() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [required, setRequired] = useState<RequiredStaffing[]>([]);
  const [weekday, setWeekday] = useState(1);
  const [requiredCount, setRequiredCount] = useState(1);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;
    await api.post("/required-staffing", { facilityId, weekday, requiredCount });
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
        現時点では曜日ごとの固定人数のみ設定可能。当日の利用人数に応じた変動ルールは今後の検討事項。
      </p>
      <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
        {facilities.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <form onSubmit={handleAdd} className="inline-form">
        <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={i} value={i}>
              {label}曜日
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={requiredCount}
          onChange={(e) => setRequiredCount(Number(e.target.value))}
        />
        <button type="submit">設定</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>曜日</th>
            <th>必要人数</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {required.map((r) => (
            <tr key={r.id}>
              <td>{WEEKDAY_LABELS[r.weekday]}曜日</td>
              <td>{r.requiredCount}</td>
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
