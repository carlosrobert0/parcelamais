import { lenderDeadlineMs } from "@/domain/deadline";
import type { LenderResult, LenderStatus } from "@/domain/types";

export const STATUS_LABELS: Record<LenderStatus, string> = {
  pending: "Consultando…",
  approved: "Aprovada",
  declined: "Recusada",
  unavailable: "Indisponível",
};

export function reasonMessage(result: LenderResult): string | null {
  if (result.status !== "unavailable") return result.reason;
  if (result.reason === "timeout") return `Não respondeu dentro de ${lenderDeadlineMs(result.lenderId) / 1000} segundos`;
  return "Erro na comunicação com a financeira";
}
