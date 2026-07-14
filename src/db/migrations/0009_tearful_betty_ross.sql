CREATE TABLE "recurring_ignores" (
	"id" serial PRIMARY KEY NOT NULL,
	"payee" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_ignores_payee_unique" UNIQUE("payee")
);
