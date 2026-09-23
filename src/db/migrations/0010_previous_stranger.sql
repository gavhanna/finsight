CREATE TABLE "recurring_commitments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payee" text NOT NULL,
	"category_id" integer,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"cadence" text NOT NULL,
	"next_expected" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_recurring_commitment_payee" UNIQUE("payee")
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"name" text NOT NULL,
	"definition" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_saved_view_scope_name" UNIQUE("scope","name")
);
--> statement-breakpoint
CREATE TABLE "transaction_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"category_id" integer,
	"amount" double precision NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "category_groups" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
UPDATE "transactions" SET "reviewed_at" = now() WHERE "category_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_commitments" ADD CONSTRAINT "recurring_commitments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_splits_transaction_id" ON "transaction_splits" USING btree ("transaction_id");
