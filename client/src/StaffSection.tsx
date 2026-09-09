import { Fragment, useEffect, useState } from "react";
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

type StaffFormState = {
  name: string;
  permissionLevel: PermissionLevel;
  employmentType: StaffEmploymentType | "";
  employmentStatus: EmploymentStatus;
  drivingCapacityBand: DrivingCapacityBand | "";
  canBeChildInstructor: boolean;
  hasSevereBehaviorTraining: boolean;
  phoneNumber: string;
  email: string;
  primaryFacilityId: string;
};

const emptyForm: StaffFormState = {
  name: "",
  permissionLevel: "GENERAL_STAFF",
  employmentType: "",
  employmentStatus: "ZAISEKI_CHU",
  drivingCapacityBand: "",
  canBeChildInstructor: false,
  hasSevereBehaviorTraining: false,
  phoneNumber: "",
  email: "",
  primaryFacilityId: "",
};

function toForm(s: Staff): StaffFormState {
  return {
    name: s.name,
    permissionLevel: s.permissionLevel,
    employmentType: s.employmentType ?? "",
    employmentStatus: s.employmentStatus,
    drivingCapacityBand: s.drivingCapacityBand ?? "",
    canBeChildInstructor: s.canBeChildInstructor,
    hasSevereBehaviorTraining: s.hasSevereBehaviorTraining,
    phoneNumber: s.phoneNumber ?? "",
    email: s.email ?? "",
    primaryFacilityId: s.primaryFacilityId ?? "",
  };
}

function StaffFormFields({
  form,
  setForm,
  facilities,
}: {
  form: StaffFormState;
  setForm: (form: StaffFormState) => void;
  facilities: Facility[];
}) {
  return (
    <>
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="氏名"
      />
      <select
        value={form.permissionLevel}
        onChange={(e) => setForm({ ...form, permissionLevel: e.target.value as PermissionLevel })}
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
          setForm({ ...form, employmentType: e.target.value as StaffEmploymentType | "" })
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
        onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })}
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
          setForm({ ...form, drivingCapacityBand: e.target.value as DrivingCapacityBand | "" })
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
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={form.canBeChildInstructor}
          onChange={(e) => setForm({ ...form, canBeChildInstructor: e.target.checked })}
        />
        児童指導員配置
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={form.hasSevereBehaviorTraining}
          onChange={(e) => setForm({ ...form, hasSevereBehaviorTraining: e.target.checked })}
        />
        強度行動障害研修
      </label>
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
    </>
  );
}

export function StaffSection() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [addForm, setAddForm] = useState<StaffFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StaffFormState>(emptyForm);

  const load = () => {
    api.get<Staff[]>("/staff").then(setStaff);
    api.get<Facility[]>("/facilities").then(setFacilities);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (s: Staff) => {
    setEditingId(s.id);
    setEditForm(toForm(s));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toPayload = (form: StaffFormState) => ({
    ...form,
    employmentType: form.employmentType || null,
    drivingCapacityBand: form.drivingCapacityBand || null,
    primaryFacilityId: form.primaryFacilityId || null,
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    await api.post("/staff", toPayload(addForm));
    setAddForm(emptyForm);
    load();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editForm.name.trim()) return;
    await api.put(`/staff/${editingId}`, toPayload(editForm));
    setEditingId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/staff/${id}`);
    if (editingId === id) cancelEdit();
    load();
  };

  return (
    <section>
      <h2>職員マスタ</h2>
      <form onSubmit={handleAdd} className="staff-form">
        <StaffFormFields form={addForm} setForm={setAddForm} facilities={facilities} />
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
            <th>児童指導員配置</th>
            <th>強度行動障害研修</th>
            <th>主な所属事業所</th>
            <th>電話番号</th>
            <th>メール</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <Fragment key={s.id}>
              <tr className={editingId === s.id ? "editing-row" : ""}>
                <td>
                  <button type="button" className="link-button" onClick={() => startEdit(s)}>
                    {s.name}
                  </button>
                </td>
                <td>{PERMISSION_LEVEL_LABELS[s.permissionLevel]}</td>
                <td>{s.employmentType ? EMPLOYMENT_TYPE_LABELS[s.employmentType] : "-"}</td>
                <td>{EMPLOYMENT_STATUS_LABELS[s.employmentStatus]}</td>
                <td>
                  {s.drivingCapacityBand ? DRIVING_CAPACITY_LABELS[s.drivingCapacityBand] : "-"}
                </td>
                <td>{s.canBeChildInstructor ? "可" : "不可"}</td>
                <td>{s.hasSevereBehaviorTraining ? "済" : "未"}</td>
                <td>{s.primaryFacility?.name ?? "-"}</td>
                <td>{s.phoneNumber ?? "-"}</td>
                <td>{s.email ?? "-"}</td>
                <td>
                  <button type="button" onClick={() => startEdit(s)}>
                    編集
                  </button>
                  <button type="button" onClick={() => handleDelete(s.id)}>
                    削除
                  </button>
                </td>
              </tr>
              {editingId === s.id && (
                <tr className="inline-edit-row">
                  <td colSpan={11}>
                    <form onSubmit={handleUpdate} className="staff-form">
                      <StaffFormFields form={editForm} setForm={setEditForm} facilities={facilities} />
                      <button type="submit">更新</button>
                      <button type="button" onClick={cancelEdit}>
                        キャンセル
                      </button>
                    </form>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}
