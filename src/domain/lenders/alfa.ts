import { formatBRL } from "../format";
import { createLender } from "./create-lender";

const INCOME_MULTIPLIER = 10;

export function alfaLimitCents(monthlyIncomeCents: number): number {
  return monthlyIncomeCents * INCOME_MULTIPLIER;
}

export const alfa = createLender({
  id: "alfa",
  name: "Alfa",
  latencyMs: [500, 1_500],
  monthlyRate: 0.0249,
  terms: [6, 12, 18],
  evaluate({ monthlyIncomeCents, treatmentAmountCents }) {
    const limitCents = alfaLimitCents(monthlyIncomeCents);
    if (limitCents >= treatmentAmountCents) {
      return { approved: true, approvedAmountCents: treatmentAmountCents };
    }
    return { approved: false, reason: `Renda × 10 (${formatBRL(limitCents)}) é menor que o valor do tratamento` };
  },
});
