import type { Lender, LenderInput, LenderResponse, QuoteContext, ScenarioOverride, Sleep } from "./lenders/types";
import { DEADLINE_MS } from "./deadline";
import type { UnavailableReason } from "./types";

type Unavailable = { status: "unavailable"; reason: UnavailableReason };

export type LenderOutcome = (LenderResponse | Unavailable) & { latencyMs: number };

export interface OrchestrationOptions {
  lenders: Lender[];
  overrides?: Record<string, ScenarioOverride>;
  save: (lenderId: string, outcome: LenderOutcome) => Promise<void>;
  deadlineMs?: number;
  random?: () => number;
  sleep?: Sleep;
  now?: () => number;
}

export async function orchestrate(input: LenderInput, options: OrchestrationOptions): Promise<void> {
  const { lenders, overrides = {}, save, deadlineMs = DEADLINE_MS, random = Math.random, sleep = wait, now = Date.now } =
    options;

  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error("deadline exceeded")), deadlineMs);

  async function quoteLender(lender: Lender) {
    const startedAt = now();
    const context = { override: overrides[lender.id] ?? {}, signal: deadline.signal, random, sleep };
    const response = await quoteOrUnavailable(lender, input, context);
    await save(lender.id, { ...response, latencyMs: Math.round(now() - startedAt) });
  }

  try {
    await Promise.allSettled(lenders.map(quoteLender));
  } finally {
    clearTimeout(timer);
  }
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
