"use client";

import { useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { formatBRL, formatIsoDate } from "@/domain/format";
import { SCENARIO_LABELS, SCENARIOS, type Scenario } from "@/domain/scenarios";
import type { PatientFormValues } from "@/domain/schemas";

interface ReviewStepProps {
  onEdit: (field: keyof PatientFormValues) => void;
  showScenario: boolean;
  scenario: Scenario;
  onScenarioChange: (scenario: Scenario) => void;
}

const EMPTY = "—";
const brlOrEmpty = (cents?: number) => (typeof cents === "number" ? formatBRL(cents) : EMPTY);
const dateOrEmpty = (isoDate?: string) => (isoDate ? formatIsoDate(isoDate) : EMPTY);

export function ReviewStep({ onEdit, showScenario, scenario, onScenarioChange }: ReviewStepProps) {
  const values = useWatch<PatientFormValues>();
  const rows: { label: string; value: string; field: keyof PatientFormValues }[] = [
    { label: "Nome", value: values.name || EMPTY, field: "name" },
    { label: "CPF", value: values.cpf || EMPTY, field: "cpf" },
    { label: "Nascimento", value: dateOrEmpty(values.birthDate), field: "birthDate" },
    { label: "Celular", value: values.phone || EMPTY, field: "phone" },
    { label: "Renda mensal", value: brlOrEmpty(values.monthlyIncomeCents), field: "monthlyIncomeCents" },
    { label: "Valor do tratamento", value: brlOrEmpty(values.treatmentAmountCents), field: "treatmentAmountCents" },
  ];

  return (
    <div className="space-y-6">
      <dl className="divide-y rounded-lg border">
        {rows.map(({ label, value, field }) => (
          <div key={field} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="flex min-w-0 items-center gap-2 text-right font-medium">
              <span className="min-w-0 break-words">{value}</span>
              <Button type="button" variant="link" size="xs" onClick={() => onEdit(field)} aria-label={`Editar ${label}`}>
                Editar
              </Button>
            </dd>
          </div>
        ))}
      </dl>

      {showScenario && (
        <Field className="rounded-lg border border-dashed p-3">
          <FieldLabel htmlFor="scenario">Cenário de demonstração</FieldLabel>
          <select
            id="scenario"
            value={scenario}
            onChange={(event) => onScenarioChange(event.target.value as Scenario)}
            aria-describedby="scenario-description"
            className="block h-8 w-full rounded-lg border bg-background px-2 text-sm"
          >
            {SCENARIOS.map((option) => (
              <option key={option} value={option}>
                {SCENARIO_LABELS[option]}
              </option>
            ))}
          </select>
          <FieldDescription id="scenario-description">
            Visível só com ?demo=1. Força o comportamento de cada financeira.
          </FieldDescription>
        </Field>
      )}
    </div>
  );
}
