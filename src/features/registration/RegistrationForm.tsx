"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, type DefaultValues, type FieldErrors } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { FieldGroup } from "@/components/ui/field";
import { DEADLINE_MS } from "@/domain/deadline";
import { formatBRL } from "@/domain/format";
import type { Scenario } from "@/domain/scenarios";
import {
  MAX_AGE,
  MAX_NAME_LENGTH,
  MAX_TREATMENT_CENTS,
  MIN_AGE,
  MIN_TREATMENT_CENTS,
  patientSchema,
  type Patient,
  type PatientFormValues,
} from "@/domain/schemas";
import { api, ApiError } from "@/lib/api";
import { maskCpf, maskPhone } from "@/lib/masks";
import { CurrencyField, TextField } from "./FormFields";
import { ReviewStep } from "./ReviewStep";
import { LAST_STEP, STEPS, stepIndex, stepOfFields, type StepId } from "./steps";
import { registrationUrl } from "./urls";
import { useDraftPersistence } from "./useDraftPersistence";
import { useStepFocus } from "./useStepFocus";

type FieldName = keyof PatientFormValues;

const EMPTY_VALUES: DefaultValues<PatientFormValues> = {
  name: "",
  cpf: "",
  birthDate: "",
  phone: "",
  monthlyIncomeCents: undefined,
  treatmentAmountCents: undefined,
};
const PATIENT_FIELDS = Object.keys(patientSchema.shape);
const SUBMIT_ERROR = "Não foi possível iniciar a consulta. Verifique a conexão e tente de novo.";
const DEADLINE_SECONDS = DEADLINE_MS / 1000;

const isPatientField = (field: string): field is FieldName => PATIENT_FIELDS.includes(field);

interface RegistrationFormProps {
  showScenario?: boolean;
  initialStep?: StepId;
  suggestedAmountCents?: number;
}

export function RegistrationForm({ showScenario = false, initialStep = "personal", suggestedAmountCents }: RegistrationFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(() => stepIndex(initialStep));
  const [scenario, setScenario] = useState<Scenario>("random");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const submitErrorRef = useRef<HTMLDivElement>(null);

  const form = useForm<PatientFormValues, unknown, Patient>({
    resolver: zodResolver(patientSchema),
    mode: "onTouched",
    defaultValues: EMPTY_VALUES,
  });
  const { headingRef, focusFieldAfterStepChange } = useStepFocus(step, form.setFocus);

  useDraftPersistence({
    form,
    emptyValues: EMPTY_VALUES,
    suggestedAmountCents,
    onStartOver: () => {
      setStep(0);
      setSubmitError(null);
    },
  });

  useEffect(() => {
    if (suggestedAmountCents) router.replace(registrationUrl({ step: initialStep, demo: showScenario }));
  }, [suggestedAmountCents, initialStep, showScenario, router]);

  useEffect(() => {
    if (submitError) submitErrorRef.current?.focus();
  }, [submitError]);

  async function goForward() {
    const nextStep = step + 1;
    const valid = await form.trigger([...STEPS[step].fields], { shouldFocus: true });
    if (valid) setStep(nextStep);
  }

  function goToField(field: FieldName) {
    focusFieldAfterStepChange(field);
    setStep(stepOfFields([field]));
  }

  function showFieldErrors(fields: FieldName[]) {
    if (fields.length > 0) goToField(fields[0]);
  }

  function showApiErrors(errors: Record<string, string>) {
    const fieldMessages = Object.entries(errors)
      .map(([path, message]) => [path.replace(/^patient\./, ""), message] as const)
      .filter((entry): entry is readonly [FieldName, string] => isPatientField(entry[0]));

    if (fieldMessages.length === 0) {
      setSubmitError(SUBMIT_ERROR);
      return;
    }
    fieldMessages.forEach(([field, message]) => form.setError(field, { message }));
    showFieldErrors(fieldMessages.map(([field]) => field));
  }

  async function submit(patient: Patient) {
    setSubmitError(null);
    try {
      const { id } = await api.createPreApproval(patient, scenario);
      setNavigating(true);
      router.push(`/pre-approvals/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.body?.errors) {
        showApiErrors(error.body.errors);
      } else {
        setSubmitError(SUBMIT_ERROR);
      }
    }
  }

  const onInvalid = (errors: FieldErrors<PatientFormValues>) => showFieldErrors(Object.keys(errors).filter(isPatientField));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step < LAST_STEP) {
      event.preventDefault();
      void goForward();
      return;
    }
    void form.handleSubmit(submit, onInvalid)(event);
  }

  const busy = form.formState.isSubmitting || navigating;
  const currentStep = STEPS[step];

  return (
    <FormProvider {...form}>
      <Card>
        <CardHeader>
          <Eyebrow className="mb-2">Nova pré-aprovação</Eyebrow>
          <StepIndicator current={step} />
          <CardTitle>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
              {currentStep.title}
            </h1>
          </CardTitle>
          <CardDescription>
            {currentStep.id === "review"
              ? `Confira os dados. Vamos consultar as financeiras parceiras ao mesmo tempo, com resposta em até ${DEADLINE_SECONDS} segundos.`
              : "Preencha uma vez só: os mesmos dados vão para todas as financeiras."}
          </CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit} noValidate>
          <CardContent>
            {currentStep.id === "personal" && (
              <FieldGroup>
                <TextField name="name" label="Nome completo" autoComplete="name" maxLength={MAX_NAME_LENGTH} />
                <TextField name="cpf" label="CPF" inputMode="numeric" placeholder="000.000.000-00" mask={maskCpf} />
                <TextField
                  name="birthDate"
                  label="Data de nascimento"
                  type="date"
                  description={`O paciente precisa ter entre ${MIN_AGE} e ${MAX_AGE} anos.`}
                />
                <TextField name="phone" label="Celular" type="tel" inputMode="numeric" placeholder="(11) 98765-4321" mask={maskPhone} />
              </FieldGroup>
            )}

            {currentStep.id === "financial" && (
              <FieldGroup>
                <CurrencyField name="monthlyIncomeCents" label="Renda mensal" description="Digite com os centavos: 350000 vira R$ 3.500,00." />
                <CurrencyField
                  name="treatmentAmountCents"
                  label="Valor do tratamento"
                  description={`Entre ${formatBRL(MIN_TREATMENT_CENTS)} e ${formatBRL(MAX_TREATMENT_CENTS)}.`}
                />
              </FieldGroup>
            )}

            {currentStep.id === "review" && (
              <ReviewStep onEdit={goToField} showScenario={showScenario} scenario={scenario} onScenarioChange={setScenario} />
            )}

            {submitError && (
              <Alert ref={submitErrorRef} tabIndex={-1} variant="destructive" className="mt-4 outline-none">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="mt-6 justify-between">
            <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={step === 0 || busy}>
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              {step < LAST_STEP ? "Continuar" : busy ? "Enviando…" : "Consultar financeiras"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}

interface StepIndicatorProps {
  current: number;
}

function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <ol className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Passos do cadastro">
      {STEPS.map((step, index) => (
        <li
          key={step.id}
          aria-current={index === current ? "step" : undefined}
          className={index === current ? "font-medium text-foreground" : undefined}
        >
          {index + 1}. {step.title}
          {index < LAST_STEP && <span aria-hidden> →</span>}
        </li>
      ))}
    </ol>
  );
}
