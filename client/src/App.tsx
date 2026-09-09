import { useState } from "react";
import "./App.css";
import { MasterDataView } from "./MasterDataView";
import { ShiftAssignmentsSection } from "./ShiftAssignmentsSection";

type Tab = "shift" | "master";

const TABS: { key: Tab; label: string }[] = [
  { key: "shift", label: "シフト作成" },
  { key: "master", label: "マスタ登録" },
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
        {tab === "master" && <MasterDataView />}
      </main>
    </div>
  );
}

export default App;
