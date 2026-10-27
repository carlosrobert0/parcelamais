import { STEPS, type StepId } from "./steps";

const STEP_PARAM = "step";
const AMOUNT_PARAM = "amount";
const DEMO_PARAM = "demo";
const DEMO_ENABLED = "1";

interface RegistrationParams {
  step?: StepId;
  amountCents?: number | null;
  demo?: boolean;
}

type SearchParams = Record<string, string | string[] | undefined>;

const isStepId = (value: unknown): value is StepId => STEPS.some((step) => step.id === value);

export function registrationUrl({ step, amountCents, demo }: RegistrationParams = {}): string {
  const params = new URLSearchParams();
  if (step) params.set(STEP_PARAM, step);
  if (amountCents) params.set(AMOUNT_PARAM, String(amountCents));
  if (demo) params.set(DEMO_PARAM, DEMO_ENABLED);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function parseRegistrationParams(searchParams: SearchParams): Required<Pick<RegistrationParams, "demo">> & RegistrationParams {
  const step = searchParams[STEP_PARAM];
  const amountCents = Number(searchParams[AMOUNT_PARAM]);
  return {
    step: isStepId(step) ? step : undefined,
    amountCents: Number.isInteger(amountCents) && amountCents > 0 ? amountCents : undefined,
    demo: searchParams[DEMO_PARAM] === DEMO_ENABLED,
  };
}
