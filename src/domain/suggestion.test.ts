import { describe, expect, it } from "vitest";
import { suggestLowerAmount } from "./suggestion";

describe("suggestLowerAmount", () => {
  it("suggests income × 10 when it is below the requested amount", () => {
    expect(suggestLowerAmount(300_000, 4_000_000)).toBe(3_000_000);
  });

  it("does not suggest when income × 10 already covers the amount", () => {
    expect(suggestLowerAmount(500_000, 4_000_000)).toBeNull();
  });

  it("does not suggest below the R$ 1.000 minimum", () => {
    expect(suggestLowerAmount(9_999, 500_000)).toBeNull();
    expect(suggestLowerAmount(10_000, 500_000)).toBe(100_000);
  });
});
