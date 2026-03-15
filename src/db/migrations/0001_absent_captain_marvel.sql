-- Custom SQL migration file, put your code below! --

-- Create new rules table
CREATE TABLE "rules" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "category_id" integer NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
  "priority" integer NOT NULL DEFAULT 0
);

-- Create new rule_patterns table
CREATE TABLE "rule_patterns" (
  "id" serial PRIMARY KEY NOT NULL,
  "rule_id" integer NOT NULL REFERENCES "rules"("id") ON DELETE CASCADE,
  "pattern" text NOT NULL,
  "field" text NOT NULL DEFAULT 'description',
  "match_type" text NOT NULL DEFAULT 'contains'
);

-- Migrate existing category_rules: each becomes one rule with one pattern
DO $$
DECLARE
  cr RECORD;
  new_rule_id INT;
BEGIN
  FOR cr IN SELECT * FROM category_rules LOOP
    INSERT INTO rules (name, category_id, priority)
    VALUES (cr.pattern, cr.category_id, cr.priority)
    RETURNING id INTO new_rule_id;

    INSERT INTO rule_patterns (rule_id, pattern, field, match_type)
    VALUES (new_rule_id, cr.pattern, cr.field, cr.match_type);
  END LOOP;
END $$;

-- Drop old table
DROP TABLE "category_rules";