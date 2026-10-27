import { describe, expect, it } from "vitest";
import { calculateAge, isValidIsoDate, todayInSaoPaulo } from "./age";

describe("calculateAge", () => {
  it("turns 18 exactly on the birthday", () => {
    expect(calculateAge("2008-10-27", "2026-10-27")).toBe(18);
  });

  it("is still 17 the day before the birthday", () => {
    expect(calculateAge("2008-10-28", "2026-10-27")).toBe(17);
  });

  it("is 80 until the day before turning 81", () => {
    expect(calculateAge("1945-10-28", "2026-10-27")).toBe(80);
    expect(calculateAge("1945-10-27", "2026-10-27")).toBe(81);
  });

  it("counts a birthday in an earlier month", () => {
    expect(calculateAge("2000-01-15", "2026-10-27")).toBe(26);
  });

  it("a leap-day birth has its birthday on March 1st in common years", () => {
    expect(calculateAge("2008-02-29", "2026-02-28")).toBe(17);
    expect(calculateAge("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("a leap-day birth has its birthday on February 29th in leap years", () => {
    expect(calculateAge("2010-02-28", "2028-02-28")).toBe(18);
    expect(calculateAge("2008-02-29", "2028-02-29")).toBe(20);
  });
});

describe("isValidIsoDate", () => {
  it.each(["2000-01-31", "2024-02-29"])("accepts %s", (date) => expect(isValidIsoDate(date)).toBe(true));

  it.each(["2023-02-29", "2000-02-30", "2000-13-01", "2000-1-1", "01/01/2000", ""])("rejects %j", (date) =>
    expect(isValidIsoDate(date)).toBe(false),
  );
});

describe("todayInSaoPaulo", () => {
  it("uses the São Paulo timezone, not UTC", () => {
    expect(todayInSaoPaulo(new Date("2026-10-28T01:00:00Z"))).toBe("2026-10-27");
  });
});
