ALTER TABLE "payment_orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "reverted_coins" integer;