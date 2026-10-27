import { alfaLimitCents } from "./lenders/alfa";
import { MIN_TREATMENT_CENTS } from "./schemas";

export function suggestLowerAmount(monthlyIncomeCents: number, treatmentAmountCents: number): number | null {
  const limitCents = alfaLimitCents(monthlyIncomeCents);
  return limitCents < treatmentAmountCents && limitCents >= MIN_TREATMENT_CENTS ? limitCents : null;
}
