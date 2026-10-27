import { describe, expect, it, vi } from "vitest";
import { alfa } from "./alfa";
import { beta } from "./beta";
import { FORCED_DECLINE_REASON } from "./create-lender";
import { delta } from "./delta";
import { gama } from "./gama";
import { LenderError, type Lender, type LenderInput, type ScenarioOverride, type Sleep } from "./types";

const baseInput: LenderInput = { monthlyIncomeCents: 500_000, treatmentAmountCents: 1_000_000, age: 30 };

function quote(lender: Lender, changes: Partial<LenderInput> = {}, override: ScenarioOverride = {}, random = () => 0.5) {
  const sleep = vi.fn<Sleep>(async () => {});
  const response = lender.quote({ ...baseInput, ...changes }, { override, random, sleep, signal: new AbortController().signal });
  return { response, sleep };
}

describe.each([
  { lender: alfa, minMs: 500, maxMs: 1500, approved: { approvedAmountCents: 1_000_000, monthlyRate: 0.0249, terms: [6, 12, 18] } },
  { lender: beta, minMs: 2000, maxMs: 5000, approved: { approvedAmountCents: 600_000, monthlyRate: 0.0199, terms: [12, 18, 24] } },
  { lender: gama, minMs: 1000, maxMs: 3000, approved: { approvedAmountCents: 1_000_000, monthlyRate: 0.0329, terms: [6, 10, 12] } },
  { lender: delta, minMs: 4000, maxMs: 15000, approved: { approvedAmountCents: 1_000_000, monthlyRate: 0.0219, terms: [12, 24, 36] } },
])("$lender.name", ({ lender, minMs, maxMs, approved }) => {
  it("approves with the rate and terms from the statement", async () => {
    await expect(quote(lender).response).resolves.toEqual({ status: "approved", ...approved });
  });

  it(`answers between ${minMs} and ${maxMs} ms`, async () => {
    const fastest = quote(lender, {}, {}, () => 0);
    await fastest.response.catch(() => {});
    expect(fastest.sleep).toHaveBeenCalledWith(minMs, expect.anything());

    const slowest = quote(lender, {}, {}, () => 0.999999);
    await slowest.response.catch(() => {});
    expect(slowest.sleep.mock.calls[0][0]).toBeCloseTo(maxMs, 0);
  });
});

describe("Alfa", () => {
  it("approves 100% when income × 10 equals the amount", async () => {
    await expect(quote(alfa, { monthlyIncomeCents: 100_000, treatmentAmountCents: 1_000_000 }).response).resolves.toMatchObject({
      status: "approved",
      approvedAmountCents: 1_000_000,
    });
  });

  it("declines when income × 10 is one cent short", async () => {
    await expect(quote(alfa, { monthlyIncomeCents: 100_000, treatmentAmountCents: 1_000_001 }).response).resolves.toEqual({
      status: "declined",
      reason: expect.stringContaining("Renda × 10"),
    });
  });
});

describe("Beta", () => {
  it("always approves at most 60%, rounding down", async () => {
    await expect(quote(beta, { treatmentAmountCents: 100_001 }).response).resolves.toMatchObject({ approvedAmountCents: 60_000 });
  });

  it("approves even with low income and young age", async () => {
    await expect(quote(beta, { monthlyIncomeCents: 1, age: 18 }).response).resolves.toMatchObject({ status: "approved" });
  });
});

describe("Gama", () => {
  it("declines at 24 and approves at 25", async () => {
    await expect(quote(gama, { age: 24 }).response).resolves.toEqual({ status: "declined", reason: "Paciente com menos de 25 anos" });
    await expect(quote(gama, { age: 25 }).response).resolves.toMatchObject({ status: "approved" });
  });

  it("approves R$ 20.000,00 and declines R$ 20.000,01", async () => {
    await expect(quote(gama, { treatmentAmountCents: 2_000_000 }).response).resolves.toMatchObject({ status: "approved" });
    await expect(quote(gama, { treatmentAmountCents: 2_000_001 }).response).resolves.toEqual({
      status: "declined",
      reason: "Valor acima de R$\u00a020.000,00",
    });
  });
});

describe("Delta", () => {
  it("fails with HTTP 500 when the draw falls within 30%", async () => {
    const random = vi.fn().mockReturnValueOnce(0.5).mockReturnValueOnce(0.29);
    await expect(quote(delta, {}, {}, random).response).rejects.toBeInstanceOf(LenderError);
  });

  it("approves when the draw falls outside 30%", async () => {
    const random = vi.fn().mockReturnValueOnce(0.5).mockReturnValueOnce(0.3);
    await expect(quote(delta, {}, {}, random).response).resolves.toMatchObject({ status: "approved" });
  });
});

describe("scenario overrides", () => {
  it("a fixed latency replaces the draw", async () => {
    const { response, sleep } = quote(delta, {}, { latencyMs: 15_000, force: "approve" });
    await response;
    expect(sleep).toHaveBeenCalledWith(15_000, expect.anything());
  });

  it("forcing approval skips the decline rule", async () => {
    await expect(quote(gama, { age: 18 }, { force: "approve" }).response).resolves.toMatchObject({
      status: "approved",
      approvedAmountCents: 1_000_000,
    });
  });

  it("forcing approval keeps the lender's own limit (Beta stays at 60%)", async () => {
    await expect(quote(beta, {}, { force: "approve" }).response).resolves.toMatchObject({ approvedAmountCents: 600_000 });
  });

  it("forcing a decline keeps the real reason when the rule would also decline", async () => {
    await expect(quote(gama, { age: 20 }, { force: "decline" }).response).resolves.toEqual({
      status: "declined",
      reason: "Paciente com menos de 25 anos",
    });
  });

  it("forcing a decline on a lender that would approve uses the demo reason", async () => {
    await expect(quote(beta, {}, { force: "decline" }).response).resolves.toEqual({ status: "declined", reason: FORCED_DECLINE_REASON });
  });

  it("forcing an error always fails, and forcing approval disables Delta's random error", async () => {
    await expect(quote(alfa, {}, { force: "error" }).response).rejects.toBeInstanceOf(LenderError);
    await expect(quote(delta, {}, { force: "approve" }, () => 0).response).resolves.toMatchObject({ status: "approved" });
  });
});
