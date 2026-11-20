ALTER TABLE "support_messages" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN "done_at" timestamp with time zone;