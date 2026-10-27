"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatPercent } from "@/domain/format";
import { sortOffers, type Offer, type SortOrder } from "@/domain/offers";
import type { PreApproval, Selection } from "@/domain/types";
import { api, ApiError } from "@/lib/api";
import { preApprovalKey } from "@/lib/query-keys";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "installment", label: "Menor parcela" },
  { value: "total", label: "Menor custo total" },
];

const conflictingSelection = (error: unknown) => (error instanceof ApiError ? error.body?.selection : undefined);

function partialApprovalsByLender(offers: Offer[]): Offer[] {
  const partialByLender = new Map(offers.filter((offer) => offer.partial).map((offer) => [offer.lenderId, offer]));
  return [...partialByLender.values()];
}

interface OffersTableProps {
  preApproval: PreApproval;
  onConflict: () => void;
}

export function OffersTable({ preApproval, onConflict }: OffersTableProps) {
  const queryClient = useQueryClient();
  const [sortOrder, setSortOrder] = useState<SortOrder>("installment");
  const offers = sortOffers(preApproval.offers, sortOrder);

  const storeSelection = (selection: Selection) =>
    queryClient.setQueryData<PreApproval>(preApprovalKey(preApproval.id), (current) => current && { ...current, selection });

  const selectOffer = useMutation({
    mutationFn: (offer: Offer) => api.selectOffer(preApproval.id, { lenderId: offer.lenderId, term: offer.term }),
    onSuccess: storeSelection,
    onError: (error) => {
      const selection = conflictingSelection(error);
      if (!selection) return;
      onConflict();
      storeSelection(selection);
    },
  });

  return (
    <section aria-labelledby="offers-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="offers-title" className="text-lg font-semibold">
            Ofertas
          </h2>
          <p className="text-sm text-muted-foreground">
            Parcelas pela Tabela Price sobre o valor aprovado. O custo total soma o que o paciente paga fora do financiamento.
          </p>
        </div>
        <div role="group" aria-label="Ordenar ofertas" className="flex gap-1">
          {SORT_OPTIONS.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={sortOrder === value ? "default" : "outline"}
              aria-pressed={sortOrder === value}
              onClick={() => setSortOrder(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {partialApprovalsByLender(preApproval.offers).map((offer) => (
        <Alert key={offer.lenderId} role="status">
          <AlertDescription>
            A <strong>{offer.lenderName}</strong> aprovou {formatBRL(offer.approvedAmountCents)} de{" "}
            {formatBRL(preApproval.treatmentAmountCents)}. A diferença de {formatBRL(offer.uncoveredCents)} precisa ser paga de
            outra forma.
          </AlertDescription>
        </Alert>
      ))}

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Financeira</TableHead>
              <TableHead className="text-right">Parcela</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Total pago</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Custo total</TableHead>
              <TableHead className="hidden text-right md:table-cell">Taxa a.m.</TableHead>
              <TableHead>
                <span className="sr-only">Ação</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.map((offer) => (
              <OfferRow
                key={`${offer.lenderId}-${offer.term}`}
                offer={offer}
                disabled={selectOffer.isPending}
                onSelect={() => selectOffer.mutate(offer)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {selectOffer.isError && !conflictingSelection(selectOffer.error) && (
        <Alert variant="destructive">
          <AlertDescription>Não foi possível salvar a escolha. Tente de novo.</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

interface OfferRowProps {
  offer: Offer;
  disabled: boolean;
  onSelect: () => void;
}

function OfferRow({ offer, disabled, onSelect }: OfferRowProps) {
  return (
    <TableRow data-testid="offer">
      <TableCell>
        <span className="font-medium">{offer.lenderName}</span>
        {offer.partial && (
          <Badge variant="outline" className="mt-1 flex w-fit border-amber-300 text-amber-800 sm:mt-0 sm:ml-2 sm:inline-flex">
            Parcial
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="block text-xs text-muted-foreground sm:inline sm:text-sm sm:text-foreground">{offer.term}× </span>
        {formatBRL(offer.installmentCents)}
        <span className="block text-xs text-muted-foreground sm:hidden">total {formatBRL(offer.totalCents)}</span>
        {offer.partial && (
          <span className="block text-xs text-muted-foreground sm:hidden">custo total {formatBRL(offer.totalCostCents)}</span>
        )}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatBRL(offer.totalCents)}</TableCell>
      <TableCell className="hidden text-right tabular-nums sm:table-cell">
        {formatBRL(offer.totalCostCents)}
        {offer.partial && <span className="block text-xs text-muted-foreground">inclui {formatBRL(offer.uncoveredCents)} por fora</span>}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatPercent(offer.monthlyRate)}</TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onSelect}
          aria-label={`Escolher ${offer.lenderName} em ${offer.term} parcelas de ${formatBRL(offer.installmentCents)}`}
        >
          Escolher
        </Button>
      </TableCell>
    </TableRow>
  );
}
