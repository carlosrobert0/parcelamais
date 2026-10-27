import { date, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { LENDER_STATUSES, PRE_APPROVAL_STATUSES } from "@/domain/types";

export const preApprovalStatus = pgEnum("pre_approval_status", PRE_APPROVAL_STATUSES);

export const lenderStatus = pgEnum("lender_status", LENDER_STATUSES);

export const patient = pgTable("patient", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cpf: text("cpf").notNull().unique(),
  birthDate: date("birth_date", { mode: "string" }).notNull(),
  phone: text("phone").notNull(),
  monthlyIncomeCents: integer("monthly_income_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const preApproval = pgTable("pre_approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patient.id),
  treatmentAmountCents: integer("treatment_amount_cents").notNull(),
  monthlyIncomeCents: integer("monthly_income_cents").notNull(),
  age: integer("age").notNull(),
  scenario: text("scenario").notNull(),
  status: preApprovalStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const lenderResult = pgTable(
  "lender_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    preApprovalId: uuid("pre_approval_id")
      .notNull()
      .references(() => preApproval.id),
    lenderId: text("lender_id").notNull(),
    status: lenderStatus("status").notNull().default("pending"),
    reason: text("reason"),
    approvedAmountCents: integer("approved_amount_cents"),
    monthlyRate: numeric("monthly_rate", { precision: 6, scale: 4, mode: "number" }),
    terms: integer("terms").array(),
    latencyMs: integer("latency_ms"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.preApprovalId, table.lenderId)],
);

export const selectedOffer = pgTable("selected_offer", {
  id: uuid("id").primaryKey().defaultRandom(),
  preApprovalId: uuid("pre_approval_id")
    .notNull()
    .unique()
    .references(() => preApproval.id),
  lenderId: text("lender_id").notNull(),
  term: integer("term").notNull(),
  installmentCents: integer("installment_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
});
