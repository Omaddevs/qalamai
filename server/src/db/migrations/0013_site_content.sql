CREATE TABLE "site_news" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cover_key" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_partners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo_key" text,
	"url" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"photo_key" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "site_news_slug_idx" ON "site_news" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "site_news_pub_idx" ON "site_news" USING btree ("published","published_at");--> statement-breakpoint
CREATE INDEX "site_partners_sort_idx" ON "site_partners" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "site_team_sort_idx" ON "site_team" USING btree ("sort");