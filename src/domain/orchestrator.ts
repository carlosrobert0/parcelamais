import type { Lender, LenderInput, LenderResponse, QuoteContext, ScenarioOverride, Sleep } from "./lenders/types";
import { lenderDeadlineMs } from "./deadline";
import type { UnavailableReason } from "./types";

type Unavailable = { status: "unavailable"; reason: UnavailableReason };

export type LenderOutcome = (LenderResponse | Unavailable) & { latencyMs: number };

export interface OrchestrationOptions {
  lenders: Lender[];
  overrides?: Record<string, ScenarioOverride>;
  save: (lenderId: string, outcome: LenderOutcome) => Promise<void>;
  random?: () => number;
  sleep?: Sleep;
  now?: () => number;
  deadlineMarginMs?: number;
}

export async function orchestrate(input: LenderInput, options: OrchestrationOptions): Promise<void> {
  const { lenders, overrides = {}, save, deadlineMarginMs = 0, random = Math.random, sleep = wait, now = Date.now } =
    options;

  async function quoteLender(lender: Lender) {
    const deadline = new AbortController();
    const deadlineMs = Math.max(0, lenderDeadlineMs(lender.id) - deadlineMarginMs);
    const timer = setTimeout(() => deadline.abort(new Error("deadline exceeded")), deadlineMs);
    const startedAt = now();
    const context = { override: overrides[lender.id] ?? {}, signal: deadline.signal, random, sleep };
    const response = await quoteOrUnavailable(lender, input, context).finally(() => clearTimeout(timer));
    await save(lender.id, { ...response, latencyMs: Math.round(now() - startedAt) });
  }

  await Promise.allSettled(lenders.map(quoteLender));
}

async function quoteOrUnavailable(lender: Lender, input: LenderInput, context: QuoteContext): Promise<LenderResponse | Unavailable> {
  try {
    return await withinDeadline(lender.quote(input, context), context.signal);
  } catch {
    return { status: "unavailable", reason: context.signal.aborted ? "timeout" : "error" };
  }
}

function withinDeadline<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

const wait: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
