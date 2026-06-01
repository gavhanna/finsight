ALTER TABLE "accounts" ADD COLUMN "balance" double precision;
ALTER TABLE "accounts" ADD COLUMN "balance_currency" text;
ALTER TABLE "accounts" ADD COLUMN "balance_updated_at" timestamp;
