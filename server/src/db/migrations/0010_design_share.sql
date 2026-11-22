ALTER TABLE "designs" ADD COLUMN "share_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "designs_share_id_idx" ON "designs" USING btree ("share_id");