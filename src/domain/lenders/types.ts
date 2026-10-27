export interface LenderInput {
  monthlyIncomeCents: number;
  treatmentAmountCents: number;
  age: number;
}

export type LenderResponse =
  | { status: "approved"; approvedAmountCents: number; monthlyRate: number; terms: number[] }
  | { status: "declined"; reason: string };

export interface ScenarioOverride {
  latencyMs?: number;
  force?: "approve" | "decline" | "error";
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface QuoteContext {
  override: ScenarioOverride;
  signal: AbortSignal;
  random: () => number;
  sleep: Sleep;
}

export interface Lender {
  id: string;
  name: string;
  quote(input: LenderInput, context: QuoteContext): Promise<LenderResponse>;
}

export class LenderError extends Error {
  constructor(readonly lenderId: string) {
    super(`${lenderId} responded with HTTP 500`);
  }
}
