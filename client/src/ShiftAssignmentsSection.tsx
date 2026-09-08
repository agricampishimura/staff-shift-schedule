import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Facility, ShiftAssignment, Staff } from "./types";

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

const FULL_TIME_TYPES = ["FULL_TIME_40H", "FULL_TIME_32H"];
const PART_TIME_TYPES = ["PART_TIME_WELFARE", "PART_TIME_DRIVER"];
const ARBEIT_TYPES = ["ARBEIT_TRANSPORT"];

function StaffCard({ staff }: { staff: Staff }) {
  return (
    <div className="staff-card">
      <div className="staff-card-name">{staff.name}</div>
      {staff.primaryFacility && (
        <div className="staff-card-facility">{staff.primaryFacility.name}</div>
      )}
    </div>
  );
}

function RosterColumn({ title, staff }: { title: string; staff: Staff[] }) {
  return (
    <div className="roster-column">
      <h3>
        {title}
        <span className="roster-count">{staff.length}名</span>
      </h3>
      <div className="roster-cards">
        {staff.length === 0 && <p className="hint">対象職員なし</p>}
        {staff.map((s) => (
          <StaffCard key={s.id} staff={s} />
        ))}
      </div>
    </div>
  );
}

export function ShiftAssignmentsSection() {
  const { options: monthOptions, defaultValue: defaultMonth } = useMonthOptions();
  const [month, setMonth] = useState(defaultMonth);
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

  return (
    <section>
      <h2>シフト作成</h2>
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

      <div className="staff-roster">
        <RosterColumn title="正社員(短時間正社員含む)" staff={fullTimeStaff} />
        <RosterColumn title="パート" staff={partTimeStaff} />
        <RosterColumn title="アルバイト" staff={arbeitStaff} />
      </div>

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
