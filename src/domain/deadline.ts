export const DEADLINE_MS = 10_000;

const LENDER_DEADLINES_MS: Record<string, number> = { delta: 15_000 };

export const MAX_DEADLINE_MS = Math.max(DEADLINE_MS, ...Object.values(LENDER_DEADLINES_MS));

export function lenderDeadlineMs(lenderId: string): number {
  return LENDER_DEADLINES_MS[lenderId] ?? DEADLINE_MS;
}
