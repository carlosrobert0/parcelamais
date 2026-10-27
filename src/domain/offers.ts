import { calculateInstallmentCents } from "./price";

export interface Approval {
  lenderId: string;
  lenderName: string;
  approvedAmountCents: number;
  monthlyRate: number;
  terms: number[];
}

export interface Offer {
  lenderId: string;
  lenderName: string;
  term: number;
  monthlyRate: number;
  approvedAmountCents: number;
  installmentCents: number;
  totalCents: number;
  uncoveredCents: number;
  totalCostCents: number;
  partial: boolean;
}

export type SortOrder = "installment" | "total";

export function buildOffers(treatmentAmountCents: number, approvals: Approval[]): Offer[] {
  return approvals.flatMap((approval) =>
    approval.terms.map((term) => {
      const installmentCents = calculateInstallmentCents(approval.approvedAmountCents, approval.monthlyRate, term);
      const totalCents = installmentCents * term;
      const uncoveredCents = treatmentAmountCents - approval.approvedAmountCents;
      return {
        lenderId: approval.lenderId,
        lenderName: approval.lenderName,
        term,
        monthlyRate: approval.monthlyRate,
        approvedAmountCents: approval.approvedAmountCents,
        installmentCents,
        totalCents,
        uncoveredCents,
        totalCostCents: totalCents + uncoveredCents,
        partial: uncoveredCents > 0,
      };
    }),
  );
}

export function sortOffers(offers: Offer[], order: SortOrder): Offer[] {
  const [primary, secondary] =
    order === "installment" ? (["installmentCents", "totalCostCents"] as const) : (["totalCostCents", "installmentCents"] as const);

  return [...offers].sort(
    (a, b) => a[primary] - b[primary] || a[secondary] - b[secondary] || a.lenderName.localeCompare(b.lenderName),
  );
}
