import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreApprovalSchema, fieldErrors, patientSchema } from "./schemas";

const validPatient = {
  name: "Maria da Silva",
  cpf: "529.982.247-25",
  birthDate: "1990-05-10",
  phone: "(11) 98765-4321",
  monthlyIncomeCents: 500_000,
  treatmentAmountCents: 1_000_000,
};

function errorFor(field: keyof typeof validPatient, value: unknown) {
  const result = patientSchema.safeParse({ ...validPatient, [field]: value });
  return result.success ? undefined : fieldErrors(result.error)[field];
}

describe("patientSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a valid patient and normalizes CPF and phone", () => {
    const patient = patientSchema.parse(validPatient);
    expect(patient.cpf).toBe("52998224725");
    expect(patient.phone).toBe("11987654321");
  });

  it("requires first and last name", () => {
    expect(errorFor("name", "Maria")).toBe("Informe nome e sobrenome");
    expect(errorFor("name", "   ")).toBe("Informe o nome completo");
  });

  it("rejects names that are too long, have invisible characters or no real last name", () => {
    expect(errorFor("name", `Maria ${"a".repeat(200)}`)).toBe("Use no máximo 120 caracteres");
    expect(errorFor("name", "Maria\u0000 Silva")).toBe("O nome tem caracteres inválidos");
    expect(errorFor("name", "\u200b \u200b")).toBe("O nome tem caracteres inválidos");
    expect(errorFor("name", "1 2")).toBe("Informe nome e sobrenome");
    expect(errorFor("name", "José D'Ávila")).toBeUndefined();
  });

  it("rejects an invalid CPF with a clear message", () => {
    expect(errorFor("cpf", "529.982.247-26")).toBe("CPF inválido");
  });

  it("age: 18 on the birthday passes, the day before does not", () => {
    expect(errorFor("birthDate", "2008-10-27")).toBeUndefined();
    expect(errorFor("birthDate", "2008-10-28")).toBe("O paciente precisa ter pelo menos 18 anos");
  });

  it("age: 80 passes, 81 does not", () => {
    expect(errorFor("birthDate", "1945-10-28")).toBeUndefined();
    expect(errorFor("birthDate", "1945-10-27")).toBe("O paciente precisa ter no máximo 80 anos");
  });

  it("age uses today in São Paulo: at 01:00 UTC on the 28th it is still the 27th", () => {
    vi.setSystemTime(new Date("2026-10-28T01:00:00Z"));
    expect(errorFor("birthDate", "2008-10-28")).toBe("O paciente precisa ter pelo menos 18 anos");
  });

  it("a non-existent date yields a single message", () => {
    expect(errorFor("birthDate", "2001-02-30")).toBe("Data inválida");
  });

  it("treatment amount between R$ 1.000 and R$ 50.000, inclusive", () => {
    expect(errorFor("treatmentAmountCents", 100_000)).toBeUndefined();
    expect(errorFor("treatmentAmountCents", 5_000_000)).toBeUndefined();
    expect(errorFor("treatmentAmountCents", 99_999)).toBe("O valor mínimo é R$\u00a01.000,00");
    expect(errorFor("treatmentAmountCents", 5_000_001)).toBe("O valor máximo é R$\u00a050.000,00");
  });

  it("income must be informed, positive and fit the database", () => {
    expect(errorFor("monthlyIncomeCents", 0)).toBe("A renda precisa ser maior que zero");
    expect(errorFor("monthlyIncomeCents", undefined)).toBe("Informe a renda mensal");
    expect(errorFor("monthlyIncomeCents", 100_000_000)).toBeUndefined();
    expect(errorFor("monthlyIncomeCents", 3_000_000_000)).toBe("A renda máxima aceita é R$\u00a01.000.000,00");
  });

  it("money only as whole cents", () => {
    expect(errorFor("treatmentAmountCents", 100_000.5)).toBeDefined();
  });

  it("phone needs area code + 9 digits", () => {
    expect(errorFor("phone", "11 8765-4321")).toMatch(/Celular inválido/);
    expect(errorFor("phone", "11987654321")).toBeUndefined();
  });
});

describe("createPreApprovalSchema", () => {
  it("defaults to the random scenario and rejects unknown scenarios", () => {
    expect(createPreApprovalSchema.parse({ patient: validPatient }).scenario).toBe("random");
    expect(createPreApprovalSchema.safeParse({ patient: validPatient, scenario: "xpto" }).success).toBe(false);
  });

  it("reports errors with the field path", () => {
    const result = createPreApprovalSchema.safeParse({ patient: { ...validPatient, cpf: "123" } });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)).toEqual({ "patient.cpf": "CPF inválido" });
  });
});
