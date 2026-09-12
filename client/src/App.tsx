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
        {/* タブ切り替えでアンマウントすると、シフト作成タブ側で進行中の
            勤務表チェック等の状態が失われてしまうため、常にマウントしたまま
            hidden属性で表示/非表示を切り替える(2026-09-12追加)。 */}
        <div hidden={tab !== "shift"}>
          <ShiftAssignmentsSection />
        </div>
        <div hidden={tab !== "master"}>
          <MasterDataView />
        </div>
      </main>
    </div>
  );
}

export default App;
