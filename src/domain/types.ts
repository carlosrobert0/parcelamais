import type { Offer } from "./offers";
import type { Scenario } from "./scenarios";

export const PRE_APPROVAL_STATUSES = ["pending", "completed"] as const;
export const LENDER_STATUSES = ["pending", "approved", "declined", "unavailable"] as const;

export type LenderStatus = (typeof LENDER_STATUSES)[number];
export type UnavailableReason = "error" | "timeout";

export interface LenderResult {
  lenderId: string;
  lenderName: string;
  status: LenderStatus;
  reason: string | null;
  approvedAmountCents: number | null;
  monthlyRate: number | null;
  terms: number[] | null;
  latencyMs: number | null;
}

export interface Selection {
  lenderId: string;
  lenderName: string;
  term: number;
  installmentCents: number;
  totalCents: number;
  uncoveredCents: number;
  selectedAt: string;
}

export interface PreApproval {
  id: string;
  status: (typeof PRE_APPROVAL_STATUSES)[number];
  scenario: Scenario;
  treatmentAmountCents: number;
  createdAt: string;
  deadlineAt: string;
  results: LenderResult[];
  offers: Offer[];
  selection: Selection | null;
  suggestedAmountCents: number | null;
}
