import { z } from "zod";
import { ageToday, isValidIsoDate } from "./age";
import { isValidCpf } from "./cpf";
import { formatBRL } from "./format";
import { SCENARIOS } from "./scenarios";
import { digitsOnly } from "./text";

z.config(z.locales.ptBR());

export const MIN_TREATMENT_CENTS = 100_000;
export const MAX_TREATMENT_CENTS = 5_000_000;
export const MIN_AGE = 18;
export const MAX_AGE = 80;
export const MAX_NAME_LENGTH = 120;
const MAX_MONTHLY_INCOME_CENTS = 100_000_000;

const MOBILE_PHONE = /^[1-9]{2}9\d{8}$/;
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/u;
const WORD_WITH_LETTER = /\p{L}/u;

const hasFirstAndLastName = (name: string) => name.split(/\s+/).filter((word) => WORD_WITH_LETTER.test(word)).length >= 2;

export const patientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome completo")
    .max(MAX_NAME_LENGTH, `Use no máximo ${MAX_NAME_LENGTH} caracteres`)
    .refine((name) => !INVISIBLE_CHARACTERS.test(name), { error: "O nome tem caracteres inválidos", abort: true })
    .refine(hasFirstAndLastName, "Informe nome e sobrenome"),
  cpf: z
    .string()
    .min(1, "Informe o CPF")
    .refine(isValidCpf, { error: "CPF inválido", abort: true })
    .transform(digitsOnly),
  birthDate: z
    .string()
    .min(1, "Informe a data de nascimento")
    .refine(isValidIsoDate, { error: "Data inválida", abort: true })
    .refine((date) => ageToday(date) >= MIN_AGE, `O paciente precisa ter pelo menos ${MIN_AGE} anos`)
    .refine((date) => ageToday(date) <= MAX_AGE, `O paciente precisa ter no máximo ${MAX_AGE} anos`),
  phone: z
    .string()
    .min(1, "Informe o celular")
    .transform(digitsOnly)
    .refine((phone) => MOBILE_PHONE.test(phone), "Celular inválido: DDD + 9 dígitos, começando com 9"),
  monthlyIncomeCents: z
    .number({ error: "Informe a renda mensal" })
    .int()
    .positive("A renda precisa ser maior que zero")
    .max(MAX_MONTHLY_INCOME_CENTS, `A renda máxima aceita é ${formatBRL(MAX_MONTHLY_INCOME_CENTS)}`),
  treatmentAmountCents: z
    .number({ error: "Informe o valor do tratamento" })
    .int()
    .min(MIN_TREATMENT_CENTS, `O valor mínimo é ${formatBRL(MIN_TREATMENT_CENTS)}`)
    .max(MAX_TREATMENT_CENTS, `O valor máximo é ${formatBRL(MAX_TREATMENT_CENTS)}`),
});

export type Patient = z.output<typeof patientSchema>;
export type PatientFormValues = z.input<typeof patientSchema>;

export const createPreApprovalSchema = z.object({
  patient: patientSchema,
  scenario: z.enum(SCENARIOS, { error: "Cenário inválido" }).default("random"),
});

export type CreatePreApprovalRequest = z.output<typeof createPreApprovalSchema>;

export const selectionSchema = z.object({
  lenderId: z.string({ error: "Informe a financeira" }).min(1, "Informe a financeira"),
  term: z.number({ error: "Informe o prazo" }).int("Prazo inválido").positive("Prazo inválido"),
});

export type SelectionRequest = z.output<typeof selectionSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path.join(".") || "_"] ??= issue.message;
  }
  return errors;
}
