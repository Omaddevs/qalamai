CREATE TABLE "invite_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"design_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_rsvps" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"name" text NOT NULL,
	"answer" text NOT NULL,
	"guests" integer DEFAULT 1 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invite_pages" ADD CONSTRAINT "invite_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_rsvps" ADD CONSTRAINT "invite_rsvps_page_id_invite_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."invite_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_slug_uq" ON "invite_pages" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_user_design_uq" ON "invite_pages" USING btree ("user_id","design_id");--> statement-breakpoint
CREATE INDEX "invite_rsvps_page_idx" ON "invite_rsvps" USING btree ("page_id","created_at");