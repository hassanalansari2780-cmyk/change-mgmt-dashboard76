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
  target?: "EI" | "CO" | "TBC";      // PCR target (if type = PRC)
  sponsor?: string;                  // Change sponsor
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

// ==========================================
// Demo data (with PRC target + sponsor)
// ==========================================
const DEMO: ChangeRecord[] = [
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

    // NEW
    target: "EI", // this PCR is intended to lead to an EI
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
    id: "PCR-A-018",
    type: "PRC",
    package: "A",
    title: "Handrail Height Adjustment (PCR)",
    estimated: 650000,
    stageKey: "PRC",
    subStatus: "In Preparation",
    stageStartDate: "2026-01-12",
    overallStartDate: "2026-01-12",

    // NEW
    target: "CO", // this PCR is intended to lead to a CO
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

  const isRejected = (r: ChangeRecord) =>
    r.outcome === "Rejected" ||
    (r.reviewList ?? []).some((x) =>
      (x.decision ?? "").toLowerCase().includes("reject"),
    );

  const approved = rows.filter(
    (r) => r.stageKey === FINAL_KEY && r.outcome === "Approved",
  ).length;

  const proposed = rows.filter(
    (r) => r.stageKey === "PRC" && !isRejected(r),
  ).length;

  const inReview = rows.filter(
    (r) => r.stageKey !== FINAL_KEY && r.stageKey !== "PRC" && !isRejected(r),
  ).length;

  const rejected = rows.filter(isRejected).length;

  return { total, approved, inReview, proposed, rejected };
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
            <span>Approved</span>
            <span>{s.approved}</span>
          </div>
          <div className="flex justify-between">
            <span>In Review</span>
            <span>{s.inReview}</span>
          </div>
          <div className="flex justify-between">
            <span>Proposed (PRC)</span>
            <span>{s.proposed}</span>
          </div>
          <div className="flex justify-between">
            <span>Rejected</span>
            <span>{s.rejected}</span>
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
      changePercentage,
      totalApprovedValue,
    };
  }, [rows]);

  const Item = ({ label, value }: { label: string; value: string }) => (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Item
        label="Total Project Value"
        value={fmt.format(k.totalProjectValue)}
      />
      <Item
        label="Total Change Order Value"
        value={fmt.format(k.totalCOValue)}
      />
      <Item label="Change % of Project" value={`${k.changePercentage}%`} />
      <Item
        label="Total Approved Change Value"
        value={fmt.format(k.totalApprovedValue)}
      />
    </div>
  );
}

// ==========================================
// Stage timeline
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
function formatPcrTargetLabel(t?: PcrTarget) {
  if (!t) return "";
  if (t === "EI") return "PCR → EI";
  if (t === "CO") return "PCR → CO";
  if (t === "EI+CO") return "PCR → EI + CO";
  if (t === "TBD") return "PCR Target TBD";
  return t;
}

function Row({ r }: { r: ChangeRecord }) {
  const s = stageInfo(r.stageKey);
  const vr = variance(r.estimated, r.actual);
  const days = daysBetween(r.stageStartDate);
  const pct = progressPct(r.stageKey);
  const [open, setOpen] = useState(false);

  const showReview = !!(r.reviewList && r.reviewList.length);
  const showSignatures = !!(r.signatureList && r.signatureList.length);
  const showClosedSummary = r.stageKey === FINAL_KEY;

  const prcLabel =
    r.type === "PRC" && r.target
      ? r.target === "EI"
        ? "PCR → EI"
        : r.target === "CO"
        ? "PCR → CO"
        : null
      : null;

  return (
    <div className="border-b last:border-b-0">
      <div className="grid grid-cols-12 items-center px-3 py-3 hover:bg-muted/40">
        {/* Ref ID + attachments */}
        <div className="col-span-1">
          <div className="font-medium">{r.id}</div>
          {r.links?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {r.links.map((lnk, i) => (
                <a
                  key={i}
                  href={lnk.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 mt-1"
                  title={lnk.href}
                >
                  <Paperclip className="w-3.5 h-3.5 mr-1" /> {lnk.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {/* Package */}
        <div className="col-span-1">
          <div className="w-8 h-8 rounded-full bg-muted grid place-items-center font-semibold">
            {r.package}
          </div>
        </div>

        {/* Title */}
        <div className="col-span-3 truncate">{r.title}</div>

{/* Stage + progress + SLA + Details */}
<div className="col-span-2">
  <div className="relative inline-flex items-center gap-2">
    <div
      className={clsx(
        "px-2 py-1 rounded-2xl text-xs font-semibold",
        s.color,
      )}
    >
      {s.name}
    </div>
    {r.subStatus && (
      <Badge className="rounded-2xl bg-neutral-100 text-neutral-900 border">
        {r.subStatus}
      </Badge>
    )}
  </div>

  <div className="mt-1">
    <Progress value={pct} className="h-2" />

    <div className="mt-1 text-[11px] text-muted-foreground">
      Day {days} / SLA {s.slaDays}
    </div>

    <Button
      size="sm"
      variant="ghost"
      className="mt-1 rounded-2xl h-7 px-3 text-[11px]"
      onClick={() => setOpen((v) => !v)}
    >
      {open ? "Hide" : "Details"}
    </Button>
  </div>
</div>

        {/* PCR Target */}
        <div className="col-span-1">
          {prcLabel && (
            <Badge className="rounded-2xl bg-amber-100 text-amber-900 border border-amber-200">
              {prcLabel}
            </Badge>
          )}
        </div>

        {/* Sponsor */}
        <div className="col-span-2">
          {r.sponsor && (
            <div className="text-xs text-muted-foreground">{r.sponsor}</div>
          )}
        </div>

        {/* Estimated */}
        <div className="col-span-1 text-right tabular-nums">
          {typeof r.estimated === "number" ? fmt.format(r.estimated) : "—"}
        </div>

        {/* Actual */}
        <div className="col-span-1 text-right tabular-nums">
          {typeof r.actual === "number" ? fmt.format(r.actual) : "—"}
        </div>
      </div>

      {open && (
        <div className="px-3 pb-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1) Stage Progress */}
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

            {/* 2) Review List */}
            <Card className="rounded-2xl md:order-2">
              <CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">Review List</div>
                <div className="space-y-2">
                  {(showReview
                    ? r.reviewList!
                    : [{ role: "—", name: "No reviewers", decision: "" }]
                  ).map((rv, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
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

            {/* 3) Signature List */}
            <Card className="rounded-2xl md:order-3">
              <CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">
                  Signature List
                </div>
                <div className="space-y-2">
                  {(showSignatures
                    ? r.signatureList!
                    : [{ role: "—", name: "No signatures", signed: false }]
                  ).map((sg, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
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

            {/* 4) Final Summary if closed */}
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
                      {variance(r.estimated, r.actual) === null
                        ? "—"
                        : `${
                            variance(r.estimated, r.actual)! < 0 ? "-" : "+"
                          }${fmt.format(
                            Math.abs(variance(r.estimated, r.actual)!),
                          )}`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5) Documents */}
            {(r.links?.length ?? 0) > 0 && (
              <Card className="rounded-2xl md:order-5 md:col-span-3">
                <CardContent className="p-4">
                  <div className="text-sm font-semibold mb-2">Documents</div>
                  <div className="space-y-2">
                    {r.links!.map((lnk, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
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
  const [stage, setStage] = useState<StageKey | "All">("All");
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="w-full text-center text-3xl font-semibold tracking-tight mb-2">
        Change Management Dashboard
      </div>

      <PackageChips selected={pkg} onSelect={setPkg} />

      <SummaryCard rows={view} />

      <ProjectKPIs rows={view} />

      <StageTimeline active={stage} onClickStage={(key) => setStage(key)} />

      <Filters q={q} setQ={setQ} onExport={() => exportCSV(view)} />

      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
<div className="grid grid-cols-12 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
  <div className="col-span-1">Ref ID</div>
  <div className="col-span-1">Package</div>
  <div className="col-span-3">Title</div>
  <div className="col-span-2">Stage</div>
  <div className="col-span-1">PCR Target</div>
  <div className="col-span-2">Sponsor</div>
  <div className="col-span-1 text-right">Estimated</div>
  <div className="col-span-1 text-right">Actual</div>
</div>

          {view.map((r) => (
            <Row key={r.id} r={r} />
          ))}

          {view.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No records match the current filters.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Lifecycle covered: PRC → CC Outcome → CEO / Board Memo → EI → CO/V/VOS
        → AA/SA. SLA &amp; progress are derived directly from the stage and dates.
        PCRs that are intended to lead to EI or CO are tagged, and sponsors are
        visible under each reference.
      </div>
    </div>
  );
}
