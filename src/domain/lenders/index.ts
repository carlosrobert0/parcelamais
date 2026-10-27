import { alfa } from "./alfa";
import { beta } from "./beta";
import { delta } from "./delta";
import { gama } from "./gama";
import type { Lender } from "./types";

export const LENDERS: Lender[] = [alfa, beta, gama, delta];

export function lenderName(lenderId: string): string {
  return LENDERS.find((lender) => lender.id === lenderId)?.name ?? lenderId;
}
