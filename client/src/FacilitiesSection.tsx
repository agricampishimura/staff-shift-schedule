import { Fragment, useEffect, useState } from "react";
import { api } from "./api";
import { SERVICE_TYPE_LABELS, type Facility, type ServiceType } from "./types";

type FacilityFormState = {
  name: string;
  serviceType: ServiceType | "";
  openTime: string;
  closeTime: string;
  schoolDayOpenTime: string;
  schoolDayCloseTime: string;
  schoolOffDayOpenTime: string;
  schoolOffDayCloseTime: string;
};

const emptyForm: FacilityFormState = {
  name: "",
  serviceType: "",
  openTime: "",
  closeTime: "",
  schoolDayOpenTime: "",
  schoolDayCloseTime: "",
  schoolOffDayOpenTime: "",
  schoolOffDayCloseTime: "",
};

function toForm(f: Facility): FacilityFormState {
  return {
    name: f.name,
    serviceType: f.serviceType ?? "",
    openTime: f.openTime ?? "",
    closeTime: f.closeTime ?? "",
    schoolDayOpenTime: f.schoolDayOpenTime ?? "",
    schoolDayCloseTime: f.schoolDayCloseTime ?? "",
    schoolOffDayOpenTime: f.schoolOffDayOpenTime ?? "",
    schoolOffDayCloseTime: f.schoolOffDayCloseTime ?? "",
  };
}

function hoursSummary(f: Facility) {
  if (f.serviceType === "AFTER_SCHOOL_DAY_SERVICE") {
    const schoolDay =
      f.schoolDayOpenTime && f.schoolDayCloseTime
        ? `${f.schoolDayOpenTime}〜${f.schoolDayCloseTime}`
        : "-";
    const schoolOff =
      f.schoolOffDayOpenTime && f.schoolOffDayCloseTime
        ? `${f.schoolOffDayOpenTime}〜${f.schoolOffDayCloseTime}`
        : "-";
    return `学校開校日 ${schoolDay} / 学校休校日 ${schoolOff}`;
  }
  if (f.openTime && f.closeTime) return `${f.openTime}〜${f.closeTime}`;
  return "-";
}

function FacilityFormFields({
  form,
  setForm,
}: {
  form: FacilityFormState;
  setForm: (form: FacilityFormState) => void;
}) {
  return (
    <>
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="事業所名"
      />
      <select
        value={form.serviceType}
        onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType | "" })}
      >
        <option value="">サービス内容(なし)</option>
        {Object.entries(SERVICE_TYPE_LABELS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>

      {form.serviceType === "EMPLOYMENT_TYPE_B" && (
        <span className="hours-fieldset">
          通常開所時間:
          <input
            type="time"
            value={form.openTime}
            onChange={(e) => setForm({ ...form, openTime: e.target.value })}
          />
          〜
          <input
            type="time"
            value={form.closeTime}
            onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
          />
        </span>
      )}

      {form.serviceType === "AFTER_SCHOOL_DAY_SERVICE" && (
        <>
          <span className="hours-fieldset">
            学校開校日:
            <input
              type="time"
              value={form.schoolDayOpenTime}
              onChange={(e) => setForm({ ...form, schoolDayOpenTime: e.target.value })}
            />
            〜
            <input
              type="time"
              value={form.schoolDayCloseTime}
              onChange={(e) => setForm({ ...form, schoolDayCloseTime: e.target.value })}
            />
          </span>
          <span className="hours-fieldset">
            学校休校日:
            <input
              type="time"
              value={form.schoolOffDayOpenTime}
              onChange={(e) => setForm({ ...form, schoolOffDayOpenTime: e.target.value })}
            />
            〜
            <input
              type="time"
              value={form.schoolOffDayCloseTime}
              onChange={(e) => setForm({ ...form, schoolOffDayCloseTime: e.target.value })}
            />
          </span>
        </>
      )}
    </>
  );
}

export function FacilitiesSection() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [addForm, setAddForm] = useState<FacilityFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FacilityFormState>(emptyForm);

  const load = () => api.get<Facility[]>("/facilities").then(setFacilities);

  useEffect(() => {
    load();
  }, []);

  const startEdit = (f: Facility) => {
    setEditingId(f.id);
    setEditForm(toForm(f));
  };

  const cancelEdit = () => setEditingId(null);

  const toPayload = (form: FacilityFormState) => ({
    ...form,
    serviceType: form.serviceType || null,
    openTime: form.openTime || null,
    closeTime: form.closeTime || null,
    schoolDayOpenTime: form.schoolDayOpenTime || null,
    schoolDayCloseTime: form.schoolDayCloseTime || null,
    schoolOffDayOpenTime: form.schoolOffDayOpenTime || null,
    schoolOffDayCloseTime: form.schoolOffDayCloseTime || null,
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    await api.post("/facilities", toPayload(addForm));
    setAddForm(emptyForm);
    load();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editForm.name.trim()) return;
    await api.put(`/facilities/${editingId}`, toPayload(editForm));
    setEditingId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/facilities/${id}`);
    if (editingId === id) cancelEdit();
    load();
  };

  return (
    <section>
      <h2>事業所マスタ</h2>
      <form onSubmit={handleAdd} className="inline-form">
        <FacilityFormFields form={addForm} setForm={setAddForm} />
        <button type="submit">追加</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>事業所名</th>
            <th>サービス内容</th>
            <th>通常開所時間</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {facilities.map((f) => (
            <Fragment key={f.id}>
              <tr className={editingId === f.id ? "editing-row" : ""}>
                <td>
                  <button type="button" className="link-button" onClick={() => startEdit(f)}>
                    {f.name}
                  </button>
                </td>
                <td>{f.serviceType ? SERVICE_TYPE_LABELS[f.serviceType] : "-"}</td>
                <td>{hoursSummary(f)}</td>
                <td>
                  <button type="button" onClick={() => startEdit(f)}>
                    編集
                  </button>
                  <button type="button" onClick={() => handleDelete(f.id)}>
                    削除
                  </button>
                </td>
              </tr>
              {editingId === f.id && (
                <tr className="inline-edit-row">
                  <td colSpan={4}>
                    <form onSubmit={handleUpdate} className="inline-form">
                      <FacilityFormFields form={editForm} setForm={setEditForm} />
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
