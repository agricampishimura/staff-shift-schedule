import { useEffect, useState } from "react";
import { api } from "./api";
import type { Facility, ShiftAssignment, Staff } from "./types";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ShiftAssignmentsSection() {
  const [month, setMonth] = useState(currentMonth());
  const [staff, setStaff] = useState<Staff[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);

  const [form, setForm] = useState({
    date: "",
    staffId: "",
    facilityId: "",
    startTime: "09:00",
    endTime: "18:00",
  });

  useEffect(() => {
    api.get<Staff[]>("/staff").then(setStaff);
    api.get<Facility[]>("/facilities").then(setFacilities);
  }, []);

  const load = () => api.get<ShiftAssignment[]>(`/shift-assignments?month=${month}`).then(setAssignments);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.staffId || !form.facilityId) return;
    await api.post("/shift-assignments", { ...form, status: "DRAFT" });
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/shift-assignments/${id}`);
    load();
  };

  const handleConfirm = async (a: ShiftAssignment) => {
    await api.put(`/shift-assignments/${a.id}`, {
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.status === "CONFIRMED" ? "DRAFT" : "CONFIRMED",
      note: a.note,
    });
    load();
  };

  return (
    <section>
      <h2>シフト作成</h2>
      <label>
        対象月:{" "}
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </label>

      <form onSubmit={handleAdd} className="staff-form">
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <select
          value={form.staffId}
          onChange={(e) => setForm({ ...form, staffId: e.target.value })}
        >
          <option value="">職員を選択</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={form.facilityId}
          onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
        >
          <option value="">事業所を選択</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
        />
        <input
          type="time"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
        />
        <button type="submit">割当を追加</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>職員</th>
            <th>事業所</th>
            <th>時間</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id}>
              <td>{a.date.slice(0, 10)}</td>
              <td>{a.staff?.name}</td>
              <td>{a.facility?.name}</td>
              <td>
                {a.startTime}〜{a.endTime}
              </td>
              <td>{a.status === "CONFIRMED" ? "確定" : "下書き"}</td>
              <td>
                <button onClick={() => handleConfirm(a)}>
                  {a.status === "CONFIRMED" ? "下書きに戻す" : "確定"}
                </button>
                <button onClick={() => handleDelete(a.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
