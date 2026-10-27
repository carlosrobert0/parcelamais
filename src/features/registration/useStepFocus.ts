"use client";

import { useEffect, useRef } from "react";
import type { UseFormSetFocus } from "react-hook-form";
import type { PatientFormValues } from "@/domain/schemas";

type FieldName = keyof PatientFormValues;

export function useStepFocus(step: number, setFocus: UseFormSetFocus<PatientFormValues>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldToFocus = useRef<FieldName | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (fieldToFocus.current) {
      setFocus(fieldToFocus.current);
      fieldToFocus.current = null;
    } else {
      headingRef.current?.focus();
    }
  }, [step, setFocus]);

  return {
    headingRef,
    focusFieldAfterStepChange: (field: FieldName) => {
      fieldToFocus.current = field;
    },
  };
}
