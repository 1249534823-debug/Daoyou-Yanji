CREATE TABLE "wanjiedaoyou_npc_action_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"plan" jsonb NOT NULL,
	"status" varchar(24) NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_npc_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"personality" varchar(24) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"next_action_at" timestamp DEFAULT now() NOT NULL,
	"current_action_id" uuid,
	"lease_until" timestamp,
	"last_action_at" timestamp,
	"last_summary" text,
	"last_error" text,
	"day" varchar(10) NOT NULL,
	"actions_today" integer DEFAULT 0 NOT NULL,
	"listings_today" integer DEFAULT 0 NOT NULL,
	"rankings_today" integer DEFAULT 0 NOT NULL,
	"spawn_request_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_npc_admin_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text NOT NULL,
	"action" varchar(40) NOT NULL,
	"details" jsonb NOT NULL,
	"request_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_npc_world_settings" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"last_tick_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_npc_action_logs" ADD CONSTRAINT "wanjiedaoyou_npc_action_logs_actor_id_wanjiedaoyou_npc_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."wanjiedaoyou_npc_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_npc_actors" ADD CONSTRAINT "wanjiedaoyou_npc_actors_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "npc_action_actor_created_idx" ON "wanjiedaoyou_npc_action_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "npc_action_created_idx" ON "wanjiedaoyou_npc_action_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "npc_actors_cultivator_unique" ON "wanjiedaoyou_npc_actors" USING btree ("cultivator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "npc_actors_user_unique" ON "wanjiedaoyou_npc_actors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "npc_actors_due_idx" ON "wanjiedaoyou_npc_actors" USING btree ("enabled","next_action_at");--> statement-breakpoint
CREATE INDEX "npc_actors_spawn_idx" ON "wanjiedaoyou_npc_actors" USING btree ("spawn_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "npc_admin_request_unique" ON "wanjiedaoyou_npc_admin_audit" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "npc_admin_created_idx" ON "wanjiedaoyou_npc_admin_audit" USING btree ("created_at");