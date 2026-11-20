CREATE TABLE "bio_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"design_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"clicks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bio_pages" ADD CONSTRAINT "bio_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bio_slug_uq" ON "bio_pages" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "bio_user_design_uq" ON "bio_pages" USING btree ("user_id","design_id");