CREATE TABLE "telegram_logins" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"browser_secret_hash" text NOT NULL,
	"telegram_user_id" text,
	"telegram_name" text,
	"verified_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "telegram_logins_phone_idx" ON "telegram_logins" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "telegram_logins_tg_idx" ON "telegram_logins" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_uq" ON "users" USING btree ("telegram_id");