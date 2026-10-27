import { createLender } from "./create-lender";

export const DELTA_MAX_LATENCY_MS = 15_000;

export const delta = createLender({
  id: "delta",
  name: "Delta",
  latencyMs: [4_000, DELTA_MAX_LATENCY_MS],
  monthlyRate: 0.0219,
  terms: [12, 24, 36],
  errorRate: 0.3,
  evaluate({ treatmentAmountCents }) {
    return { approved: true, approvedAmountCents: treatmentAmountCents };
  },
});
