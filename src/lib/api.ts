import type { Scenario } from "@/domain/scenarios";
import type { Patient, SelectionRequest } from "@/domain/schemas";
import type { PreApproval, Selection } from "@/domain/types";

interface ErrorBody {
  error?: string;
  errors?: Record<string, string>;
  selection?: Selection;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorBody | null,
  ) {
    super(body?.error ?? `HTTP ${status}`);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}

export const api = {
  createPreApproval: (patient: Patient, scenario: Scenario) =>
    request<{ id: string }>("/api/pre-approvals", { method: "POST", body: JSON.stringify({ patient, scenario }) }),

  getPreApproval: (id: string) => request<PreApproval>(`/api/pre-approvals/${id}`),

  selectOffer: (id: string, selection: SelectionRequest) =>
    request<Selection>(`/api/pre-approvals/${id}/selection`, { method: "POST", body: JSON.stringify(selection) }),
};
