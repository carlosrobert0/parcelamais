export function calculateInstallmentCents(principalCents: number, monthlyRate: number, installments: number): number {
  if (monthlyRate === 0) return Math.round(principalCents / installments);
  const factor = monthlyRate / (1 - Math.pow(1 + monthlyRate, -installments));
  return Math.round(principalCents * factor);
}
