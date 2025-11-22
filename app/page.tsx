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

export type PackageId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "I2"
  | "PMEC";

export type PcrTarget = "EI" | "CO" | "EI+CO" | "VOS" | "TBC" | "AA";

export interface Reviewer {
  role: string;
  name: string;
  date?: string;
  decision?: string;
}

export interface Signer {
  role: string;
  name: string;
  date?: string;
  signed?: boolean;
}

export interface LinkItem {
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
  target?: PcrTarget; // PCR intended to become EI / CO / VOS / AA
  sponsor?: string; // Change sponsor
  reviewList?: Reviewer[];
  signatureList?: Signer[];
  links?: LinkItem[];
  prcTarget?: PcrTarget; // optional second field if you want it for CSV
  // --- New fields for upcoming CC demo ---
  ccPlannedForNext?: boolean; // included in next CC agenda
  ccPreviousMeeting?: number; // if carry-over, original CC number
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
  CO_V_VOS: [
    "To be Prepared",
    "In Preparation",
    "Under Review",
    "Ready",
    "In Circulation",
    "In Approval",
    "Issued",
    "To be Issued to Contractor",
  ],
  AA_SA: [
    "To be Prepared",
    "In Preparation",
    "Under Review",
    "Ready",
    "In Circulation",
    "In Approval",
    "Issued",
    "To be Issued to Contractor",
  ],
};

const fmt = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});
const fmtShort = new Intl.NumberFormat("en-US");
const FINAL_KEY: StageKey = "AA_SA";

// Demo: upcoming CC meeting number
const NEXT_CC_MEETING_NO = 12;

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
function issuedItemLabel(r: ChangeRecord) {
  // Final issued item shown in Table 3
  if (r.stageKey === "EI" || r.type === "EI") return "EI";
  if (r.stageKey === "CO_V_VOS") return "CO / V / VOS";
  if (r.stageKey === "AA_SA") return "AA / SA";
  return r.type;
}

// ==========================================
// Demo data – many examples across stages
// ==========================================
const DEMO: ChangeRecord[] = [
  // ===== PCRs → EI (Table 1) =====
  {
    id: "PCR-A-030",
    type: "PRC",
    package: "A",
    title: "Ventilation Fan Adjustment in Tunnel A-02 (PCR)",
    estimated: 520000,
    stageKey: "PRC",
    subStatus: "In Preparation",
    stageStartDate: "2026-02-11",
    overallStartDate: "2026-02-11",
    target: "EI",
    sponsor: "Pkg A PM – Eng. Nasser Al-Rawahi",
  },

  {
    id: "PCR-C-033",
    type: "PRC",
    package: "C",
    title: "Emergency Lighting Cable Protection (PCR)",
    estimated: 980000,
    stageKey: "CC_OUTCOME",
    subStatus: "Approved",
    stageStartDate: "2026-02-09",
    overallStartDate: "2026-01-28",
    target: "EI",
    sponsor: "Pkg C PM – Eng. Khalid Al-Harthy",
  },

  {
    id: "PCR-D-029",
    type: "PRC",
    package: "D",
    title: "Platform Emergency Call Box Relocation (PCR)",
    estimated: 240000,
    actual: 235000,
    stageKey: "CEO_OR_BOARD_MEMO",
    subStatus: "In Approval",
    stageStartDate: "2026-02-12",
    overallStartDate: "2026-01-30",
    target: "EI",
    sponsor: "Pkg D PM – Eng. Younis Al-Maamari",
  },

  {
    id: "PCR-E-015",
    type: "PRC",
    package: "E",
    title: "Workshop Vertical Clearance Improvement (PCR)",
    estimated: 300000,
    stageKey: "EI",
    subStatus: "Ready",
    stageStartDate: "2026-02-10",
    overallStartDate: "2026-01-29",
    target: "EI",
    sponsor: "Assets Manager – Eng. Hamad Al-Hinai",
  },

  {
    id: "PCR-F-009",
    type: "PRC",
    package: "F",
    title: "Signalling Panel Earthing Correction (PCR)",
    estimated: 150000,
    actual: 155000,
    stageKey: "EI",
    subStatus: "To be Issued to Contractor",
    stageStartDate: "2026-02-14",
    overallStartDate: "2026-02-01",
    target: "EI",
    sponsor: "Signalling Manager – Eng. Talal Al-Balushi",
  },
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
    ccPlannedForNext: true, // New for CC-12 (EI)
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

  // PCR → EI currently at CC Outcome
  {
    id: "PCR-D-022",
    type: "PRC",
    package: "D",
    title: "Platform Edge Realignment (PCR)",
    estimated: 420000,
    actual: 430000,
    stageKey: "CC_OUTCOME",
    subStatus: "Approved",
    stageStartDate: "2026-02-01",
    overallStartDate: "2026-01-20",
    target: "EI",
    sponsor: "Pkg D PM – Eng. Younis Al-Maamari",
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        decision: "Recommended",
        date: "2026-01-28",
      },
      {
        role: "CC",
        name: "Change Committee",
        decision: "Approved",
        date: "2026-02-01",
      },
    ],
  },

  // PCR → EI currently at CEO / Board Memo
  {
    id: "PCR-E-010",
    type: "PRC",
    package: "E",
    title: "Additional Lighting in Maintenance Yard (PCR)",
    estimated: 280000,
    stageKey: "CEO_OR_BOARD_MEMO",
    subStatus: "In Circulation",
    stageStartDate: "2026-02-05",
    overallStartDate: "2026-01-25",
    target: "EI",
    sponsor: "Assets Manager – Eng. Hamad Al-Hinai",
    reviewList: [
      {
        role: "Finance",
        name: "Muna Al-Harthy",
        decision: "Budget confirmed",
        date: "2026-02-02",
      },
    ],
    signatureList: [
      {
        role: "CEO",
        name: "Ahmed Al-Habsi",
        signed: false,
      },
    ],
  },

  // ===== PCRs → CO / V / VOS / AA-SA (Table 2) =====
  {
    id: "PCR-B-020",
    type: "PRC",
    package: "B",
    title: "Drainage Channel Reinforcement (PCR)",
    estimated: 780000,
    stageKey: "CO_V_VOS",
    subStatus: "To be Prepared",
    stageStartDate: "2026-02-13",
    overallStartDate: "2026-02-13",
    target: "CO",
    sponsor: "Pkg B PM – Eng. Rashid Al-Siyabi",
  },

  {
    id: "PCR-G-017",
    type: "PRC",
    package: "G",
    title: "Trackside Fencing Optimization (PCR)",
    estimated: 1100000,
    actual: 1050000,
    stageKey: "CO_V_VOS",
    subStatus: "Under Review",
    stageStartDate: "2026-02-10",
    overallStartDate: "2026-02-01",
    target: "VOS",
    sponsor: "Track Engineering Manager",
  },

  {
    id: "PCR-D-031",
    type: "PRC",
    package: "D",
    title: "Passenger Flow Adjustment at Station D-07 (PCR)",
    estimated: 450000,
    stageKey: "CO_V_VOS",
    subStatus: "In Circulation",
    stageStartDate: "2026-02-09",
    overallStartDate: "2026-01-30",
    target: "CO",
    sponsor: "Pkg D PM – Eng. Younis Al-Maamari",
  },

  {
    id: "PCR-E-024",
    type: "PRC",
    package: "E",
    title: "Maintenance Yard Gate Relocation (PCR)",
    estimated: 600000,
    actual: 590000,
    stageKey: "AA_SA",
    subStatus: "In Approval",
    stageStartDate: "2026-02-11",
    overallStartDate: "2026-02-02",
    target: "AA",
    sponsor: "Assets Manager – Eng. Hamad Al-Hinai",
  },

  {
    id: "PCR-F-012",
    type: "PRC",
    package: "F",
    title: "Signalling Room Cooling Improvement (PCR)",
    estimated: 900000,
    actual: 920000,
    stageKey: "CO_V_VOS",
    subStatus: "To be Issued to Contractor",
    stageStartDate: "2026-02-14",
    overallStartDate: "2026-02-05",
    target: "CO",
    sponsor: "Signalling Manager – Eng. Talal Al-Balushi",
  },
  {
    id: "PCR-A-018",
    type: "PRC",
    package: "A",
    title: "Handrail Height Adjustment (PCR)",
    estimated: 650000,
    actual: 700000,
    stageKey: "PRC",
    subStatus: "In Preparation",
    stageStartDate: "2026-01-12",
    overallStartDate: "2026-01-12",
    target: "CO",
    sponsor: "HSSE Manager – Eng. Salim Al-Harthy",
    ccPlannedForNext: true, // New CO item for CC-12
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
        label: "CEO/Board Memo (Draft PDF)",
        href: "https://example.com/memos/PCR-A-018-memo-draft.pdf",
      },
    ],
  },

  {
    id: "PCR-B-009",
    type: "PRC",
    package: "B",
    title: "Additional Cross Drain at Km 14+200 (PCR)",
    estimated: 950000,
    actual: 900000,
    stageKey: "PRC",
    subStatus: "Presented at CC",
    stageStartDate: "2026-01-20",
    overallStartDate: "2026-01-15",
    target: "CO",
    sponsor: "Pkg B PM – Eng. Rashid Al-Siyabi",
    ccPlannedForNext: true, // Carry-over item
    ccPreviousMeeting: 11, // from CC-11 to CC-12
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        decision: "Support in principle",
        date: "2026-01-18",
      },
    ],
  },

  // PCR → CO currently at CC Outcome
  {
    id: "PCR-F-005",
    type: "PRC",
    package: "F",
    title: "Turnout Heating Modification (PCR)",
    estimated: 1300000,
    actual: 1250000,
    stageKey: "CC_OUTCOME",
    subStatus: "Approved with Conditions",
    stageStartDate: "2026-02-03",
    overallStartDate: "2026-01-22",
    target: "CO",
    sponsor: "Signalling Manager – Eng. Talal Al-Balushi",
    reviewList: [
      {
        role: "CC",
        name: "Change Committee",
        decision: "Approved with conditions",
        date: "2026-02-03",
      },
    ],
  },

  // PCR → CO currently at CEO / Board Memo
  {
    id: "PCR-G-011",
    type: "PRC",
    package: "G",
    title: "Ballast Shoulder Widening (PCR)",
    estimated: 2100000,
    actual: 2150000,
    stageKey: "CEO_OR_BOARD_MEMO",
    subStatus: "In Approval",
    stageStartDate: "2026-02-08",
    overallStartDate: "2026-01-28",
    target: "CO",
    sponsor: "Track Engineering Manager",
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        decision: "Recommended to CEO",
        date: "2026-02-06",
      },
    ],
    signatureList: [
      {
        role: "CEO",
        name: "Ahmed Al-Habsi",
        signed: false,
      },
    ],
  },

  // ===== EI in progress / issued (used in details / summary) =====
  {
    id: "EI-A-011",
    type: "EI",
    package: "A",
    title: "Tunnel Lighting Rectification (EI)",
    estimated: 0,
    stageKey: "EI",
    subStatus: "Issued",
    stageStartDate: "2025-11-20",
    overallStartDate: "2025-11-10",
    sponsor: "Pkg A PM – Eng. Nasser Al-Rawahi",
  },

  {
    id: "CO-C-045",
    type: "CO",
    package: "C",
    title: "Station C-09 Canopy Strengthening (Final)",
    estimated: 1300000,
    actual: 1275000,
    stageKey: "CO_V_VOS",
    subStatus: "Done",
    stageStartDate: "2025-12-18",
    overallStartDate: "2025-12-01",
    sponsor: "Pkg C PM – Eng. Khalid Al-Harthy",
  },

  {
    id: "V-D-005",
    type: "CO",
    package: "D",
    title: "Value Optimization – Ticket Counter Layout (Final)",
    estimated: 150000,
    actual: 150000,
    stageKey: "CO_V_VOS",
    subStatus: "Done",
    stageStartDate: "2025-10-09",
    overallStartDate: "2025-09-22",
    sponsor: "Pkg D PM – Eng. Younis Al-Maamari",
  },

  {
    id: "AA-E-010",
    type: "CO",
    package: "E",
    title: "Agreement Amendment – Workshop Roof Access (Final)",
    estimated: 430000,
    actual: 420000,
    stageKey: "AA_SA",
    subStatus: "Done",
    stageStartDate: "2025-09-29",
    overallStartDate: "2025-09-10",
    sponsor: "Assets Manager – Eng. Hamad Al-Hinai",
  },

  {
    id: "SA-G-006",
    type: "CO",
    package: "G",
    title: "Site Adjustment – Trackside Clearance Update (Final)",
    estimated: 600000,
    actual: 585000,
    stageKey: "AA_SA",
    subStatus: "Done",
    stageStartDate: "2025-11-01",
    overallStartDate: "2025-10-15",
    sponsor: "Track Engineering Manager",
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

  {
    id: "EI-C-009",
    type: "EI",
    package: "C",
    title: "Drainage Rerouting at Station C-05 (EI)",
    estimated: 0,
    stageKey: "EI",
    subStatus: "To be Issued to Contractor",
    stageStartDate: "2026-02-12",
    overallStartDate: "2026-02-10",
    sponsor: "Pkg C PM – Eng. Khalid Al-Harthy",
  },

  // ===== Completed CO / V / VOS / AA-SA (Table 3) =====

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

  {
    id: "CO-B-020",
    type: "CO",
    package: "B",
    title: "Modification to Station Access Road (Final)",
    estimated: 1100000,
    actual: 1080000,
    outcome: "Approved",
    stageKey: "AA_SA",
    subStatus: "Done",
    stageStartDate: "2025-09-15",
    overallStartDate: "2025-08-20",
    sponsor: "Pkg B PM – Eng. Rashid Al-Siyabi",
    reviewList: [
      {
        role: "PMEC",
        name: "Engineer Team",
        decision: "Approved",
        date: "2025-09-10",
      },
    ],
  },

  {
    id: "CO-E-003",
    type: "CO",
    package: "E",
    title: "Workshop Drainage Improvement (Final)",
    estimated: 300000,
    actual: 295000,
    outcome: "Approved",
    stageKey: "CO_V_VOS",
    subStatus: "Done",
    stageStartDate: "2025-10-01",
    overallStartDate: "2025-09-05",
    sponsor: "Assets Manager – Eng. Hamad Al-Hinai",
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
  const pcrToCO = pcrs.filter((r) => r.target === "CO" || r.target === "VOS" || r.target === "AA").length;

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
// Project KPIs row (with 3 modals)
// ==========================================
function ProjectKPIs({ rows }: { rows: ChangeRecord[] }) {
  const LIMIT_PERCENT = 10; // max 10% threshold
  const NEXT_CC_MEETING = "CC-12";

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showCcModal, setShowCcModal] = useState(false);

  // Small reusable modal shell
  const Modal = ({
    open,
    title,
    onClose,
    children,
  }: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }) => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-4xl rounded-3xl bg-white shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="text-lg font-semibold">{title}</div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-2xl"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-auto px-6 py-4 text-sm">
            {children}
          </div>
        </div>
      </div>
    );
  };

  const k = useMemo(() => {
    // --- Total project value from breakdown ---
    const totalProjectValue = CONTRACT_BREAKDOWN.reduce(
      (sum, c) => sum + c.value,
      0,
    );

    // --- Approved change orders (for value KPIs & per-package breakdown) ---
    const approvedRows = rows.filter(
      (r) => r.outcome === "Approved" && typeof r.actual === "number",
    );

    const totalApprovedValue = approvedRows.reduce(
      (sum, r) => sum + (r.actual ?? 0),
      0,
    );

    const changeRatio = totalProjectValue
      ? totalApprovedValue / totalProjectValue
      : 0;

    const changePercent = changeRatio * 100;
    const changePercentDisplay = changePercent.toFixed(2);

    const limitValue = totalProjectValue * (LIMIT_PERCENT / 100);

    const approvedVsLimitPct = limitValue
      ? Math.min(100, Math.max(0, (totalApprovedValue / limitValue) * 100))
      : 0;

    const percentVsLimitPct = LIMIT_PERCENT
      ? Math.min(100, Math.max(0, (changePercent / LIMIT_PERCENT) * 100))
      : 0;

    // --- Per-package change breakdown for the details modal ---
    const pkgList: PackageId[] = ["A", "B", "C", "D", "E", "F", "G", "I2", "PMEC"];
    const perPackage: Record<
      PackageId,
      { estimated: number; actual: number; count: number }
    > = {} as any;

    for (const p of pkgList) {
      perPackage[p] = { estimated: 0, actual: 0, count: 0 };
    }

    approvedRows.forEach((r) => {
      const bucket = perPackage[r.package];
      if (!bucket) return;
      bucket.estimated += r.estimated ?? 0;
      bucket.actual += r.actual ?? 0;
      bucket.count += 1;
    });

    // --- PCRs on upcoming CC agenda ---
    const pcrRows = rows.filter((r) => r.type === "PRC");
    const agendaRows = pcrRows.filter(
      (r) =>
        r.stageKey === "PRC" &&
        (r.subStatus === "Ready for CC" || r.subStatus === "Presented at CC"),
    );

    const totalOnAgenda = agendaRows.length;
    const onAgendaEi = agendaRows.filter((r) => r.target === "EI").length;
    const onAgendaCo = agendaRows.filter(
      (r) => r.target === "CO" || r.target === "VOS",
    ).length;

    return {
      totalProjectValue,
      totalApprovedValue,
      changePercentDisplay,
      limitValue,
      approvedVsLimitPct,
      percentVsLimitPct,
      perPackage,
      agendaRows,
      totalOnAgenda,
      onAgendaEi,
      onAgendaCo,
    };
  }, [rows]);

  // --- Single KPI card --- //
  const Item = ({
    label,
    value,
    subtitle,
    showBar,
    barValue,
    barCaption,
    onDetails,
  }: {
    label: string;
    value: string;
    subtitle?: string;
    showBar?: boolean;
    barValue?: number;
    barCaption?: string;
    onDetails?: () => void;
  }) => (
    <Card className="rounded-2xl shadow-sm h-[180px]">
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div className="flex flex-col space-y-1">
          <div className="text-sm text-muted-foreground leading-none">
            {label}
          </div>

          <div className="text-xl font-semibold leading-tight whitespace-nowrap">
            {value}
          </div>

          {subtitle && (
            <div className="text-xs text-muted-foreground mt-1">
              {subtitle}
            </div>
          )}

          {showBar && typeof barValue === "number" && (
            <div className="mt-2">
              <Progress value={barValue} className="h-2 rounded-full" />
              {barCaption && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {barCaption}
                </div>
              )}
            </div>
          )}
        </div>

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

  // ==== CC Meeting card helper ====
  const CcCard = () => (
    <Card className="rounded-2xl shadow-sm h-[180px]">
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div className="flex flex-col space-y-1">
          <div className="text-sm text-muted-foreground leading-none">
            Next CC Meeting
          </div>
          <div className="text-xl font-semibold leading-tight">
            {NEXT_CC_MEETING}
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total PCRs on agenda</span>
              <span>{k.totalOnAgenda}</span>
            </div>
            <div className="flex justify-between">
              <span>PCRs targeting EI</span>
              <span>{k.onAgendaEi}</span>
            </div>
            <div className="flex justify-between">
              <span>PCRs targeting CO / V / VOS / AA</span>
              <span>{k.onAgendaCo}</span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="rounded-2xl px-3 py-1 text-xs self-start"
          onClick={() => setShowCcModal(true)}
        >
          Details
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* KPI cards row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
        {/* 1) Total Project Value — with breakdown modal */}
        <Item
          label="Total Project Value"
          value={fmt.format(k.totalProjectValue)}
          onDetails={() => setShowProjectModal(true)}
        />

        {/* 2) Total Approved Change Value — with per-package modal */}
        <Item
          label="Total Approved Change Value"
          value={fmt.format(k.totalApprovedValue)}
          subtitle={`of ${fmt.format(k.limitValue)} limit (${LIMIT_PERCENT}% of project)`}
          showBar
          barValue={k.approvedVsLimitPct}
          barCaption={`${k.approvedVsLimitPct.toFixed(
            0,
          )}% of allowed envelope used`}
          onDetails={() => setShowChangeModal(true)}
        />

        {/* 3) Change % of Project — same as before, no modal needed */}
        <Item
          label="Change % of Project"
          value={`${k.changePercentDisplay}%`}
          subtitle={`of ${LIMIT_PERCENT}% limit`}
          showBar
          barValue={k.percentVsLimitPct}
          barCaption={`${k.percentVsLimitPct.toFixed(
            0,
          )}% of percentage limit used`}
        />

        {/* 4) Next CC Meeting card */}
        <CcCard />
      </div>

      {/* ===== Modals ===== */}

      {/* Total Project Value breakdown */}
      <Modal
        open={showProjectModal}
        title="Total Project Value – Breakdown by Contract"
        onClose={() => setShowProjectModal(false)}
      >
        <div className="mb-3 text-sm text-muted-foreground">
          This breakdown shows the base award value for each main contract /
          package. The total matches the <b>Total Project Value</b> KPI.
        </div>
        <div className="border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-3 px-4 py-2 text-xs font-semibold text-neutral-600 bg-neutral-50">
            <div>Package</div>
            <div>Contract</div>
            <div className="text-right">Value</div>
          </div>
          {CONTRACT_BREAKDOWN.map((c) => (
            <div
              key={c.package}
              className="grid grid-cols-3 px-4 py-2 text-sm border-t"
            >
              <div>{c.package}</div>
              <div>{c.label}</div>
              <div className="text-right tabular-nums">
                {fmt.format(c.value)}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-3 px-4 py-3 text-sm font-semibold bg-neutral-50 border-t">
            <div />
            <div className="text-right">Total Project Value</div>
            <div className="text-right tabular-nums">
              {fmt.format(k.totalProjectValue)}
            </div>
          </div>
        </div>
      </Modal>

      {/* Total Approved Change Value breakdown */}
      <Modal
        open={showChangeModal}
        title="Approved Change Value – Breakdown by Package"
        onClose={() => setShowChangeModal(false)}
      >
        <div className="mb-3 text-sm text-muted-foreground">
          Includes only items with outcome <b>Approved</b>. For each package the
          table shows total estimated change value, total actual value (if
          available), and the variance.
        </div>

        <div className="border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-5 px-4 py-2 text-xs font-semibold text-neutral-600 bg-neutral-50">
            <div>Package</div>
            <div className="text-right">Estimated (sum)</div>
            <div className="text-right">Actual (sum)</div>
            <div className="text-right">Variance</div>
            <div className="text-right"># of COs</div>
          </div>

          {(["A", "B", "C", "D", "E", "F", "G", "I2", "PMEC"] as PackageId[])
            .filter((p) => k.perPackage[p].count > 0)
            .map((p) => {
              const row = k.perPackage[p];
              const variance = row.actual - row.estimated;
              return (
                <div
                  key={p}
                  className="grid grid-cols-5 px-4 py-2 text-sm border-t"
                >
                  <div>{p}</div>
                  <div className="text-right tabular-nums">
                    {fmt.format(row.estimated)}
                  </div>
                  <div className="text-right tabular-nums">
                    {fmt.format(row.actual)}
                  </div>
                  <div className="text-right tabular-nums">
                    {row.count === 0
                      ? "—"
                      : `${variance > 0 ? "+" : variance < 0 ? "-" : ""}${fmt.format(
                          Math.abs(variance),
                        )}`}
                  </div>
                  <div className="text-right tabular-nums">{row.count}</div>
                </div>
              );
            })}

          <div className="grid grid-cols-5 px-4 py-3 text-sm font-semibold bg-neutral-50 border-t">
            <div>Total</div>
            <div className="text-right tabular-nums">
              {fmt.format(
                (["A", "B", "C", "D", "E", "F", "G", "I2", "PMEC"] as PackageId[])
                  .map((p) => k.perPackage[p].estimated)
                  .reduce((a, b) => a + b, 0),
              )}
            </div>
            <div className="text-right tabular-nums">
              {fmt.format(k.totalApprovedValue)}
            </div>
            <div className="text-right tabular-nums">
              {fmt.format(
                (["A", "B", "C", "D", "E", "F", "G", "I2", "PMEC"] as PackageId[])
                  .map((p) => k.perPackage[p].actual - k.perPackage[p].estimated)
                  .reduce((a, b) => a + b, 0),
              )}
            </div>
            <div className="text-right tabular-nums">
              {(["A", "B", "C", "D", "E", "F", "G", "I2", "PMEC"] as PackageId[])
                .map((p) => k.perPackage[p].count)
                .reduce((a, b) => a + b, 0)}
            </div>
          </div>
        </div>
      </Modal>

      {/* Next CC Meeting agenda modal */}
      <Modal
        open={showCcModal}
        title={`Next CC Meeting – ${NEXT_CC_MEETING} Agenda`}
        onClose={() => setShowCcModal(false)}
      >
        <div className="mb-3 text-sm text-muted-foreground">
          Shows all PCRs currently at <b>PRC</b> stage with sub-status{" "}
          <b>Ready for CC</b> or <b>Presented at CC</b>. Items marked as
          &ldquo;Carry-over&rdquo; are assumed to have been presented in the
          previous meeting (CC-11) and kept on the agenda.
        </div>

        <div className="border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-6 px-4 py-2 text-xs font-semibold text-neutral-600 bg-neutral-50">
            <div>Ref ID</div>
            <div>Pkg</div>
            <div>Target</div>
            <div>Status</div>
            <div>Sponsor</div>
            <div className="text-right">Est. Value</div>
          </div>

          {k.agendaRows.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground border-t">
              No PCRs currently tagged for the next CC under the active
              filters.
            </div>
          )}

          {k.agendaRows.map((r) => {
            const isCarryOver = r.subStatus === "Presented at CC";
            return (
              <div
                key={r.id}
                className="grid grid-cols-6 px-4 py-2 text-sm border-t"
              >
                <div>{r.id}</div>
                <div>{r.package}</div>
                <div>{r.target ?? "—"}</div>
                <div>
                  {isCarryOver
                    ? "Carry-over from CC-11"
                    : `New in ${NEXT_CC_MEETING}`}
                </div>
                <div className="truncate">{r.sponsor ?? "—"}</div>
                <div className="text-right tabular-nums">
                  {typeof r.estimated === "number"
                    ? fmt.format(r.estimated)
                    : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

// ==========================================
// Next CC Meeting – summary & modal
// ==========================================
type NextCcSummary = {
  nextCcNo: number;
  total: number;
  eiCount: number;
  coCount: number;
  rows: ChangeRecord[];
};

function computeNextCcSummary(rows: ChangeRecord[]): NextCcSummary {
  const ccRows = rows.filter((r) => r.type === "PRC" && r.ccPlannedForNext);
  const eiCount = ccRows.filter((r) => r.target === "EI").length;
  const coCount = ccRows.filter(
    (r) => r.target === "CO" || r.target === "VOS" || r.target === "AA",
  );
  return {
    nextCcNo: NEXT_CC_MEETING_NO,
    total: ccRows.length,
    eiCount,
    coCount: coCount.length,
    rows: ccRows,
  };
}

function NextCcCard({
  rows,
  onOpenDetails,
}: {
  rows: ChangeRecord[];
  onOpenDetails: () => void;
}) {
  const summary = useMemo(() => computeNextCcSummary(rows), [rows]);

  return (
    <Card className="rounded-2xl shadow-sm h-full">
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div>
          <div className="text-sm text-muted-foreground">
            Next CC Meeting
          </div>
          <div className="text-xl font-semibold mt-1">
            {summary.nextCcNo
              ? `CC-${summary.nextCcNo.toString().padStart(2, "0")}`
              : "—"}
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total PCRs on agenda</span>
              <span>{summary.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>PCRs targeting EI</span>
              <span>{summary.eiCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>PCRs targeting CO / V / VOS / AA</span>
              <span>{summary.coCount || 0}</span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="rounded-2xl px-3 py-1 text-xs self-start mt-4"
          onClick={onOpenDetails}
          disabled={summary.total === 0}
        >
          Details
        </Button>
      </CardContent>
    </Card>
  );
}

function NextCcModal({
  rows,
  onClose,
}: {
  rows: ChangeRecord[];
  onClose: () => void;
}) {
  const summary = useMemo(() => computeNextCcSummary(rows), [rows]);
  const ccRows = summary.rows;

  if (ccRows.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Change Committee
            </div>
            <div className="text-xl font-semibold">
              Next CC Meeting –{" "}
              {`CC-${summary.nextCcNo.toString().padStart(2, "0")}`}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        {/* Top summary */}
        <div className="px-6 py-3 border-b grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Total PCRs on agenda</div>
            <div className="font-medium">{summary.total}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Targeting EI</div>
            <div className="font-medium">{summary.eiCount}</div>
          </div>
          <div>
            <div className="text-muted-foreground">
              Targeting CO / V / VOS / AA
            </div>
            <div className="font-medium">{summary.coCount}</div>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 py-4 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr className="align-middle">
                <th className="py-2 pr-3">Ref ID</th>
                <th className="py-2 pr-3">Pkg</th>
                <th className="py-2 pr-3 w-1/3">Title</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Status for CC-12</th>
                <th className="py-2 pr-3">Sponsor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ccRows.map((r) => {
                const targetLabel =
                  r.target === "EI" ? "EI" : "CO / V / VOS / AA";
                const isCarryOver = typeof r.ccPreviousMeeting === "number";
                const statusLabel = isCarryOver
                  ? `Carry-over (from CC-${r.ccPreviousMeeting
                      ?.toString()
                      .padStart(2, "0")})`
                  : "First time in this CC";

                return (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">
                      {r.id}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex w-7 h-7 rounded-full bg-muted items-center justify-center text-xs font-semibold">
                        {r.package}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="leading-snug">{r.title}</div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="inline-flex px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 text-xs font-medium">
                        {targetLabel}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span
                        className={clsx(
                          "inline-flex px-3 py-1 rounded-full text-xs font-medium",
                          isCarryOver
                            ? "bg-amber-50 text-amber-900"
                            : "bg-sky-50 text-sky-900",
                        )}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="leading-snug max-w-xs">
                        {r.sponsor ?? "—"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Note */}
        <div className="px-6 py-3 border-t text-xs text-muted-foreground">
          Note: This is a demo view. In the live dashboard, PCRs would be
          driven from the PCG/CC register and automatically tagged as{" "}
          <span className="font-medium">New</span> or{" "}
          <span className="font-medium">Carry-over</span> based on the previous
          CC minutes.
        </div>
      </div>
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
  showMiddleColumn = false,
  middleLabel = "Issued Item",
}: {
  showMiddleColumn?: boolean;
  middleLabel?: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold text-neutral-500 bg-white border-y">
      <div className="col-span-1">Ref ID</div>
      <div className="col-span-1">Package</div>
      <div className="col-span-2">Title</div>
      <div className="col-span-2">Stage</div>

      {/* Optional middle column (for Issued Item in table 3) */}
      <div
        className={clsx(
          "col-span-1",
          !showMiddleColumn && "hidden",
        )}
      >
        {showMiddleColumn ? middleLabel : null}
      </div>

      <div className="col-span-2">Sponsor</div>
      <div className="col-span-1 text-right">Estimated</div>
      <div className="col-span-1 text-right">Actual</div>
      <div className="col-span-1 text-right">Variance</div>
    </div>
  );
}
function CompletedTableHeader() {
  return (
    <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold text-neutral-500 bg-white border-y">
      <div className="col-span-1">Ref ID</div>
      <div className="col-span-1">Package</div>
      <div className="col-span-3">Title</div>
      <div className="col-span-2">Issued Item</div>
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

// Demo contract values used for Total Project Value breakdown
const CONTRACT_BREAKDOWN: { package: PackageId; label: string; value: number }[] = [
  { package: "A", label: "Package A – Systems", value: 80_000_000 },
  { package: "B", label: "Package B – Track", value: 70_000_000 },
  { package: "C", label: "Package C – Civil", value: 90_000_000 },
  { package: "D", label: "Package D – Stations", value: 60_000_000 },
  { package: "E", label: "Package E – Depots & Workshops", value: 75_000_000 },
  { package: "F", label: "Package F – Rolling Stock", value: 125_000_000 },
];

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

  const hasDocs = (r.links?.length ?? 0) > 0;

  const varianceValue =
    typeof r.estimated === "number" && typeof r.actual === "number"
      ? r.actual - r.estimated
      : null;

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

          {/* Inline details kept simple for now */}
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
    </div>
  );
}

function CompletedRow({ r }: { r: ChangeRecord }) {
  const varianceValue =
    typeof r.estimated === "number" && typeof r.actual === "number"
      ? r.actual - r.estimated
      : null;

  return (
    <div className="border-b last:border-b-0 bg-white">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 items-start">
        {/* Ref ID */}
        <div className="col-span-1">
          <div className="text-sm font-medium">{r.id}</div>
          {(r.links?.length ?? 0) > 0 && (
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

        {/* Package */}
        <div className="col-span-1">
          <div className="w-8 h-8 rounded-full bg-muted grid place-items-center text-sm font-semibold">
            {r.package}
          </div>
        </div>

        {/* Title */}
        <div className="col-span-3">
          <div className="text-sm leading-snug break-words">{r.title}</div>
        </div>

        {/* Issued Item */}
        <div className="col-span-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 text-xs font-medium">
            {issuedItemLabel(r)}
          </span>
        </div>

        {/* Sponsor */}
        <div className="col-span-2 text-sm leading-snug break-words">
          {r.sponsor ?? "—"}
        </div>

        {/* Estimated */}
        <div className="col-span-1 text-right">
          <div className="text-sm tabular-nums">
            {typeof r.estimated === "number" ? fmt.format(r.estimated) : "—"}
          </div>
        </div>

        {/* Actual */}
        <div className="col-span-1 text-right">
          <div className="text-sm tabular-nums">
            {typeof r.actual === "number" ? fmt.format(r.actual) : "—"}
          </div>
        </div>

        {/* Variance */}
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

  // For Next CC modal
  const [showCcModal, setShowCcModal] = useState(false);

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
    () => pcrRows.filter((r) => r.target === "CO" || r.target === "VOS" || r.target === "AA"),
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

      {/* Summary + KPIs + Next CC */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard rows={view} />
        <div className="md:col-span-2">
          <ProjectKPIs rows={view} />
        </div>
        <NextCcCard rows={view} onOpenDetails={() => setShowCcModal(true)} />
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
          <Card className="rounded-2xl border shadow-sm mb-6">
            <CardContent className="p-0">
              <section>
                <PathTimeline
                  label="PCRs → EI"
                  stages={["PRC", "CC Outcome", "CEO / Board Memo", "EI"]}
                />

                <ChangeTableHeader />

                {pcrToEiRows.length > 0 ? (
                  pcrToEiRows.map((r) => (
                    <Row
                      key={r.id}
                      r={r}
                      mode="pcr"
                      showMiddleColumn={false}
                    />
                  ))
                ) : (
                  <div className="px-4 py-4 text-xs text-neutral-500">
                    No PCRs currently tagged as PCR → EI under the current
                    filters.
                  </div>
                )}
              </section>
            </CardContent>
          </Card>

          {/* PCR → CO / V / VOS / AA-SA section (Table 2) */}
          <Card className="rounded-2xl border shadow-sm mb-6">
            <CardContent className="p-0">
              <section>
                <PathTimeline
                  label="PCRs → CO / V / VOS / AA-SA"
                  stages={[
                    "PRC",
                    "CC Outcome",
                    "CEO / Board Memo",
                    "CO / V / VOS or AA / SA",
                  ]}
                />

                <ChangeTableHeader />

                {pcrToCoRows.length > 0 ? (
                  pcrToCoRows.map((r) => (
                    <Row
                      key={r.id}
                      r={r}
                      mode="pcr"
                      showMiddleColumn={false}
                    />
                  ))
                ) : (
                  <div className="px-4 py-4 text-xs text-neutral-500">
                    No PCRs currently tagged as PCR → CO / V / VOS / AA-SA after
                    filters.
                  </div>
                )}
              </section>
            </CardContent>
          </Card>

          {/* Completed items section (Table 3) */}
          <Card className="rounded-2xl border shadow-sm mb-6">
            <CardContent className="p-0">
              <section>
                <PathTimeline
                  label="Completed (EI / CO / V / VOS or AA / SA Issued)"
                  stages={[
                    "PRC",
                    "CC Outcome",
                    "CEO / Board Memo",
                    "Issued Item (EI / CO / V / VOS / AA / SA)",
                  ]}
                />

                <CompletedTableHeader />

                {completedRows.length > 0 ? (
                  completedRows.map((r) => <CompletedRow key={r.id} r={r} />)
                ) : (
                  <div className="px-4 py-4 text-xs text-neutral-500">
                    No completed changes under the current filters.
                  </div>
                )}
              </section>
            </CardContent>
          </Card>

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

      {/* Next CC modal (overlay) */}
      {showCcModal && (
        <NextCcModal rows={rows} onClose={() => setShowCcModal(false)} />
      )}
    </div>
  );
}
