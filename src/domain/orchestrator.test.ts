import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LENDERS } from "./lenders";
import type { Lender, LenderInput, LenderResponse } from "./lenders/types";
import { DEADLINE_MS, MAX_DEADLINE_MS } from "./deadline";
import { orchestrate, type LenderOutcome, type OrchestrationOptions } from "./orchestrator";
import { SCENARIO_OVERRIDES } from "./lenders/scenario-overrides";
import type { Scenario } from "./scenarios";

const input: LenderInput = { monthlyIncomeCents: 500_000, treatmentAmountCents: 1_000_000, age: 30 };
const approved: LenderResponse = { status: "approved", approvedAmountCents: 1, monthlyRate: 0.01, terms: [12] };

function slowLender(id: string, ms: number, respond: () => LenderResponse): Lender {
  return {
    id,
    name: id,
    quote: () =>
      new Promise((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(respond());
          } catch (error) {
            reject(error);
          }
        }, ms),
      ),
  };
}

function start(lenders: Lender[], options: Partial<OrchestrationOptions> = {}) {
  const saved: Record<string, LenderOutcome> = {};
  const save = vi.fn(async (lenderId: string, outcome: LenderOutcome) => {
    saved[lenderId] = outcome;
  });
  let finished = false;
  const done = orchestrate(input, { lenders, save, ...options }).then(() => {
    finished = true;
  });
  return { saved, save, done, isFinished: () => finished };
}

describe("orchestrate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("quotes in parallel and saves each outcome as soon as it arrives", async () => {
    const { saved, done } = start([slowLender("a", 1000, () => approved), slowLender("b", 3000, () => approved)]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(Object.keys(saved)).toEqual(["a"]);

    await vi.advanceTimersByTimeAsync(2000);
    await done;
    expect(saved.b).toMatchObject({ status: "approved", latencyMs: 3000 });
  });

  it("finishes as soon as everyone answers, without waiting for the deadline", async () => {
    const { done, isFinished } = start([slowLender("a", 500, () => approved)]);
    await vi.advanceTimersByTimeAsync(500);
    await done;
    expect(isFinished()).toBe(true);
  });

  it("a lender error becomes unavailable/error without affecting the others", async () => {
    const { saved, done } = start([
      slowLender("ok", 1000, () => approved),
      slowLender("broken", 500, () => {
        throw new Error("500");
      }),
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(saved.broken).toEqual({ status: "unavailable", reason: "error", latencyMs: 500 });
    expect(saved.ok.status).toBe("approved");
  });

  it("a synchronous exception in an integration is isolated too", async () => {
    const buggy: Lender = {
      id: "bug",
      name: "Bug",
      quote: () => {
        throw new TypeError("bug");
      },
    };
    const { saved, done } = start([buggy, slowLender("ok", 100, () => approved)]);
    await vi.advanceTimersByTimeAsync(100);
    await done;
    expect(saved.bug).toMatchObject({ status: "unavailable", reason: "error" });
    expect(saved.ok.status).toBe("approved");
  });

  it("whoever misses the 10s deadline becomes unavailable/timeout and the run ends on time", async () => {
    const { saved, done, isFinished } = start([slowLender("fast", 1000, () => approved), slowLender("slow", 15_000, () => approved)]);

    await vi.advanceTimersByTimeAsync(DEADLINE_MS - 1);
    expect(isFinished()).toBe(false);
    expect(saved.slow).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(isFinished()).toBe(true);
    expect(saved.slow).toEqual({ status: "unavailable", reason: "timeout", latencyMs: DEADLINE_MS });
    expect(saved.fast.status).toBe("approved");
  });

  it("a response arriving after the deadline is ignored (never saved again)", async () => {
    const { save, done } = start([slowLender("slow", 15_000, () => approved)]);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    await done;
    expect(save).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith("slow", expect.objectContaining({ reason: "timeout" }));
  });

  it("a failure saving one lender does not stop the others from saving", async () => {
    const saved: string[] = [];
    const save = vi.fn(async (lenderId: string) => {
      if (lenderId === "a") throw new Error("database down");
      saved.push(lenderId);
    });
    const done = orchestrate(input, { lenders: [slowLender("a", 10, () => approved), slowLender("b", 20, () => approved)], save });
    await vi.advanceTimersByTimeAsync(20);
    await expect(done).resolves.toBeUndefined();
    expect(saved).toEqual(["b"]);
  });

  it("gives Delta 15s while every other lender keeps 10s", async () => {
    const { saved, done } = start([slowLender("alfa", 12_000, () => approved), slowLender("delta", 12_000, () => approved)]);
    await vi.advanceTimersByTimeAsync(12_000);
    await done;
    expect(saved.alfa).toEqual({ status: "unavailable", reason: "timeout", latencyMs: DEADLINE_MS });
    expect(saved.delta).toMatchObject({ status: "approved", latencyMs: 12_000 });
  });

  describe("with the real lenders", () => {
    async function runScenario(scenario: Scenario) {
      const run = start(LENDERS, { overrides: SCENARIO_OVERRIDES[scenario] });
      await vi.advanceTimersByTimeAsync(MAX_DEADLINE_MS);
      await run.done;
      return run.saved;
    }

    it("all-approve: all 4 approve before the deadline", async () => {
      const saved = await runScenario("all-approve");
      expect(Object.values(saved).map((outcome) => outcome.status)).toEqual(["approved", "approved", "approved", "approved"]);
      expect(saved.delta.latencyMs).toBe(4500);
    });

    it("delta-fails: Delta unavailable by error, the others approve", async () => {
      const saved = await runScenario("delta-fails");
      expect(saved.delta).toMatchObject({ status: "unavailable", reason: "error" });
      expect([saved.alfa, saved.beta, saved.gama].every((outcome) => outcome.status === "approved")).toBe(true);
    });

    it("delta-timeout: Delta unavailable by timeout at 15s", async () => {
      const saved = await runScenario("delta-timeout");
      expect(saved.delta).toEqual({ status: "unavailable", reason: "timeout", latencyMs: MAX_DEADLINE_MS });
    });

    it("none-approve: all 4 decline", async () => {
      const saved = await runScenario("none-approve");
      expect(Object.values(saved).every((outcome) => outcome.status === "declined")).toBe(true);
    });

    it("random: never exceeds 15s, even when Delta draws its maximum latency", async () => {
      const { saved, done, isFinished } = start(LENDERS, { random: () => 1 });
      await vi.advanceTimersByTimeAsync(MAX_DEADLINE_MS);
      await done;
      expect(isFinished()).toBe(true);
      expect(saved.delta).toEqual({ status: "unavailable", reason: "timeout", latencyMs: MAX_DEADLINE_MS });
      expect([saved.alfa, saved.beta, saved.gama].map((outcome) => outcome.status)).toEqual(["approved", "approved", "approved"]);
    });
  });
});
