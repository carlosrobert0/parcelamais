import { describe, expect, it } from "vitest";
import { isValidCpf } from "./cpf";
import { digitsOnly } from "./text";

describe("isValidCpf", () => {
  it.each(["529.982.247-25", "52998224725", "111.444.777-35", " 111.444.777-35 "])("accepts valid CPF %s", (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it("rejects a wrong first check digit", () => {
    expect(isValidCpf("529.982.247-35")).toBe(false);
  });

  it("rejects a wrong second check digit", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
  });

  it("rejects repeated digits, which pass the checksum but are not real CPFs", () => {
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });

  it.each(["", "5299822472", "529982247250", "529.982.247-2a", "abc52998224725", "529/982/247-25"])(
    "rejects invalid format %j",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    },
  );

  it("turns a remainder of 10 into check digit 0", () => {
    expect(isValidCpf("100.000.001-08")).toBe(true);
  });
});

describe("digitsOnly", () => {
  it("strips the CPF mask", () => {
    expect(digitsOnly("529.982.247-25")).toBe("52998224725");
  });
});
