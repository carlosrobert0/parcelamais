import type { Scenario } from "../scenarios";
import { DELTA_MAX_LATENCY_MS } from "./delta";
import { LENDERS } from "./index";
import type { ScenarioOverride } from "./types";

const DEFAULT_FORCED_LATENCY_MS = 1_000;
const FORCED_LATENCY_MS: Record<string, number> = { alfa: 800, beta: 2_500, gama: 1_500, delta: 4_500 };

type Overrides = Record<string, ScenarioOverride>;

function forceAll(force: ScenarioOverride["force"]): Overrides {
  return Object.fromEntries(
    LENDERS.map((lender) => [lender.id, { latencyMs: FORCED_LATENCY_MS[lender.id] ?? DEFAULT_FORCED_LATENCY_MS, force }]),
  );
}

export const SCENARIO_OVERRIDES: Record<Scenario, Overrides> = {
  random: {},
  "all-approve": forceAll("approve"),
  "delta-fails": { ...forceAll("approve"), delta: { latencyMs: FORCED_LATENCY_MS.delta, force: "error" } },
  "delta-timeout": { ...forceAll("approve"), delta: { latencyMs: DELTA_MAX_LATENCY_MS, force: "approve" } },
  "none-approve": forceAll("decline"),
};
