CREATE TABLE "wanjiedaoyou_admin_power_template_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"action" text NOT NULL,
	"restored_from" uuid,
	"realm" text NOT NULL,
	"stage" text NOT NULL,
	"before_snapshot" jsonb NOT NULL,
	"after_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_admin_power_template_history" ADD CONSTRAINT "wanjiedaoyou_admin_power_template_history_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_power_template_request_idx" ON "wanjiedaoyou_admin_power_template_history" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "admin_power_template_player_idx" ON "wanjiedaoyou_admin_power_template_history" USING btree ("cultivator_id","created_at");