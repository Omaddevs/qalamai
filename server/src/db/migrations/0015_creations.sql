CREATE TABLE "creations" (
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creations_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "creations" ADD CONSTRAINT "creations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creations_created_idx" ON "creations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "creations_kind_idx" ON "creations" USING btree ("kind","created_at");