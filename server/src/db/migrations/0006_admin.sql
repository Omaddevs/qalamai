CREATE TABLE "admin_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"entry" boolean DEFAULT false NOT NULL,
	"source" text,
	"referrer" text,
	"search_engine" text,
	"search_term" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"country" text,
	"timezone" text,
	"lang" text,
	"device" text,
	"browser" text,
	"os" text,
	"screen" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_method" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_ip" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_country" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_device" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_browser" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_os" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_source" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_referrer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_utm" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_landing" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "visitor_id" text;--> statement-breakpoint
CREATE INDEX "page_views_created_idx" ON "page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_views_visitor_idx" ON "page_views" USING btree ("visitor_id","created_at");--> statement-breakpoint
CREATE INDEX "users_registered_idx" ON "users" USING btree ("registered_at");--> statement-breakpoint
UPDATE "users" SET "registered_at" = "created_at", "signup_method" = CASE WHEN "google_id" IS NOT NULL THEN 'google' WHEN "telegram_id" IS NOT NULL THEN 'telegram' ELSE 'password' END WHERE "is_guest" = false;
