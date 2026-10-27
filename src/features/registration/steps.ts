import type { PatientFormValues } from "@/domain/schemas";

export const STEPS = [
  { id: "personal", title: "Dados pessoais", fields: ["name", "cpf", "birthDate", "phone"] },
  { id: "financial", title: "Dados financeiros", fields: ["monthlyIncomeCents", "treatmentAmountCents"] },
  { id: "review", title: "Revisão", fields: [] },
] as const satisfies readonly { id: string; title: string; fields: readonly (keyof PatientFormValues)[] }[];

export type StepId = (typeof STEPS)[number]["id"];

export const LAST_STEP = STEPS.length - 1;

export function stepIndex(stepId: StepId): number {
  return STEPS.findIndex((step) => step.id === stepId);
}

export function stepOfFields(fields: string[]): number {
  return STEPS.findIndex((step) => step.fields.some((field) => fields.includes(field)));
}
