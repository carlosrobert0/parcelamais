import { formatBRL } from "../format";
import { createLender } from "./create-lender";

const MIN_AGE = 25;
const MAX_AMOUNT_CENTS = 2_000_000;

export const gama = createLender({
  id: "gama",
  name: "Gama",
  latencyMs: [1_000, 3_000],
  monthlyRate: 0.0329,
  terms: [6, 10, 12],
  evaluate({ age, treatmentAmountCents }) {
    if (age < MIN_AGE) return { approved: false, reason: `Paciente com menos de ${MIN_AGE} anos` };
    if (treatmentAmountCents > MAX_AMOUNT_CENTS) return { approved: false, reason: `Valor acima de ${formatBRL(MAX_AMOUNT_CENTS)}` };
    return { approved: true, approvedAmountCents: treatmentAmountCents };
  },
});
