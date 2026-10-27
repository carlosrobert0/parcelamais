import type { PatientFormValues } from "@/domain/schemas";

const DRAFT_KEY = "parcelamais:draft";

export const DRAFT_CLEARED_EVENT = "parcelamais:draft-cleared";

export function loadDraft(): Partial<PatientFormValues> | null {
  try {
    const stored = sessionStorage.getItem(DRAFT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveDraft(values: Partial<PatientFormValues>) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  } catch {}
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
  window.dispatchEvent(new Event(DRAFT_CLEARED_EVENT));
}
