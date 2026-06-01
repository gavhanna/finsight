CREATE TABLE "balance_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"balance" double precision NOT NULL,
	"currency" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_history" ADD CONSTRAINT "balance_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_balance_history_account_id" ON "balance_history" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_balance_history_recorded_at" ON "balance_history" USING btree ("recorded_at");