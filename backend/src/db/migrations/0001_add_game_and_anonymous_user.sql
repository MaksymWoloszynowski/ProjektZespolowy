CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"min_players" integer NOT NULL,
	"max_players" integer NOT NULL,
	"uses_elo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false;