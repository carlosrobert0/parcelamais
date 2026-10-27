"use client";

import { useEffect, useEffectEvent } from "react";
import type { DefaultValues, UseFormReturn } from "react-hook-form";
import type { Patient, PatientFormValues } from "@/domain/schemas";
import { DRAFT_CLEARED_EVENT, loadDraft, saveDraft } from "./draft";

interface DraftPersistenceOptions {
  form: UseFormReturn<PatientFormValues, unknown, Patient>;
  emptyValues: DefaultValues<PatientFormValues>;
  suggestedAmountCents?: number;
  onStartOver: () => void;
}

export function useDraftPersistence({ form, emptyValues, suggestedAmountCents, onStartOver }: DraftPersistenceOptions) {
  const startOver = useEffectEvent(() => {
    form.reset(emptyValues);
    onStartOver();
  });

  useEffect(() => {
    const draft = loadDraft();
    if (draft || suggestedAmountCents) {
      form.reset({ ...emptyValues, ...draft, ...(suggestedAmountCents && { treatmentAmountCents: suggestedAmountCents }) });
      saveDraft(form.getValues());
    }
    return form.subscribe({ formState: { values: true }, callback: ({ values }) => saveDraft(values) });
  }, [form, emptyValues, suggestedAmountCents]);

  useEffect(() => {
    window.addEventListener(DRAFT_CLEARED_EVENT, startOver);
    return () => window.removeEventListener(DRAFT_CLEARED_EVENT, startOver);
  }, []);
}
