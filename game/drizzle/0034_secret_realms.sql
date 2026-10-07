CREATE TABLE "wanjiedaoyou_secret_realm_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realm_id" varchar(64) NOT NULL,
	"actor_id" text NOT NULL,
	"enabled" boolean NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_secret_realm_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"realm_id" varchar(64) NOT NULL,
	"entry_day" varchar(10) NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_secret_realms" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_secret_realm_audit" ADD CONSTRAINT "wanjiedaoyou_secret_realm_audit_realm_id_wanjiedaoyou_secret_realms_id_fk" FOREIGN KEY ("realm_id") REFERENCES "public"."wanjiedaoyou_secret_realms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_secret_realm_runs" ADD CONSTRAINT "wanjiedaoyou_secret_realm_runs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_secret_realm_runs" ADD CONSTRAINT "wanjiedaoyou_secret_realm_runs_realm_id_wanjiedaoyou_secret_realms_id_fk" FOREIGN KEY ("realm_id") REFERENCES "public"."wanjiedaoyou_secret_realms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "secret_realm_daily_unique" ON "wanjiedaoyou_secret_realm_runs" USING btree ("cultivator_id","realm_id","entry_day");--> statement-breakpoint
CREATE INDEX "secret_realm_player_idx" ON "wanjiedaoyou_secret_realm_runs" USING btree ("cultivator_id","realm_id","created_at");
--> statement-breakpoint
INSERT INTO "wanjiedaoyou_secret_realms" ("id", "enabled") VALUES ('tianling', true) ON CONFLICT ("id") DO NOTHING;
