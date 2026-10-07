CREATE TABLE "wanjiedaoyou_cross_server_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"peer_site_id" uuid NOT NULL,
	"local_cultivator_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"status" varchar(12) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"invitation" jsonb NOT NULL,
	"receipt" jsonb,
	"opponent_name" varchar(100) NOT NULL,
	"winner" varchar(4),
	"round_count" integer,
	"last_error" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cross_server_peers" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"api_base_url" text NOT NULL,
	"public_key" text NOT NULL,
	"combat_hash" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"checked_at" timestamp with time zone,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cross_server_profiles" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cross_server_challenges" ADD CONSTRAINT "wanjiedaoyou_cross_server_challenges_peer_site_id_wanjiedaoyou_cross_server_peers_site_id_fk" FOREIGN KEY ("peer_site_id") REFERENCES "public"."wanjiedaoyou_cross_server_peers"("site_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cross_server_challenges" ADD CONSTRAINT "wanjiedaoyou_cross_server_challenges_local_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("local_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cross_server_profiles" ADD CONSTRAINT "wanjiedaoyou_cross_server_profiles_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cross_server_local_history_idx" ON "wanjiedaoyou_cross_server_challenges" USING btree ("local_cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "cross_server_peer_status_idx" ON "wanjiedaoyou_cross_server_challenges" USING btree ("peer_site_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cross_server_peer_base_url_unique" ON "wanjiedaoyou_cross_server_peers" USING btree ("api_base_url");