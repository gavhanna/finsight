CREATE TABLE "narrative_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"narrative" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
