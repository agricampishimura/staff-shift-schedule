import { useState } from "react";
import { FacilitiesSection } from "./FacilitiesSection";
import { RequiredStaffingSection } from "./RequiredStaffingSection";
import { StaffSection } from "./StaffSection";

type MasterTab = "staff" | "facilities" | "required";

const MASTER_TABS: { key: MasterTab; label: string }[] = [
  { key: "staff", label: "職員マスタ" },
  { key: "facilities", label: "事業所マスタ" },
  { key: "required", label: "必要配置人数マスタ" },
];

export function MasterDataView() {
  const [tab, setTab] = useState<MasterTab>("staff");

  return (
    <div>
      <nav className="app-subnav">
        {MASTER_TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "staff" && <StaffSection />}
      {tab === "facilities" && <FacilitiesSection />}
      {tab === "required" && <RequiredStaffingSection />}
    </div>
  );
}
