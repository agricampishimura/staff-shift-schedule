import { useEffect, useState } from "react";
import { api } from "./api";
import {
  DRIVING_CAPACITY_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PERMISSION_LEVEL_LABELS,
  type DrivingCapacityBand,
  type EmploymentStatus,
  type Facility,
  type PermissionLevel,
  type Staff,
  type StaffEmploymentType,
} from "./types";

const emptyForm = {
  name: "",
  permissionLevel: "GENERAL_STAFF" as PermissionLevel,
  employmentType: "" as StaffEmploymentType | "",
  employmentStatus: "ZAISEKI_CHU" as EmploymentStatus,
  drivingCapacityBand: "" as DrivingCapacityBand | "",
  phoneNumber: "",
  email: "",
  primaryFacilityId: "",
};

export function StaffSection() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    api.get<Staff[]>("/staff").then(setStaff);
    api.get<Facility[]>("/facilities").then(setFacilities);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post("/staff", {
      ...form,
      employmentType: form.employmentType || null,
      drivingCapacityBand: form.drivingCapacityBand || null,
      primaryFacilityId: form.primaryFacilityId || null,
    });
    setForm(emptyForm);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/staff/${id}`);
    load();
  };

  return (
    <section>
      <h2>職員マスタ</h2>
      <form onSubmit={handleAdd} className="staff-form">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="氏名"
        />
        <select
          value={form.permissionLevel}
          onChange={(e) =>
            setForm({ ...form, permissionLevel: e.target.value as PermissionLevel })
          }
        >
          {Object.entries(PERMISSION_LEVEL_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={form.employmentType}
          onChange={(e) =>
            setForm({
              ...form,
              employmentType: e.target.value as StaffEmploymentType | "",
            })
          }
        >
          <option value="">職制区分(なし)</option>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={form.employmentStatus}
          onChange={(e) =>
            setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })
          }
        >
          {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={form.drivingCapacityBand}
          onChange={(e) =>
            setForm({
              ...form,
              drivingCapacityBand: e.target.value as DrivingCapacityBand | "",
            })
          }
        >
          <option value="">運転可能量区分(なし)</option>
          {Object.entries(DRIVING_CAPACITY_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={form.primaryFacilityId}
          onChange={(e) => setForm({ ...form, primaryFacilityId: e.target.value })}
        >
          <option value="">主な所属事業所(なし)</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input
          value={form.phoneNumber}
          onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
          placeholder="電話番号"
        />
        <input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="メールアドレス"
        />
        <button type="submit">追加</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>氏名</th>
            <th>権限設定</th>
            <th>職制区分</th>
            <th>在籍ステータス</th>
            <th>運転可能量区分</th>
            <th>主な所属事業所</th>
            <th>電話番号</th>
            <th>メール</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{PERMISSION_LEVEL_LABELS[s.permissionLevel]}</td>
              <td>{s.employmentType ? EMPLOYMENT_TYPE_LABELS[s.employmentType] : "-"}</td>
              <td>{EMPLOYMENT_STATUS_LABELS[s.employmentStatus]}</td>
              <td>{s.drivingCapacityBand ? DRIVING_CAPACITY_LABELS[s.drivingCapacityBand] : "-"}</td>
              <td>{s.primaryFacility?.name ?? "-"}</td>
              <td>{s.phoneNumber ?? "-"}</td>
              <td>{s.email ?? "-"}</td>
              <td>
                <button onClick={() => handleDelete(s.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
