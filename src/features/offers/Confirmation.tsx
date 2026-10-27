"use client";

import { CircleCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatDateTime } from "@/domain/format";
import type { Selection } from "@/domain/types";
import { clearDraft } from "@/features/registration/draft";
import { NewPreApprovalLink } from "@/features/registration/NewPreApprovalLink";

interface ConfirmationProps {
  selection: Selection;
  alreadySelected?: boolean;
}

export function Confirmation({ selection, alreadySelected = false }: ConfirmationProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    clearDraft();
    headingRef.current?.focus();
  }, []);

  return (
    <Card className="border-emerald-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleCheck aria-hidden className="size-5 text-emerald-600" />
          <h2 ref={headingRef} tabIndex={-1} className="outline-none">
            Oferta escolhida
          </h2>
        </CardTitle>
        <CardDescription>A escolha foi salva. Recarregar a página mantém esta confirmação.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alreadySelected && (
          <Alert role="status">
            <AlertDescription>Esta pré-aprovação já tinha outra oferta escolhida. A escolha que vale é a abaixo.</AlertDescription>
          </Alert>
        )}
        <p className="text-lg">
          <strong>{selection.lenderName}</strong>: {selection.term}× de {formatBRL(selection.installmentCents)}
        </p>
        <p className="text-sm text-muted-foreground">
          Total pago: {formatBRL(selection.totalCents)} · escolhida em {formatDateTime(selection.selectedAt)}
        </p>
        {selection.uncoveredCents > 0 && (
          <p className="text-sm text-amber-800">
            O financiamento é parcial: {formatBRL(selection.uncoveredCents)} do tratamento precisam ser pagos de outra forma.
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-4">
        <Button asChild variant="outline">
          <NewPreApprovalLink>Nova consulta</NewPreApprovalLink>
        </Button>
      </CardFooter>
    </Card>
  );
}
