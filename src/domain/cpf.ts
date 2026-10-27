import { digitsOnly } from "./text";

const CPF_FORMAT = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

export function isValidCpf(value: string): boolean {
  if (!CPF_FORMAT.test(value.trim())) return false;

  const digits = digitsOnly(value).split("").map(Number);
  if (digits.every((digit) => digit === digits[0])) return false;

  return checkDigit(digits, 9) === digits[9] && checkDigit(digits, 10) === digits[10];
}

function checkDigit(digits: number[], length: number): number {
  const sum = digits.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}
