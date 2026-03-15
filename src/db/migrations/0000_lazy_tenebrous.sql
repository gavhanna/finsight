CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"iban" text,
	"name" text,
	"currency" text,
	"owner_name" text,
	"last_sync_at" timestamp,
	"sync_calls_today" integer DEFAULT 0 NOT NULL,
	"sync_calls_date" text
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"institution_name" text NOT NULL,
	"institution_logo" text,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"agreement_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text,
	"type" text DEFAULT 'expense' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"pattern" text NOT NULL,
	"field" text DEFAULT 'description' NOT NULL,
	"match_type" text DEFAULT 'contains' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"external_id" text,
	"booking_date" text NOT NULL,
	"value_date" text,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"creditor_name" text,
	"debtor_name" text,
	"description" text,
	"merchant_category_code" text,
	"category_id" integer,
	"categorised_by" text,
	"dedupe_hash" text NOT NULL,
	"raw_data" text,
	CONSTRAINT "uniq_dedupe_hash" UNIQUE("dedupe_hash")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transactions_booking_date" ON "transactions" USING btree ("booking_date");--> statement-breakpoint
CREATE INDEX "idx_transactions_account_id" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_category_id" ON "transactions" USING btree ("category_id");