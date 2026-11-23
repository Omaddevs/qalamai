CREATE TABLE "payment_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"coins" integer NOT NULL,
	"amount" integer NOT NULL,
	"pack" text,
	"method" text NOT NULL,
	"card" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"receipt_key" text NOT NULL,
	"receipt_mime" text NOT NULL,
	"receipt_size" integer NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_orders_user_idx" ON "payment_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_orders_status_idx" ON "payment_orders" USING btree ("status","created_at");