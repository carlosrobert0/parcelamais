import { and, eq, lt } from "drizzle-orm";
import { LENDERS, lenderName } from "@/domain/lenders";
import { DEADLINE_MS } from "@/domain/deadline";
import { buildOffers, type Approval, type Offer } from "@/domain/offers";
import type { LenderOutcome } from "@/domain/orchestrator";
import type { Scenario } from "@/domain/scenarios";
import type { SelectionRequest } from "@/domain/schemas";
import { suggestLowerAmount } from "@/domain/suggestion";
import type { LenderResult, PreApproval, Selection } from "@/domain/types";
import { db } from "./db/client";
import { lenderResult, patient, preApproval, selectedOffer } from "./db/schema";

const STALE_AFTER_MS = DEADLINE_MS * 3;

type LenderResultRow = typeof lenderResult.$inferSelect;
type PreApprovalRow = typeof preApproval.$inferSelect;
type SelectedOfferRow = typeof selectedOffer.$inferSelect;

interface NewPreApproval {
  patient: Omit<typeof patient.$inferInsert, "id" | "createdAt">;
  treatmentAmountCents: number;
  age: number;
  scenario: Scenario;
}

export async function createPreApproval({ patient: patientData, treatmentAmountCents, age, scenario }: NewPreApproval) {
  return db.transaction(async (tx) => {
    const [{ patientId }] = await tx
      .insert(patient)
      .values(patientData)
      .onConflictDoUpdate({ target: patient.cpf, set: patientData })
      .returning({ patientId: patient.id });

    const [created] = await tx
      .insert(preApproval)
      .values({ patientId, treatmentAmountCents, monthlyIncomeCents: patientData.monthlyIncomeCents, age, scenario })
      .returning({ id: preApproval.id, createdAt: preApproval.createdAt });

    await tx.insert(lenderResult).values(LENDERS.map((lender) => ({ preApprovalId: created.id, lenderId: lender.id })));
    return created;
  });
}

export async function saveLenderOutcome(preApprovalId: string, lenderId: string, outcome: LenderOutcome): Promise<void> {
  const approved = outcome.status === "approved" ? outcome : null;
  await db
    .update(lenderResult)
    .set({
      status: outcome.status,
      reason: outcome.status === "approved" ? null : outcome.reason,
      approvedAmountCents: approved?.approvedAmountCents ?? null,
      monthlyRate: approved?.monthlyRate ?? null,
      terms: approved?.terms ?? null,
      latencyMs: outcome.latencyMs,
      respondedAt: new Date(),
    })
    .where(
      and(
        eq(lenderResult.preApprovalId, preApprovalId),
        eq(lenderResult.lenderId, lenderId),
        eq(lenderResult.status, "pending"),
      ),
    );
}

export async function completePreApproval(preApprovalId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(lenderResult)
      .set({ status: "unavailable", reason: "error", respondedAt: new Date() })
      .where(and(eq(lenderResult.preApprovalId, preApprovalId), eq(lenderResult.status, "pending")));
    await tx
      .update(preApproval)
      .set({ status: "completed", completedAt: new Date() })
      .where(and(eq(preApproval.id, preApprovalId), eq(preApproval.status, "pending")));
  });
}

export async function completeStalePreApprovals(): Promise<number> {
  const stale = await db
    .select({ id: preApproval.id })
    .from(preApproval)
    .where(and(eq(preApproval.status, "pending"), lt(preApproval.createdAt, new Date(Date.now() - STALE_AFTER_MS))));
  for (const { id } of stale) await completePreApproval(id);
  return stale.length;
}

export async function findPreApproval(preApprovalId: string): Promise<PreApproval | null> {
  const [row] = await db.select().from(preApproval).where(eq(preApproval.id, preApprovalId));
  if (!row) return null;

  if (isStale(row)) {
    await completePreApproval(preApprovalId);
    return findPreApproval(preApprovalId);
  }

  const resultRows = await db.select().from(lenderResult).where(eq(lenderResult.preApprovalId, preApprovalId));
  const [selectionRow] = await db.select().from(selectedOffer).where(eq(selectedOffer.preApprovalId, preApprovalId));
  return toPreApproval(row, resultRows, selectionRow);
}

type SelectionResult =
  | { kind: "created" | "repeated" | "conflict"; selection: Selection }
  | { kind: "not-found" | "pending" | "invalid-offer" };

export async function selectOffer(preApprovalId: string, request: SelectionRequest): Promise<SelectionResult> {
  const current = await findPreApproval(preApprovalId);
  if (!current) return { kind: "not-found" };
  if (current.status !== "completed") return { kind: "pending" };

  const offer = current.offers.find((o) => o.lenderId === request.lenderId && o.term === request.term);
  if (!offer) return { kind: "invalid-offer" };

  const [inserted] = await db
    .insert(selectedOffer)
    .values({
      preApprovalId,
      lenderId: offer.lenderId,
      term: offer.term,
      installmentCents: offer.installmentCents,
      totalCents: offer.totalCents,
    })
    .onConflictDoNothing({ target: selectedOffer.preApprovalId })
    .returning();

  if (inserted) return { kind: "created", selection: toSelection(inserted, current.offers) };

  const [existing] = await db.select().from(selectedOffer).where(eq(selectedOffer.preApprovalId, preApprovalId));
  const isSameOffer = existing.lenderId === request.lenderId && existing.term === request.term;
  return { kind: isSameOffer ? "repeated" : "conflict", selection: toSelection(existing, current.offers) };
}

function isStale(row: PreApprovalRow): boolean {
  return row.status === "pending" && Date.now() - row.createdAt.getTime() > STALE_AFTER_MS;
}

function toPreApproval(row: PreApprovalRow, resultRows: LenderResultRow[], selectionRow?: SelectedOfferRow): PreApproval {
  const results = sortByLenderOrder(resultRows).map(toLenderResult);
  const approvals = results.flatMap(toApproval);
  const offers = buildOffers(row.treatmentAmountCents, approvals);
  const noneApproved = row.status === "completed" && approvals.length === 0;

  return {
    id: row.id,
    status: row.status,
    scenario: row.scenario as Scenario,
    treatmentAmountCents: row.treatmentAmountCents,
    createdAt: row.createdAt.toISOString(),
    deadlineAt: new Date(row.createdAt.getTime() + DEADLINE_MS).toISOString(),
    results,
    offers,
    selection: selectionRow ? toSelection(selectionRow, offers) : null,
    suggestedAmountCents: noneApproved ? suggestLowerAmount(row.monthlyIncomeCents, row.treatmentAmountCents) : null,
  };
}

function sortByLenderOrder(rows: LenderResultRow[]): LenderResultRow[] {
  const order = LENDERS.map((lender) => lender.id);
  return [...rows].sort((a, b) => order.indexOf(a.lenderId) - order.indexOf(b.lenderId));
}

function toLenderResult(row: LenderResultRow): LenderResult {
  return {
    lenderId: row.lenderId,
    lenderName: lenderName(row.lenderId),
    status: row.status,
    reason: row.reason,
    approvedAmountCents: row.approvedAmountCents,
    monthlyRate: row.monthlyRate,
    terms: row.terms,
    latencyMs: row.latencyMs,
  };
}

function toApproval(result: LenderResult): Approval[] {
  if (result.status !== "approved") return [];
  return [
    {
      lenderId: result.lenderId,
      lenderName: result.lenderName,
      approvedAmountCents: result.approvedAmountCents!,
      monthlyRate: result.monthlyRate!,
      terms: result.terms!,
    },
  ];
}

function toSelection(row: SelectedOfferRow, offers: Offer[]): Selection {
  const offer = offers.find((candidate) => candidate.lenderId === row.lenderId && candidate.term === row.term);
  return {
    lenderId: row.lenderId,
    lenderName: lenderName(row.lenderId),
    term: row.term,
    installmentCents: row.installmentCents,
    totalCents: row.totalCents,
    uncoveredCents: offer?.uncoveredCents ?? 0,
    selectedAt: row.selectedAt.toISOString(),
  };
}
