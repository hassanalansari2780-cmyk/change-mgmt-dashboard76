"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Search, Paperclip, ExternalLink } from "lucide-react";

// ==========================================
// Types
// ==========================================
export type StageKey =
  | "PRC"
  | "CC_OUTCOME"
  | "CEO_OR_BOARD_MEMO"
  | "EI"
  | "CO_V_VOS"
  | "AA_SA";

export type PackageId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "I2" | "PMEC";

export type PcrTarget = "EI" | "CO" | "EI+CO" | "TBD";

interface Reviewer {
  role: string;
  name: string;
  date?: string;
  decision?: string;
}

interface Signer {
  role: string;
  name: string;
  date?: string;
  signed?: boolean;
}

interface LinkItem {
  label: string;
  href: string;
}

export interface ChangeRecord {
  id: string; // CO / PRC ID
  type: "PRC" | "EI" | "CO" | "Determination";
  package: PackageId;
  title: string;
  estimated?: number; // AED
  actual?: number; // AED
  stageKey: StageKey; // must match STAGES keys exactly
  subStatus?: string; // one of STAGE_OPTIONS[stageKey]
  stageStartDate: string; // ISO date string
  overallStartDate: string; // ISO
  outcome?: "Approved" | "Rejected" | "Withdrawn" | "Superseded";
  target?: "EI" | "CO" | "TBC"; // PCR target (if type = PRC)
  sponsor?: string; // Change sponsor
  reviewList?: Reviewer[];
  signatureList?: Signer[];
  links?: LinkItem[];
  prcTarget?: PcrTarget; // For PCRs: intended path (EI or CO)
}

// ==========================================
// Lifecycle & options
// ==========================================
const STAGES: {
  order: number;
  key: StageKey;
  name: string;
  short: string;
  slaDays: number;
  color: string;
}[] = [
  {
    order: 1,
    key: "PRC",
    name: "PRC",
    short: "PRC",
    slaDays: 5,
    color: "bg-sky-100 text-sky-900",
  },
  {
    order: 2,
    key: "CC_OUTCOME",
    name: "CC Outcome",
    short: "CC",
    slaDays: 3,
    color: "bg-indigo-100 text-indigo-900",
  },
  {
    order: 3,
    key: "CEO_OR_BOARD_MEMO",
    name: "CEO / Board Memo",
    short: "CEO/Board",
    slaDays: 2,
    color: "bg-purple-100 text-purple-900",
  },
  {
    order: 4,
    key: "EI",
    name: "EI",
    short: "EI",
    slaDays: 2,
    color: "bg-amber-100 text-amber-900",
  },
  {
    order: 5,
    key: "CO_V_VOS",
    name: "CO/V/VOS",
    short: "CO/V/VOS",
    slaDays: 7,
    color: "bg-emerald-100 text-emerald-900",
  },
  {
    order: 6,
    key: "AA_SA",
    name: "AA/SA",
    short: "AA/SA",
    slaDays: 0,
    color: "bg-gray-200 text-gray-900",
  },
];

const STAGE_OPTIONS: Record<StageKey, string[]> = {
  PRC: [
    "In Preparation",
    "Under Review",
    "Ready for CC",
    "To be Resubmitted",
    "Presented at CC",
    "To be Revised",
    "Circuled by Post CC Email",
    "Updated PCR in Preparation",
  ],
  CC_OUTCOME: [
    "Approved",
    "Approved with Conditions",
    "To be Re-Submitted",
    "Rejected",
    "On Hold/Others",
  ],
  CEO_OR_BOARD_MEMO: [
    "Determination in Circulation",
    "In Draft",
    "In Circulation",
    "In Approval",
    "Approved",
    "Rejected",
  ],
  EI: [
    "To be Prepared",
    "In Preparation",
    "Under Review",
    "Ready",
    "In Circulation",
    "In Approval",
    "Issued",
    "To be Issued to Contractor",
  ],
  CO_V_VOS: ["NA", "Done"],
  AA_SA: ["NA", "Done"],
};

const fmt = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});
const fmtShort = new Intl.NumberFormat("en-US");
const FINAL_KEY: StageKey = "AA_SA";

// ==========================================
// Utils
// ==========================================
function daysBetween(startIso?: string, endIso?: string) {
  if (!startIso) return 0;
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const diff = Math.round(
    (end.getTime() - start.getTime()) / (24 * 3600 * 1000),
  );
  return Math.max(diff, 0);
}

function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function stageInfo(key: StageKey) {
  const s = STAGES.find((x) => x.key === key);
  if (!s) {
    console.error(`Stage not found for key: ${key}`);
    return {
      order: 0,
      key,
      name: String(key),
      short: String(key),
      slaDays: 0,
      color: "bg-gray-200 text-gray-900",
    } as any;
  }
  return s;
}

function progressPct(key: StageKey) {
  const s = stageInfo(key);
  return Math.round((s.order / STAGES[STAGES.length - 1].order) * 100);
}

function variance(estimated?: number, actual?: number) {
  if (typeof estimated !== "number" || typeof actual !== "number") return null;
  return actual - estimated;
}

function stageTextClass(color: string) {
  const parts = color.split(" ");
  const text = parts.find((p) => p.startsWith("text-"));
  return text || "text-gray-900";
}

function issuedItemLabel(r: ChangeRecord): string {
  if (r.stageKey === "EI" || r.type === "EI") return "EI";
  if (r.stageKey === "CO_V_VOS") return "CO / V / VOS";
  if (r.stageKey === "AA_SA") return "AA / SA";
  if (r.type === "Determination") return "Determination";
  if (r.type === "CO") return "CO";
  return r.type;
}

// ==========================================
// Demo data (more examples for all 3 tables)
// ==========================================

const DEMO: ChangeRecord[] = [
  // --- PCRs → EI ---
  {
    id: "PCR-A-013",
    type: "PRC",
    package: "A",
    title: "Relocation of Fire Hydrant (PCR)",
    estimated: 350000,
    stageKey: "PRC",
    subStatus: "Under Review",
    stageStartDate: "2026-01-05",
    overallStartDate: "2026-01-05",
    target: "EI",
    sponsor: "Pkg A PM – Eng. Nasser Al-Rawahi",
    reviewList: [
      {
        role: "PMEC (Engineer)",
        name: "Mohammed Al-Busaidi",
        decision: "Reviewing",
        date: "2026-01-05",
      },
    ],
    links: [
      {
        label: "PCR Form (PDF)",
        href: "https://example.com/pcr/PCR-A-013.pdf",
      },
      {
        label: "Sketch – Hydrant Relocation",
        href: "https://example.com/drawings/HYD-REL-013.pdf",
      },
    ],
  },
  {
    id: "PCR-C-021",
    type: "PRC",
    package: "C",
    title: "Drainage Rerouting at Station C-05 (PCR)",
    estimated: 1200000,
    stageKey: "PRC",
    subStatus: "Ready for CC",
    stageStartDate: "2026-01-18",
    overallStartDate: "2026-01-10",
    target: "EI",
    sponsor: "Pkg C PM – Eng. Khalid Al-Harthy",
    reviewList: [
      {
        role: "Contracts Specialist",
        name: "Hassan Al-Ansari",
        decision: "Draft reviewed",
        date: "2026-01-17",
      },
      {
        role: "Finance",
        name: "Sara Al-Said",
        decision: "Budget checked",
        date: "2026-01-17",
      },
    ],
  },

  // --- PCRs → CO / V / VOS / AA-SA ---
  {
    id: "PCR-A-018",
    type: "PRC",
    package: "A",
    title: "Handrail Height Adjustment (PCR)",
    estimated: 650000,
    actual: 700000, // example – change to your real value
    stageKey: "PRC",
    subStatus: "In Preparation",
    stageStartDate: "2026-01-12",
    overallStartDate: "2026-01-12",
    target: "CO",
    sponsor: "HSSE Manager – Eng. Salim Al-Harthy",
    reviewList: [
      {
        role: "Contracts Engineer",
        name: "John Mathew",
        decision: "Draft prepared",
      },
      {
        role: "Finance",
        name: "Ahmed Al-Lawati",
        decision: "Budget confirmed",
      },
    ],
    signatureList: [
      {
        role: "PM (Pkg Owner)",
        name: "Eng. Nasser Al-Rawahi",
        signed: true,
        date: "2026-01-13",
      },
      {
        role: "Finance Controller",
        name: "Sara Al-Said",
        signed: true,
        date: "2026-01-13",
      },
      { role: "CEO", name: "Ahmed Al-Habsi", signed: false },
    ],
    links: [
      {
        label: "CEO/Board Memo (PDF)",
        href: "https://example.com/memos/CO-A-019.pdf",
      },
    ],
  },
  {
    id: "PCR-B-009",
    type: "PRC",
    package: "B",
    title: "Additional Cross Drain at Km 14+200 (PCR)",
    estimated: 950000,
    actual: 900000, // example – change as needed
    stageKey: "PRC",
    subStatus: "Presented at CC",
    stageStartDate: "2026-01-20",
    overallStartDate: "2026-01-15",
    target: "CO",
    sponsor: "Pkg B PM – Eng. Rashid Al-Siyabi",
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        decision: "Support in principle",
        date: "2026-01-18",
      },
    ],
  },

  // --- EI in progress / issued ---
  {
    id: "EI-A-004",
    type: "EI",
    package: "A",
    title: "Relocation of Fire Hydrant (EI)",
    estimated: 0,
    stageKey: "EI",
    subStatus: "In Preparation",
    stageStartDate: "2026-01-14",
    overallStartDate: "2026-01-14",
    sponsor: "Pkg A PM – Eng. Nasser Al-Rawahi",
    reviewList: [
      {
        role: "PMEC",
        name: "Mohammed Al-Busaidi",
        decision: "EI wording prepared",
      },
      {
        role: "Contracts Specialist",
        name: "Hassan Al-Ansari",
        decision: "Reviewed commercial impact",
      },
    ],
  },
  {
    id: "EI-B-007",
    type: "EI",
    package: "B",
    title: "Signal Relocation near Sohar Link (EI)",
    estimated: 0,
    stageKey: "EI",
    subStatus: "Issued",
    stageStartDate: "2025-08-10",
    overallStartDate: "2025-07-25",
    sponsor: "Pkg B PM – Eng. Rashid Al-Siyabi",
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        decision: "EI issued to Contractor",
        date: "2025-08-10",
      },
    ],
  },

  // --- Completed CO / V / VOS / AA-SA ---
  {
    id: "CO-G-032",
    type: "CO",
    package: "G",
    title: "Ballast Spec Update (Final)",
    estimated: 2000000,
    actual: 1850000,
    outcome: "Approved",
    stageKey: "AA_SA",
    subStatus: "Done",
    stageStartDate: "2025-07-22",
    overallStartDate: "2025-07-01",
    sponsor: "Track Engineering Manager",
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        date: "2025-07-15",
        decision: "Approved",
      },
    ],
    signatureList: [
      {
        role: "CEO",
        name: "Ahmed Al-Habsi",
        date: "2025-07-20",
        signed: true,
      },
      {
        role: "Employer",
        name: "HRL Legal",
        date: "2025-07-21",
        signed: true,
      },
      {
        role: "Contractor",
        name: "Supplier",
        date: "2025-07-21",
        signed: true,
      },
    ],
  },
  {
    id: "CO-D-014",
    type: "CO",
    package: "D",
    title: "Platform Canopy Extension (Final)",
    estimated: 500000,
    actual: 520000,
    outcome: "Approved",
    stageKey: "CO_V_VOS",
    subStatus: "Done",
    stageStartDate: "2025-06-10",
    overallStartDate: "2025-05-20",
    sponsor: "Pkg D PM – Eng. Younis Al-Maamari",
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        date: "2025-06-05",
        decision: "Approved with conditions",
      },
    ],
    signatureList: [
      {
        role: "CEO",
        name: "Ahmed Al-Habsi",
        date: "2025-06-08",
        signed: true,
      },
    ],
  },
];

// ==========================================
// CSV helpers
// ==========================================
function buildCSV(rows: ChangeRecord[]): string {
  const headers = [
    "ID",
    "Type",
    "Package",
    "Title",
    "Estimated",
    "Actual",
    "Variance",
    "Stage",
    "SubStatus",
    "PRCTarget",
    "Sponsor",
    "DaysInStage",
    "OverallDays",
  ];

  const body = rows.map((r) => {
    const st = stageInfo(r.stageKey);
    const vr = variance(r.estimated, r.actual);
    const safeTitle = '"' + r.title.replaceAll('"', '""') + '"';

    return [
      r.id,
      r.type,
      r.package,
      safeTitle,
      r.estimated ?? "",
      r.actual ?? "",
      vr ?? "",
      st.name,
      r.subStatus ?? "",
      r.prcTarget ?? "",
      r.sponsor ?? "",
      daysBetween(r.stageStartDate),
      daysBetween(r.overallStartDate),
    ].join(",");
  });

  return [headers.join(","), ...body].join("\n");
}

function exportCSV(rows: ChangeRecord[]) {
  const csv = buildCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `change-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================
// Summary card
// ==========================================
function computeSummary(rows: ChangeRecord[]) {
  const total = rows.length;

  const pcrs = rows.filter((r) => r.type === "PRC");
  const pcrToEI = pcrs.filter((r) => r.target === "EI").length;
  const pcrToCO = pcrs.filter((r) => r.target === "CO").length;

  // Completed = EI (Issued / To be Issued) OR CO/V/VOS (Done) OR AA/SA (Done)
  const completed = rows.filter((r) => {
    const isEICompleted =
      r.stageKey === "EI" &&
      (r.subStatus === "Issued" ||
        r.subStatus === "To be Issued to Contractor");
    const isCOOrAACompleted =
      (r.stageKey === "CO_V_VOS" && r.subStatus === "Done") ||
      (r.stageKey === "AA_SA" && r.subStatus === "Done");
    return isEICompleted || isCOOrAACompleted;
  }).length;

  return { total, pcrToEI, pcrToCO, completed };
}

function SummaryCard({ rows }: { rows: ChangeRecord[] }) {
  const s = useMemo(() => computeSummary(rows), [rows]);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">Change Items</div>
        <div className="text-4xl font-semibold mt-1">
          {fmtShort.format(s.total)}
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>PCR → EI</span>
            <span>{s.pcrToEI}</span>
          </div>
          <div className="flex justify-between">
            <span>PCR → CO</span>
            <span>{s.pcrToCO}</span>
          </div>
          <div className="flex justify-between">
            <span>Completed (EI / CO/V/VOS / AA/SA)</span>
            <span>{s.completed}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// Project KPIs row
// ==========================================
function ProjectKPIs({ rows }: { rows: ChangeRecord[] }) {
  const TOTAL_PROJECT_VALUE = 500_000_000; // demo: AED 500M

  const k = useMemo(() => {
    const totalCOValue = rows.reduce(
      (sum, r) => sum + (r.estimated ?? 0),
      0,
    );

    const approvedRows = rows.filter(
      (r) => r.outcome === "Approved" && typeof r.actual === "number",
    );

    const totalApprovedValue = approvedRows.reduce(
      (sum, r) => sum + (r.actual ?? 0),
      0,
    );

    const changePercentage = TOTAL_PROJECT_VALUE
      ? ((totalCOValue / TOTAL_PROJECT_VALUE) * 100).toFixed(2)
      : "0.00";

    return {
      totalProjectValue: TOTAL_PROJECT_VALUE,
      totalCOValue,
      totalApprovedValue,
      changePercentage,
    };
  }, [rows]);

  // --- Details pop-ups ---
  const handleTotalProjectDetails = () => {
    alert(
      "Total Project Value = the baseline Contract Price for the project (configured as a static figure in the dashboard).",
    );
  };

  const handleTotalChangeDetails = () => {
    alert(
      "Total Change Order Value = sum of the ESTIMATED values for all changes currently visible after filters.",
    );
  };

  const handleApprovedChangeDetails = () => {
    alert(
      "Total Approved Change Value = sum of the ACTUAL values for all changes with outcome = Approved and an Actual value.",
    );
  };

  const handleChangePercentDetails = () => {
    alert(
      "Change % of Project = Total Change Order Value ÷ Total Project Value × 100 (based on the visible items).",
    );
  };

  // --- Single KPI card ---
  const Item = ({
    label,
    value,
    onDetails,
  }: {
    label: string;
    value: string;
    onDetails?: () => void;
  }) => (
    <Card className="rounded-2xl shadow-sm h-[180px]">
      <CardContent className="p-4 h-full flex flex-col justify-between">
        {/* Title + Value */}
        <div className="flex flex-col space-y-1">
          <div className="text-sm text-muted-foreground leading-none">
            {label}
          </div>

          <div className="text-xl font-semibold leading-tight whitespace-nowrap">
            {value}
          </div>
        </div>

        {/* Details Button */}
        {onDetails && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-2xl px-3 py-1 text-xs self-start"
            onClick={onDetails}
          >
            Details
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-stretch">
      <Item
        label="Total Project Value"
        value={fmt.format(k.totalProjectValue)}
        onDetails={handleTotalProjectDetails}
      />
      <Item
        label="Total Change Order Value"
        value={fmt.format(k.totalCOValue)}
        onDetails={handleTotalChangeDetails}
      />
      <Item
        label="Total Approved Change Value"
        value={fmt.format(k.totalApprovedValue)}
        onDetails={handleApprovedChangeDetails}
      />
      <Item
        label="Change % of Project"
        value={`${k.changePercentage}%`}
        onDetails={handleChangePercentDetails}
      />
    </div>
  );
}

// ==========================================
// Stage timeline filter component (kept for reuse)
// ==========================================
function StageTimeline({
  active,
  onClickStage,
}: {
  active?: StageKey | "All";
  onClickStage?: (s: StageKey | "All") => void;
}) {
  const activeIdx =
    active && active !== "All"
      ? STAGES.findIndex((x) => x.key === active)
      : -1;

  return (
    <div className="w-full flex justify-center py-2">
      <div className="flex items-center gap-4 overflow-x-auto px-1 max-w-full">
        {STAGES.map((s, i) => {
          const isActive = active && active !== "All" && s.key === active;
          const isDone = activeIdx >= 0 && i <= activeIdx;
          const connDone = activeIdx >= 0 && i < activeIdx;
          const tip = `${s.name} — SLA ${s.slaDays} days`;
          const handle = () =>
            onClickStage && onClickStage(isActive ? "All" : s.key);

          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                title={tip}
                className={clsx(
                  "w-2.5 h-2.5 rounded-full",
                  isDone ? "bg-emerald-600" : "bg-muted-foreground/30",
                )}
              />

              <button
                type="button"
                onClick={handle}
                title={tip}
                className={clsx(
                  "px-3 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition shadow-sm",
                  s.color,
                  isActive && "ring-2 ring-offset-2 ring-gray-900",
                )}
              >
                {s.name}
              </button>

              {i < STAGES.length - 1 && (
                <div
                  className={clsx(
                    "w-24 h-0.5 hidden md:block",
                    connDone ? "bg-emerald-600" : "bg-muted",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// Path timeline (for each table section)
// ==========================================
type PathTimelineProps = {
  label: string;
  stages: string[];
};

function PathTimeline({ label, stages }: PathTimelineProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 pt-4 pb-2 gap-2">
      <div className="text-sm font-semibold text-neutral-800">{label}</div>
      <div className="flex items-center gap-2 text-[11px] text-neutral-700 flex-wrap">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-900 font-medium">
              {s}
            </span>
            {i < stages.length - 1 && (
              <span className="text-neutral-300 text-base leading-none">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Common table header (with optional middle column)
// ==========================================
function ChangeTableHeader({
  showMiddleColumn,
  middleLabel,
}: {
  showMiddleColumn: boolean;
  middleLabel?: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold text-neutral-500 bg-white border-y">
      <div className="col-span-1">Ref ID</div>
      <div className="col-span-1">Package</div>
      <div className="col-span-2">Title</div>
      <div className="col-span-2">Stage</div>
      <div
        className={clsx(
          "col-span-1",
          !showMiddleColumn && "hidden",
        )}
      >
        {middleLabel ?? ""}
      </div>
      <div className="col-span-2">Sponsor</div>
      <div className="col-span-1 text-right">Estimated</div>
      <div className="col-span-1 text-right">Actual</div>
      <div className="col-span-1 text-right">Variance</div>
    </div>
  );
}

// ==========================================
// Package chips
// ==========================================
const PKG_COLORS: Record<PackageId, string> = {
  A: "bg-blue-500",
  B: "bg-teal-600",
  C: "bg-orange-500",
  D: "bg-rose-600",
  E: "bg-gray-500",
  F: "bg-violet-600",
  G: "bg-emerald-600",
  I2: "bg-orange-700",
  PMEC: "bg-violet-700",
};

function PackageChips({
  selected,
  onSelect,
}: {
  selected: PackageId | "All";
  onSelect: (p: PackageId | "All") => void;
}) {
  const items: PackageId[] = ["A", "B", "C", "D", "E", "F", "G", "I2", "PMEC"];

  return (
    <div className="flex items-center gap-3 justify-between rounded-2xl border p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-foreground/80 mr-1">Packages:</span>
        {items.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            className={clsx(
              "w-9 h-9 rounded-full text-white text-[11px] font-semibold grid place-items-center",
              PKG_COLORS[p],
              selected === p
                ? "ring-2 ring-offset-2 ring-gray-900"
                : "opacity-90 hover:opacity-100",
            )}
            title={`Package ${p}`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="text-sm underline-offset-2 hover:underline"
          onClick={() => onSelect("All")}
        >
          All
        </button>
        <button
          type="button"
          className="text-sm underline-offset-2 hover:underline"
          onClick={() => onSelect("All")}
        >
          None
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Filters
// ==========================================
function Filters({
  q,
  setQ,
  onExport,
}: {
  q: string;
  setQ: (s: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID / title / sponsor"
            className="pl-8 rounded-2xl min-w-[220px]"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onExport} className="rounded-2xl" variant="secondary">
          Export CSV
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// Row + details
// ==========================================
type RowMode = "pcr" | "completed";

function Row({
  r,
  showMiddleColumn,
  mode,
}: {
  r: ChangeRecord;
  showMiddleColumn: boolean;
  mode: RowMode;
}) {
  const s = stageInfo(r.stageKey);
  const days = daysBetween(r.stageStartDate);
  const [open, setOpen] = useState(false);

  const hasDocs = (r.links?.length ?? 0) > 0;

  const varianceValue =
    typeof r.estimated === "number" && typeof r.actual === "number"
      ? r.actual - r.estimated
      : null;

  const showReview = !!(r.reviewList && r.reviewList.length);
  const showSignatures = !!(r.signatureList && r.signatureList.length);

  const isEICompleted =
    r.stageKey === "EI" &&
    (r.subStatus === "Issued" ||
      r.subStatus === "To be Issued to Contractor");
  const isCOOrAACompleted =
    (r.stageKey === "AA_SA" || r.stageKey === "CO_V_VOS") &&
    r.subStatus === "Done";

  const showClosedSummary = isEICompleted || isCOOrAACompleted;

  return (
    <div className="border-b last:border-b-0 bg-white">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 items-start">
        {/* Ref ID + documents (col 1) */}
        <div className="col-span-1">
          <div className="text-sm font-medium">{r.id}</div>
          {hasDocs && (
            <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
              {r.links!.map((lnk, i) => (
                <a
                  key={i}
                  href={lnk.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="truncate">{lnk.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Package (col 2) */}
        <div className="col-span-1">
          <div className="w-8 h-8 rounded-full bg-muted grid place-items-center text-sm font-semibold">
            {r.package}
          </div>
        </div>

        {/* Title (col 3–4) – multi-line, forced wrap */}
        <div className="col-span-2">
          <div className="text-sm leading-snug break-words max-w-xs">
            {r.title}
          </div>
        </div>

        {/* Stage (col 5–6) */}
        <div className="col-span-2">
          <div className="inline-flex items-center gap-2 mb-1">
            <span
              className={clsx(
                "px-2 py-1 rounded-2xl text-xs font-semibold",
                s.color,
              )}
            >
              {s.name}
            </span>
            {r.subStatus && (
              <Badge className="rounded-2xl bg-neutral-100 text-neutral-900 border">
                {r.subStatus}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Day {days} / SLA {s.slaDays}
          </div>

          {/* Details button ONLY for PCR tables (1 & 2) */}
          {mode === "pcr" && (
            <div className="mt-2">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-2xl px-3 py-1 text-xs"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "Hide details" : "Details"}
              </Button>
            </div>
          )}
        </div>

        {/* Middle column: hidden for tables 1 & 2, "Issued Item" for table 3 */}
        <div
          className={clsx(
            "col-span-1",
            !showMiddleColumn && "hidden",
          )}
        >
          {showMiddleColumn && mode === "completed" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 text-xs font-medium">
              {issuedItemLabel(r)}
            </span>
          )}
        </div>

        {/* Sponsor (col 8–9) – multi-line, forced wrap */}
        <div className="col-span-2 text-sm leading-snug break-words max-w-xs">
          {r.sponsor ?? "—"}
        </div>

        {/* Estimated (col 10) */}
        <div className="col-span-1 text-right">
          <div className="text-sm tabular-nums">
            {typeof r.estimated === "number" ? fmt.format(r.estimated) : "—"}
          </div>
        </div>

        {/* Actual (col 11) */}
        <div className="col-span-1 text-right">
          <div className="text-sm tabular-nums">
            {typeof r.actual === "number" ? fmt.format(r.actual) : "—"}
          </div>
        </div>

        {/* Variance (col 12) */}
        <div className="col-span-1 text-right">
          <div className="text-sm tabular-nums">
            {varianceValue === null
              ? "—"
              : `${varianceValue > 0 ? "+" : varianceValue < 0 ? "-" : ""}${fmt.format(
                  Math.abs(varianceValue),
                )}`}
          </div>
        </div>
      </div>

      {/* Expanded details – ONLY for PCR (tables 1 & 2) */}
      {mode === "pcr" && open && (
        <div className="px-6 pb-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1) Stage progress breakdown */}
            <Card className="rounded-2xl md:order-1">
              <CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">
                  Stage Progress —{" "}
                  <span className={stageTextClass(s.color)}>{s.name}</span>
                </div>
                {(() => {
                  const opts = STAGE_OPTIONS[r.stageKey];
                  const currentIdx = Math.max(
                    0,
                    opts.findIndex((o) => o === (r.subStatus ?? "")),
                  );
                  return (
                    <div className="space-y-4">
                      {opts.map((opt, idx) => {
                        const isCurrent = idx === currentIdx;
                        const isCompleted = idx < currentIdx;
                        const isFuture = idx > currentIdx;
                        return (
                          <div key={opt} className="flex items-start gap-3">
                            <div
                              className={clsx(
                                "w-4 h-4 rounded-full border mt-1",
                                isCurrent &&
                                  "bg-emerald-600 border-emerald-600",
                                isCompleted &&
                                  !isCurrent &&
                                  "bg-emerald-50 border-emerald-600",
                                isFuture &&
                                  "bg-white border-muted-foreground",
                              )}
                            />
                            <div>
                              <div
                                className={clsx(
                                  "text-sm",
                                  isCurrent
                                    ? "text-emerald-700 font-medium"
                                    : isCompleted
                                    ? "text-emerald-700"
                                    : "text-foreground",
                                )}
                              >
                                {opt}
                              </div>
                              {isCurrent && (
                                <div className="text-xs text-emerald-700">
                                  Current
                                </div>
                              )}
                              {isCompleted && (
                                <div className="text-xs text-emerald-700">
                                  Completed
                                </div>
                              )}
                              {isFuture && (
                                <div className="text-xs text-muted-foreground">
                                  Incomplete
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* 2) Review list */}
            <Card className="rounded-2xl md:order-2">
              <CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">Review List</div>
                <div className="space-y-2 text-sm">
                  {(showReview
                    ? r.reviewList!
                    : [{ role: "—", name: "No reviewers", decision: "" }]
                  ).map((rv, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{rv.role}</div>
                        <div className="text-xs text-muted-foreground">
                          {rv.name}
                        </div>
                      </div>
                      <div className="text-xs text-right text-muted-foreground">
                        <div>{rv.date ?? "—"}</div>
                        <div>{rv.decision ?? ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 3) Signature list */}
            <Card className="rounded-2xl md:order-3">
              <CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">
                  Signature List
                </div>
                <div className="space-y-2 text-sm">
                  {(showSignatures
                    ? r.signatureList!
                    : [{ role: "—", name: "No signatures", signed: false }]
                  ).map((sg, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{sg.role}</div>
                        <div className="text-xs text-muted-foreground">
                          {sg.name}
                        </div>
                      </div>
                      <div className="text-xs text-right">
                        <span
                          className={clsx(
                            "px-2 py-1 rounded-full",
                            sg.signed
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-amber-100 text-amber-900",
                          )}
                        >
                          {sg.signed ? "Signed" : "Pending"}
                        </span>
                        <div className="text-muted-foreground">
                          {sg.date ?? "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 4) Final summary for closed items (if you want it for PCRs too) */}
            {showClosedSummary && (
              <Card className="rounded-2xl md:order-4">
                <CardContent className="p-4">
                  <div className="text-sm font-semibold mb-2">
                    Final Summary
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      Estimated:{" "}
                      {typeof r.estimated === "number"
                        ? fmt.format(r.estimated)
                        : "—"}
                    </div>
                    <div>
                      Actual:{" "}
                      {typeof r.actual === "number"
                        ? fmt.format(r.actual)
                        : "—"}
                    </div>
                    <div>
                      Variance:{" "}
                      {varianceValue === null
                        ? "—"
                        : `${varianceValue > 0 ? "+" : ""}${fmt.format(
                            varianceValue,
                          )}`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5) Documents list */}
            {(r.links?.length ?? 0) > 0 && (
              <Card className="rounded-2xl md:order-5 md:col-span-3">
                <CardContent className="p-4">
                  <div className="text-sm font-semibold mb-2">Documents</div>
                  <div className="space-y-2 text-sm">
                    {r.links!.map((lnk, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                      >
                        <div className="truncate">{lnk.label}</div>
                        <a
                          href={lnk.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80"
                        >
                          Open <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main Component
// ==========================================
export default function ChangeOrdersDashboard({
  initial,
}: {
  initial?: ChangeRecord[];
}) {
  const [stage] = useState<StageKey | "All">("All"); // stage filter kept but not exposed in UI
  const [pkg, setPkg] = useState<PackageId | "All">("All");
  const [q, setQ] = useState("");
  const [rows] = useState<ChangeRecord[]>(initial ?? DEMO);

  const view = useMemo(
    () =>
      rows
        .filter((r) => (stage === "All" ? true : r.stageKey === stage))
        .filter((r) => (pkg === "All" ? true : r.package === pkg))
        .filter((r) =>
          q
            ? `${r.id} ${r.title} ${r.sponsor ?? ""}`
                .toLowerCase()
                .includes(q.toLowerCase())
            : true,
        ),
    [rows, stage, pkg, q],
  );

  // Separate into PCR pipelines
  const pcrRows = useMemo(
    () => view.filter((r) => r.type === "PRC"),
    [view],
  );
  const pcrToEiRows = useMemo(
    () => pcrRows.filter((r) => r.target === "EI"),
    [pcrRows],
  );
  const pcrToCoRows = useMemo(
    () => pcrRows.filter((r) => r.target === "CO"),
    [pcrRows],
  );

  // Completed items: EI issued + CO/V/VOS or AA/SA issued/done
  const completedRows = useMemo(
    () =>
      view.filter((r) => {
        const isEICompleted =
          r.stageKey === "EI" &&
          (r.subStatus === "Issued" ||
            r.subStatus === "To be Issued to Contractor");
        const isCOOrAACompleted =
          (r.stageKey === "CO_V_VOS" && r.subStatus === "Done") ||
          (r.stageKey === "AA_SA" && r.subStatus === "Done");
        return isEICompleted || isCOOrAACompleted;
      }),
    [view],
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Title */}
      <div className="w-full text-center text-3xl font-semibold tracking-tight mb-2">
        Change Management Dashboard
      </div>

      {/* Summary + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard rows={view} />
        <div className="md:col-span-2">
          <ProjectKPIs rows={view} />
        </div>
      </div>

      {/* Search + export */}
      <Filters q={q} setQ={setQ} onExport={() => exportCSV(view)} />

      {/* Main table + package filter */}
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {/* Package chips at top of table */}
          <div className="px-4 pt-4 pb-2 bg-white">
            <PackageChips selected={pkg} onSelect={setPkg} />
          </div>

          {/* PCR → EI section (Table 1) */}
          <section>
            <PathTimeline
              label="PCRs → EI"
              stages={["PRC", "CC Outcome", "CEO / Board Memo", "EI"]}
            />
            <ChangeTableHeader showMiddleColumn={false} />
            {pcrToEiRows.length > 0 ? (
              pcrToEiRows.map((r) => (
                <Row
                  key={r.id}
                  r={r}
                  showMiddleColumn={false}
                  mode="pcr"
                />
              ))
            ) : (
              <div className="px-4 py-4 text-xs text-neutral-500">
                No PCRs currently tagged as PCR → EI after filters.
              </div>
            )}
          </section>

          {/* PCR → CO / V / VOS / AA-SA section (Table 2) */}
          <section className="mt-6">
            <PathTimeline
              label="PCRs → CO / V / VOS / AA-SA"
              stages={[
                "PRC",
                "CC Outcome",
                "CEO / Board Memo",
                "CO / V / VOS or AA / SA",
              ]}
            />
            <ChangeTableHeader showMiddleColumn={false} />
            {pcrToCoRows.length > 0 ? (
              pcrToCoRows.map((r) => (
                <Row
                  key={r.id}
                  r={r}
                  showMiddleColumn={false}
                  mode="pcr"
                />
              ))
            ) : (
              <div className="px-4 py-4 text-xs text-neutral-500">
                No PCRs currently tagged as PCR → CO / V / VOS after filters.
              </div>
            )}
          </section>

          {/* Completed items section (Table 3) */}
          <section className="mt-6 mb-2">
            <PathTimeline
              label="Completed (EI / CO / V / VOS or AA / SA Issued)"
              stages={[
                "PRC",
                "CC Outcome",
                "CEO / Board Memo",
                "Issued Item (EI / CO / V / VOS / AA / SA)",
              ]}
            />
            <ChangeTableHeader
              showMiddleColumn={true}
              middleLabel="Issued Item"
            />
            {completedRows.length > 0 ? (
              completedRows.map((r) => (
                <Row
                  key={r.id}
                  r={r}
                  showMiddleColumn={true}
                  mode="completed"
                />
              ))
            ) : (
              <div className="px-4 py-4 text-xs text-neutral-500">
                No completed changes (EI / CO / V / VOS or AA / SA Issued)
                under current filters.
              </div>
            )}
          </section>

          {/* If there are no PCR rows at all but other rows exist */}
          {pcrRows.length === 0 && view.length > 0 && (
            <div className="px-4 py-4 text-xs text-neutral-500">
              Current filters match only non-PCR records (EI / CO etc.).
            </div>
          )}

          {/* If absolutely nothing matches */}
          {view.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No records match the current filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer note */}
      <div className="text-xs text-muted-foreground">
        Lifecycle covered: PRC → CC Outcome → CEO / Board Memo → EI →
        CO/V/VOS → AA/SA. SLA &amp; progress are derived directly from the
        stage and dates. PCRs are grouped by their path (PCRs → EI and PCRs → CO
        / V / VOS / AA-SA), while the last table shows completed issued items
        (EI / CO / V / VOS / AA / SA).
      </div>
    </div>
  );
}
