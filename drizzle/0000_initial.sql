CREATE TYPE "public"."lender_status" AS ENUM('pending', 'approved', 'declined', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."pre_approval_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TABLE "lender_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pre_approval_id" uuid NOT NULL,
	"lender_id" text NOT NULL,
	"status" "lender_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"approved_amount_cents" integer,
	"monthly_rate" numeric(6, 4),
	"terms" integer[],
	"latency_ms" integer,
	"responded_at" timestamp with time zone,
	CONSTRAINT "lender_result_pre_approval_id_lender_id_unique" UNIQUE("pre_approval_id","lender_id")
);
--> statement-breakpoint
CREATE TABLE "patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cpf" text NOT NULL,
	"birth_date" date NOT NULL,
	"phone" text NOT NULL,
	"monthly_income_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_cpf_unique" UNIQUE("cpf")
);
--> statement-breakpoint
CREATE TABLE "pre_approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"treatment_amount_cents" integer NOT NULL,
	"monthly_income_cents" integer NOT NULL,
	"age" integer NOT NULL,
	"scenario" text NOT NULL,
	"status" "pre_approval_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "selected_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pre_approval_id" uuid NOT NULL,
	"lender_id" text NOT NULL,
	"term" integer NOT NULL,
	"installment_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "selected_offer_pre_approval_id_unique" UNIQUE("pre_approval_id")
);
--> statement-breakpoint
ALTER TABLE "lender_result" ADD CONSTRAINT "lender_result_pre_approval_id_pre_approval_id_fk" FOREIGN KEY ("pre_approval_id") REFERENCES "public"."pre_approval"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval" ADD CONSTRAINT "pre_approval_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selected_offer" ADD CONSTRAINT "selected_offer_pre_approval_id_pre_approval_id_fk" FOREIGN KEY ("pre_approval_id") REFERENCES "public"."pre_approval"("id") ON DELETE no action ON UPDATE no action;