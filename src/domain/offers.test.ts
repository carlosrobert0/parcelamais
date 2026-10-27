import { describe, expect, it } from "vitest";
import { buildOffers, sortOffers, type Approval, type Offer } from "./offers";

const alfa: Approval = { lenderId: "alfa", lenderName: "Alfa", approvedAmountCents: 1_000_000, monthlyRate: 0.0249, terms: [6, 12, 18] };
const beta: Approval = { lenderId: "beta", lenderName: "Beta", approvedAmountCents: 600_000, monthlyRate: 0.0199, terms: [12, 18, 24] };

describe("buildOffers", () => {
  it("builds one offer per lender and term, with a Price installment and total = installment × term", () => {
    const offers = buildOffers(1_000_000, [alfa, beta]);
    expect(offers).toHaveLength(6);
    expect(offers.find((offer) => offer.lenderId === "alfa" && offer.term === 12)).toMatchObject({
      installmentCents: 97_428,
      totalCents: 97_428 * 12,
      uncoveredCents: 0,
      totalCostCents: 97_428 * 12,
      partial: false,
    });
  });

  it("flags partial approvals and adds the uncovered amount to the total cost", () => {
    const beta12 = buildOffers(1_000_000, [beta]).find((offer) => offer.term === 12)!;
    expect(beta12).toMatchObject({ partial: true, uncoveredCents: 400_000, totalCostCents: beta12.totalCents + 400_000 });
  });

  it("has no offers without approvals", () => {
    expect(buildOffers(1_000_000, [])).toEqual([]);
  });
});

describe("sortOffers", () => {
  const offer = (lenderName: string, installmentCents: number, totalCostCents: number): Offer => ({
    lenderId: lenderName.toLowerCase(),
    lenderName,
    term: 12,
    monthlyRate: 0.02,
    approvedAmountCents: 0,
    installmentCents,
    totalCents: totalCostCents,
    uncoveredCents: 0,
    totalCostCents,
    partial: false,
  });

  const offers = [offer("Gama", 300, 3000), offer("Alfa", 100, 5000), offer("Beta", 200, 2000), offer("Delta", 100, 4000)];

  it("by lowest installment, breaking ties by lowest total cost", () => {
    expect(sortOffers(offers, "installment").map((o) => o.lenderName)).toEqual(["Delta", "Alfa", "Beta", "Gama"]);
  });

  it("by lowest total cost", () => {
    expect(sortOffers(offers, "total").map((o) => o.lenderName)).toEqual(["Beta", "Gama", "Delta", "Alfa"]);
  });

  it("by lowest total cost, breaking ties by lowest installment", () => {
    expect(sortOffers([offer("Alfa", 200, 1000), offer("Beta", 100, 1000)], "total").map((o) => o.lenderName)).toEqual(["Beta", "Alfa"]);
  });

  it("breaks a full tie by lender name", () => {
    expect(sortOffers([offer("Delta", 100, 1000), offer("Alfa", 100, 1000)], "installment").map((o) => o.lenderName)).toEqual([
      "Alfa",
      "Delta",
    ]);
  });

  it("a partial offer with a smaller financed total does not beat a cheaper full offer on total cost", () => {
    const [alfa6] = buildOffers(1_000_000, [{ ...alfa, terms: [6] }]);
    const [beta24] = buildOffers(1_000_000, [{ ...beta, terms: [24] }]);
    expect(beta24.totalCents).toBe(760_488);
    expect(alfa6.totalCents).toBe(1_088_934);
    expect(sortOffers([beta24, alfa6], "total").map((o) => o.lenderId)).toEqual(["alfa", "beta"]);
  });

  it("does not mutate the input", () => {
    const copy = [...offers];
    sortOffers(offers, "total");
    expect(offers).toEqual(copy);
  });
});
