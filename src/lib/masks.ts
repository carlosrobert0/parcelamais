import { digitsOnly } from "@/domain/text";

const CPF_DIGITS = 11;
const PHONE_DIGITS = 11;
const MAX_CURRENCY_DIGITS = 9;
const BRAZIL_COUNTRY_CODE = "55";
const TRUNK_PREFIX = "0";

export function maskCpf(value: string): string {
  return digitsOnly(value)
    .slice(0, CPF_DIGITS)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskPhone(value: string): string {
  return withoutPrefixes(digitsOnly(value))
    .slice(0, PHONE_DIGITS)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function centsFromInput(value: string): number | undefined {
  const cents = Number(digitsOnly(value).slice(0, MAX_CURRENCY_DIGITS));
  return cents > 0 ? cents : undefined;
}

function withoutPrefixes(digits: string): string {
  if (digits.length <= PHONE_DIGITS) return digits;
  if (digits.startsWith(BRAZIL_COUNTRY_CODE)) return digits.slice(BRAZIL_COUNTRY_CODE.length);
  if (digits.startsWith(TRUNK_PREFIX)) return digits.slice(TRUNK_PREFIX.length);
  return digits;
}
