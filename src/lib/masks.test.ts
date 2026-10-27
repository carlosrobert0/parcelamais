import { describe, expect, it } from "vitest";
import { centsFromInput, maskCpf, maskPhone } from "./masks";

describe("maskCpf", () => {
  it("formats progressively and caps at 11 digits", () => {
    expect(maskCpf("529")).toBe("529");
    expect(maskCpf("5299822")).toBe("529.982.2");
    expect(maskCpf("529982247251234")).toBe("529.982.247-25");
  });
});

describe("maskPhone", () => {
  it("formats a mobile number", () => {
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("drops the +55 country code when pasted", () => {
    expect(maskPhone("+55 11 98765-4321")).toBe("(11) 98765-4321");
  });

  it("drops the leading 0 of a long-distance prefix", () => {
    expect(maskPhone("011 98765-4321")).toBe("(11) 98765-4321");
  });
});

describe("centsFromInput", () => {
  it("reads typed digits as cents", () => {
    expect(centsFromInput("R$ 1.234,56")).toBe(123_456);
  });

  it("returns undefined when only zeros are left, so the field can be cleared", () => {
    expect(centsFromInput("R$ 0,0")).toBeUndefined();
    expect(centsFromInput("")).toBeUndefined();
  });
});
