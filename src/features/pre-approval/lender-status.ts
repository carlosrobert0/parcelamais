import { DEADLINE_MS } from "@/domain/deadline";
import type { LenderResult, LenderStatus, UnavailableReason } from "@/domain/types";

export const STATUS_LABELS: Record<LenderStatus, string> = {
  pending: "Consultando…",
  approved: "Aprovada",
  declined: "Recusada",
  unavailable: "Indisponível",
};

const UNAVAILABLE_MESSAGES: Record<UnavailableReason, string> = {
  timeout: `Não respondeu dentro de ${DEADLINE_MS / 1000} segundos`,
  error: "Erro na comunicação com a financeira",
};

export function reasonMessage(result: LenderResult): string | null {
  if (result.status !== "unavailable") return result.reason;
  return UNAVAILABLE_MESSAGES[result.reason === "timeout" ? "timeout" : "error"];
}
