CREATE TABLE "budgets" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_id" integer REFERENCES "categories"("id") ON DELETE CASCADE,
  "category_group_id" integer REFERENCES "category_groups"("id") ON DELETE CASCADE,
  "monthly_amount" double precision NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "budget_target_xor" CHECK (
    ("category_id" IS NOT NULL AND "category_group_id" IS NULL) OR
    ("category_id" IS NULL AND "category_group_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_category_id_unique" ON "budgets"("category_id") WHERE "category_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_category_group_id_unique" ON "budgets"("category_group_id") WHERE "category_group_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "budget_overrides" (
  "id" serial PRIMARY KEY NOT NULL,
  "budget_id" integer NOT NULL REFERENCES "budgets"("id") ON DELETE CASCADE,
  "month" text NOT NULL,
  "amount" double precision NOT NULL,
  CONSTRAINT "budget_overrides_budget_id_month_unique" UNIQUE("budget_id", "month")
);
