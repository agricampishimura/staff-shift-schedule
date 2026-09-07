import { useState } from "react";
import "./App.css";
import { FacilitiesSection } from "./FacilitiesSection";
import { StaffSection } from "./StaffSection";
import { RequiredStaffingSection } from "./RequiredStaffingSection";
import { ShiftAssignmentsSection } from "./ShiftAssignmentsSection";

type Tab = "shift" | "staff" | "facilities" | "required";

const TABS: { key: Tab; label: string }[] = [
  { key: "shift", label: "シフト作成" },
  { key: "staff", label: "職員マスタ" },
  { key: "facilities", label: "事業所マスタ" },
  { key: "required", label: "必要配置人数マスタ" },
];

function App() {
  const [tab, setTab] = useState<Tab>("shift");

  return (
    <div className="app">
      <header className="app-header">
        <h1>職員シフト作成サポート</h1>
      </header>
      <nav className="app-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="app-main">
        {tab === "shift" && <ShiftAssignmentsSection />}
        {tab === "staff" && <StaffSection />}
        {tab === "facilities" && <FacilitiesSection />}
        {tab === "required" && <RequiredStaffingSection />}
      </main>
    </div>
  );
}

export default App;
