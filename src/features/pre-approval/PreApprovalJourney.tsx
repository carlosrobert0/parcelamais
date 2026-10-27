"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/domain/format";
import type { PreApproval } from "@/domain/types";
import { Confirmation } from "@/features/offers/Confirmation";
import { OffersTable } from "@/features/offers/OffersTable";
import { NewPreApprovalLink } from "@/features/registration/NewPreApprovalLink";
import { ApiError } from "@/lib/api";
import { Countdown } from "./Countdown";
import { LenderCard } from "./LenderCard";
import { STATUS_LABELS } from "./lender-status";
import { NoApproval } from "./NoApproval";
import { usePreApproval } from "./usePreApproval";

interface PreApprovalJourneyProps {
  id: string;
}

export function PreApprovalJourney({ id }: PreApprovalJourneyProps) {
  const { data: preApproval, isPending, error, refetch } = usePreApproval(id);
  const [selectionConflict, setSelectionConflict] = useState(false);

  if (isPending) return <LoadingState />;
  if (!preApproval) {
    return error instanceof ApiError && error.status === 404 ? <NotFoundState /> : <LoadErrorState onRetry={() => refetch()} />;
  }

  const isRunning = preApproval.status === "pending";
  const settled = preApproval.results.filter((result) => result.status !== "pending");

  return (
    <div className="space-y-8">
      <section aria-labelledby="pre-approval-title" className="space-y-4">
        <div>
          <h1 id="pre-approval-title" className="text-xl font-semibold">
            Pré-aprovação
          </h1>
          <p className="text-sm text-muted-foreground">
            Tratamento de {formatBRL(preApproval.treatmentAmountCents)} · {settled.length} de {preApproval.results.length} consultas
            encerradas
          </p>
        </div>

        {isRunning && <Countdown deadlineAt={preApproval.deadlineAt} />}

        <ul className="sr-only" aria-live="polite">
          {settled.map((result) => (
            <li key={result.lenderId}>
              {result.lenderName}: {STATUS_LABELS[result.status]}
            </li>
          ))}
          {!isRunning && <li>Consulta concluída.</li>}
        </ul>

        <div className="grid gap-3 sm:grid-cols-2">
          {preApproval.results.map((result) => (
            <LenderCard key={result.lenderId} result={result} />
          ))}
        </div>
      </section>

      {!isRunning && (
        <Outcome preApproval={preApproval} selectionConflict={selectionConflict} onConflict={() => setSelectionConflict(true)} />
      )}
    </div>
  );
}

interface OutcomeProps {
  preApproval: PreApproval;
  selectionConflict: boolean;
  onConflict: () => void;
}

function Outcome({ preApproval, selectionConflict, onConflict }: OutcomeProps) {
  if (preApproval.selection) return <Confirmation selection={preApproval.selection} alreadySelected={selectionConflict} />;
  if (preApproval.offers.length > 0) return <OffersTable preApproval={preApproval} onConflict={onConflict} />;
  return <NoApproval preApproval={preApproval} />;
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-busy>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

interface LoadErrorStateProps {
  onRetry: () => void;
}

function LoadErrorState({ onRetry }: LoadErrorStateProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar a pré-aprovação</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>Verifique a conexão e tente de novo.</p>
        <Button variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function NotFoundState() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Pré-aprovação não encontrada</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>Confira o endereço ou comece uma nova consulta.</p>
        <Button asChild variant="outline">
          <NewPreApprovalLink>Nova consulta</NewPreApprovalLink>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
