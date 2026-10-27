import { describe, expect, it } from "vitest";
import { calculateInstallmentCents } from "./price";

describe("calculateInstallmentCents", () => {
  it.each([
    [1_000_000, 0.01, 12, 88_849],
    [100_000, 0.02, 6, 17_853],
    [1_000_000, 0.0249, 12, 97_428],
    [600_000, 0.0199, 24, 31_687],
    [5_000_000, 0.0219, 36, 202_200],
    [100_000, 0.0329, 6, 18_638],
  ])("principal %i at %f over %i months = %i", (principal, rate, months, expected) => {
    expect(calculateInstallmentCents(principal, rate, months)).toBe(expected);
  });

  it("splits evenly when the rate is zero", () => {
    expect(calculateInstallmentCents(120_000, 0, 12)).toBe(10_000);
  });

  it("pays off the debt: the balance after n installments is within n cents of zero", () => {
    const principal = 1_234_567;
    const rate = 0.0249;
    const months = 18;
    const installment = calculateInstallmentCents(principal, rate, months);
    let balance = principal;
    for (let month = 0; month < months; month++) balance = balance * (1 + rate) - installment;
    expect(Math.abs(balance)).toBeLessThan(months);
  });

  it("a single installment is the principal plus one month of interest", () => {
    expect(calculateInstallmentCents(100_000, 0.02, 1)).toBe(102_000);
  });
});
