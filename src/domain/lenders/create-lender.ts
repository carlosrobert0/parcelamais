import { LenderError, type Lender, type LenderInput, type ScenarioOverride } from "./types";

type Evaluation = { approved: true; approvedAmountCents: number } | { approved: false; reason: string };

interface LenderDefinition {
  id: string;
  name: string;
  latencyMs: [min: number, max: number];
  monthlyRate: number;
  terms: number[];
  errorRate?: number;
  evaluate(input: LenderInput): Evaluation;
}

export const FORCED_DECLINE_REASON = "Recusa forçada pelo cenário de demonstração";

export function createLender(definition: LenderDefinition): Lender {
  const [minLatencyMs, maxLatencyMs] = definition.latencyMs;

  return {
    id: definition.id,
    name: definition.name,
    async quote(input, { override, signal, random, sleep }) {
      await sleep(override.latencyMs ?? minLatencyMs + random() * (maxLatencyMs - minLatencyMs), signal);

      if (shouldFail(override, definition.errorRate ?? 0, random)) throw new LenderError(definition.id);

      const evaluation = definition.evaluate(input);
      if (override.force === "decline") {
        return { status: "declined", reason: evaluation.approved ? FORCED_DECLINE_REASON : evaluation.reason };
      }
      if (!evaluation.approved && override.force !== "approve") {
        return { status: "declined", reason: evaluation.reason };
      }

      return {
        status: "approved",
        approvedAmountCents: evaluation.approved ? evaluation.approvedAmountCents : input.treatmentAmountCents,
        monthlyRate: definition.monthlyRate,
        terms: definition.terms,
      };
    },
  };
}

function shouldFail(override: ScenarioOverride, errorRate: number, random: () => number): boolean {
  return override.force ? override.force === "error" : random() < errorRate;
}
