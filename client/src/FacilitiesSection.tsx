import { useEffect, useState } from "react";
import { api } from "./api";
import type { Facility } from "./types";

export function FacilitiesSection() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [name, setName] = useState("");

  const load = () => api.get<Facility[]>("/facilities").then(setFacilities);

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/facilities", { name });
    setName("");
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/facilities/${id}`);
    load();
  };

  return (
    <section>
      <h2>事業所マスタ</h2>
      <form onSubmit={handleAdd} className="inline-form">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="事業所名"
        />
        <button type="submit">追加</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>事業所名</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {facilities.map((f) => (
            <tr key={f.id}>
              <td>{f.name}</td>
              <td>
                <button onClick={() => handleDelete(f.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
