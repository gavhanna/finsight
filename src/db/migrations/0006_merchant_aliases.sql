CREATE TABLE IF NOT EXISTS "merchant_aliases" (
  "id"             SERIAL PRIMARY KEY,
  "canonical_name" TEXT NOT NULL,
  "alias"          TEXT NOT NULL UNIQUE,
  "created_at"     TIMESTAMP DEFAULT now() NOT NULL
);
