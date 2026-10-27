import { createLender } from "./create-lender";

const MAX_APPROVAL_PERCENT = 60;

export const beta = createLender({
  id: "beta",
  name: "Beta",
  latencyMs: [2_000, 5_000],
  monthlyRate: 0.0199,
  terms: [12, 18, 24],
  evaluate({ treatmentAmountCents }) {
    return { approved: true, approvedAmountCents: Math.floor((treatmentAmountCents * MAX_APPROVAL_PERCENT) / 100) };
  },
});
