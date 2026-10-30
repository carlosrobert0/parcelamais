import { setTimeout as sleep } from "node:timers/promises";
import { ageToday } from "@/domain/age";
import { MAX_DEADLINE_MS } from "@/domain/deadline";
import { LENDERS } from "@/domain/lenders";
import { SCENARIO_OVERRIDES } from "@/domain/lenders/scenario-overrides";
import type { LenderInput } from "@/domain/lenders/types";
import { orchestrate, type LenderOutcome, type OrchestrationOptions } from "@/domain/orchestrator";
import type { Scenario } from "@/domain/scenarios";
import type { CreatePreApprovalRequest, Patient } from "@/domain/schemas";
import { errorSummary, logger } from "./logger";
import { completePreApproval, createPreApproval, saveLenderOutcome } from "./repository";
import { retry } from "./retry";

const SAVE_MARGIN_MS = 200;
const SAVE_ATTEMPTS = 3;
const SAVE_RETRY_DELAY_MS = 50;

type RunOptions = Pick<OrchestrationOptions, "sleep" | "random">;

interface PreApprovalRun {
  id: string;
  input: LenderInput;
  scenario: Scenario;
  deadlineAt: number;
}

export async function startPreApproval({ patient, scenario }: CreatePreApprovalRequest) {
  const { treatmentAmountCents, ...patientData } = patient;
  const input = toLenderInput(patient);
  const { id, createdAt } = await createPreApproval({ patient: patientData, treatmentAmountCents, age: input.age, scenario });
  const run: PreApprovalRun = { id, input, scenario, deadlineAt: createdAt.getTime() + MAX_DEADLINE_MS };
  return { id, run: (options?: RunOptions) => runPreApproval(run, options) };
}

async function runPreApproval({ id, input, scenario, deadlineAt }: PreApprovalRun, options: RunOptions = {}) {
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  const deadlineTimer = new AbortController();

  try {
    await Promise.race([
      orchestrate(input, {
        ...options,
        lenders: LENDERS,
        overrides: SCENARIO_OVERRIDES[scenario],
        deadlineMarginMs: MAX_DEADLINE_MS - remainingMs + SAVE_MARGIN_MS,
        save: (lenderId, outcome) => saveAndLog(id, lenderId, outcome),
      }),
      sleep(remainingMs, undefined, { signal: deadlineTimer.signal }).catch(() => {}),
    ]);
  } finally {
    deadlineTimer.abort();
    await completePreApproval(id);
    logger.info({ preApprovalId: id, scenario }, "pre-approval completed");
  }
}

function toLenderInput(patient: Patient): LenderInput {
  return {
    monthlyIncomeCents: patient.monthlyIncomeCents,
    treatmentAmountCents: patient.treatmentAmountCents,
    age: ageToday(patient.birthDate),
  };
}

async function saveAndLog(preApprovalId: string, lenderId: string, outcome: LenderOutcome) {
  const reason = outcome.status === "approved" ? undefined : outcome.reason;
  logger.info({ preApprovalId, lenderId, status: outcome.status, reason, latencyMs: outcome.latencyMs }, "lender responded");

  await retry(() => saveLenderOutcome(preApprovalId, lenderId, outcome), {
    attempts: SAVE_ATTEMPTS,
    delayMs: SAVE_RETRY_DELAY_MS,
    onRetry: (attempt, error) => logger.warn({ preApprovalId, lenderId, attempt, ...errorSummary(error) }, "could not save lender outcome"),
  }).catch((error) => {
    logger.error({ preApprovalId, lenderId, ...errorSummary(error) }, "gave up saving lender outcome");
    throw error;
  });
}
