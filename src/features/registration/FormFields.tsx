"use client";

import { Controller, useFormContext, type ControllerFieldState } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/domain/format";
import type { PatientFormValues } from "@/domain/schemas";
import { centsFromInput } from "@/lib/masks";

type FieldName = keyof PatientFormValues;

interface FieldProps extends Omit<React.ComponentProps<"input">, "name"> {
  name: FieldName;
  label: string;
  description?: string;
}

interface TextFieldProps extends FieldProps {
  mask?: (value: string) => string;
}

interface FormFieldProps extends FieldProps {
  format: (value: unknown) => string;
  parse: (input: string) => unknown;
}

export function TextField({ mask, ...props }: TextFieldProps) {
  return <FormField {...props} format={(value) => (value as string | undefined) ?? ""} parse={(input) => (mask ? mask(input) : input)} />;
}

export function CurrencyField(props: FieldProps) {
  return (
    <FormField
      inputMode="numeric"
      placeholder="R$ 0,00"
      {...props}
      format={(value) => (typeof value === "number" ? formatBRL(value) : "")}
      parse={centsFromInput}
    />
  );
}

function FormField({ name, label, description, format, parse, ...input }: FormFieldProps) {
  const { control, trigger } = useFormContext<PatientFormValues>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            {...input}
            {...field}
            id={name}
            value={format(field.value)}
            onChange={(event) => {
              field.onChange(parse(event.target.value));
              if (fieldState.invalid) void trigger(name);
            }}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(name, description, fieldState)}
          />
          {description && <FieldDescription id={`${name}-description`}>{description}</FieldDescription>}
          <FieldError id={`${name}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

function describedBy(name: FieldName, description: string | undefined, fieldState: ControllerFieldState) {
  const ids = [description && `${name}-description`, fieldState.error && `${name}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}
