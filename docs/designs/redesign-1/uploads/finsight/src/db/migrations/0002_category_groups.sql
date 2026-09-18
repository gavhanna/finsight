CREATE TABLE IF NOT EXISTS "category_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  CONSTRAINT "category_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "group_id" integer REFERENCES "category_groups"("id") ON DELETE SET NULL;
