-- Local preservation layer. Upstream's unreleased reset is not valid for live
-- V5 progression: retain every source row, then reuse the author's 0034/0042
-- six-method normalization and maximum unlocked meridian depth.
DO $$
DECLARE table_name text; snapshot_value text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'wanjiedaoyou_sect_memberships', 'wanjiedaoyou_sect_method_progress',
    'wanjiedaoyou_sect_path_progress', 'wanjiedaoyou_sect_ability_loadouts',
    'wanjiedaoyou_sect_meridian_loadouts'
  ] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)::text FROM %I t', table_name)
      INTO snapshot_value;
    INSERT INTO "wanjiedaoyou_app_settings" ("key", "value")
      VALUES ('custom-v0415:before:' || table_name, snapshot_value);
  END LOOP;
  IF EXISTS (SELECT 1 FROM "wanjiedaoyou_combat_v6_equipment_loadouts")
    OR EXISTS (SELECT 1 FROM "wanjiedaoyou_combat_v6_manual_states")
    OR EXISTS (SELECT 1 FROM "wanjiedaoyou_combat_v6_beasts")
    OR EXISTS (SELECT 1 FROM "wanjiedaoyou_combat_v6_beast_lineups")
    OR EXISTS (SELECT 1 FROM "wanjiedaoyou_combat_v6_meridian_loadouts")
    OR EXISTS (SELECT 1 FROM "wanjiedaoyou_combat_v6_replay_archives") THEN
    RAISE EXCEPTION 'Previously deployed V6 assets require a dedicated migration; no assets were removed';
  END IF;
END $$;
--> statement-breakpoint
CREATE TEMP TABLE daoyou_v0415_sect_states ON COMMIT DROP AS
SELECT p.membership_id, p.revision, p.meridian_depth,
  -- Explicit evidence: current jiujie/presentation.ts names these old act IDs
  -- as 霹雳真君 / 踏雷天尊, matching the final V6 path definitions.
  CASE WHEN m.sect_id = 'jiujie' AND m.active_path_id = 'calamity-eye' THEN 'jiujie.path.law'
       WHEN m.sect_id = 'jiujie' AND m.active_path_id = 'heavenly-condemnation' THEN 'jiujie.path.thunder'
       ELSE NULL END::varchar(160) AS active_path_id,
  m.active_path_id AS old_active_path_id
FROM "wanjiedaoyou_combat_v6_build_profiles" p
JOIN "wanjiedaoyou_sect_memberships" m ON m.id = p.membership_id;
--> statement-breakpoint
CREATE TEMP TABLE daoyou_v0415_sect_methods ON COMMIT DROP AS
SELECT p.membership_id, x.method_id, x.level
FROM "wanjiedaoyou_combat_v6_method_progress" x
JOIN "wanjiedaoyou_combat_v6_build_profiles" p ON p.id = x.profile_id;
--> statement-breakpoint
INSERT INTO "wanjiedaoyou_app_settings" ("key", "value")
SELECT 'custom-v0415:sect-adaptation', jsonb_build_object(
  'states', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM daoyou_v0415_sect_states s),
  'methods', (SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM daoyou_v0415_sect_methods m),
  'nodePolicy', 'Old node choices remain in the source archive; unlocked depth is retained so V6 nodes can be selected for free.',
  'unmappedPathPolicy', 'No guessed mapping: retain unselected path and the inherited methods/depth.'
)::text;
--> statement-breakpoint
-- Preserve V5 sect migration inputs before any destructive cutover statement.
-- Drizzle runs preservation and schema changes in the same transaction.
-- Compensation remains an explicit action in the temporary admin tool.
DO $$
BEGIN
  PERFORM pg_advisory_xact_lock(74612001);
  LOCK TABLE "wanjiedaoyou_sect_memberships", "wanjiedaoyou_sect_method_progress",
    "wanjiedaoyou_sect_path_progress", "wanjiedaoyou_sect_meridian_loadouts" IN SHARE MODE;
  IF EXISTS (
    SELECT 1 FROM "wanjiedaoyou_app_settings" WHERE "key" LIKE 'sect-migration:v1:%'
  ) THEN
    RAISE EXCEPTION 'Sect migration records already exist; inspect them before cutover. Existing sources must not be overwritten.';
  END IF;

  INSERT INTO "wanjiedaoyou_app_settings" ("key", "value")
  SELECT 'sect-migration:v1:pending:' || m.id, jsonb_build_object(
    'membershipId', m.id, 'cultivatorId', m.cultivator_id, 'sectId', m.sect_id,
    'activePathId', m.active_path_id,
    'methods', COALESCE((SELECT jsonb_agg(jsonb_build_object('methodId', p.method_id, 'level', p.level) ORDER BY p.method_id)
      FROM wanjiedaoyou_sect_method_progress p WHERE p.membership_id = m.id), '[]'::jsonb),
    'paths', COALESCE((SELECT jsonb_agg(jsonb_build_object('pathId', p.path_id, 'unlockedLayerIds', p.unlocked_layer_ids) ORDER BY p.path_id)
      FROM wanjiedaoyou_sect_path_progress p WHERE p.membership_id = m.id), '[]'::jsonb),
    'meridianLoadouts', COALESCE((SELECT jsonb_agg(jsonb_build_object('pathId', p.path_id, 'slot', p.slot, 'nodeIds', p.node_ids) ORDER BY p.path_id, p.slot)
      FROM wanjiedaoyou_sect_meridian_loadouts p WHERE p.membership_id = m.id), '[]'::jsonb)
  )::text FROM wanjiedaoyou_sect_memberships m WHERE m.status = 'active';

  INSERT INTO "wanjiedaoyou_app_settings" ("key", "value")
  SELECT 'sect-migration:v1:manifest', jsonb_build_object(
    'stagedAt', now(), 'membershipIds', COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb)
  )::text FROM wanjiedaoyou_sect_memberships WHERE status = 'active';
END $$;
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_replay_archives" (
	"battle_id" uuid PRIMARY KEY NOT NULL,
	"metadata_version" integer NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"battle_type" varchar(64) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"engine_version" varchar(40) NOT NULL,
	"ruleset_version" varchar(60) NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp NOT NULL,
	"outcome" varchar(24) NOT NULL,
	"replay" jsonb NOT NULL,
	"round_count" integer DEFAULT 0 NOT NULL,
	"sides" jsonb DEFAULT '[[],[]]'::jsonb NOT NULL,
	"playable" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_replay_participants" (
	"battle_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"side" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wanjiedaoyou_combat_replay_participants_battle_id_cultivator_id_pk" PRIMARY KEY("battle_id","cultivator_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_beast_lineups" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"lineup" jsonb NOT NULL,
	"starter_claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_beasts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"individual" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_equipment_slots" (
	"cultivator_id" uuid NOT NULL,
	"slot" varchar(32) NOT NULL,
	"equipment_instance_id" varchar(160) NOT NULL,
	CONSTRAINT "wanjiedaoyou_cultivator_equipment_slots_cultivator_id_slot_pk" PRIMARY KEY("cultivator_id","slot")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_manual_slots" (
	"cultivator_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"manual_id" varchar(160) NOT NULL,
	CONSTRAINT "wanjiedaoyou_cultivator_manual_slots_cultivator_id_slot_pk" PRIMARY KEY("cultivator_id","slot"),
	CONSTRAINT "cultivator_manual_slot_valid" CHECK ("wanjiedaoyou_cultivator_manual_slots"."slot" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_manual_states" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"learned" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cultivator_manual_revision_valid" CHECK ("wanjiedaoyou_cultivator_manual_states"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_combat_states" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"active_path_id" varchar(160),
	"meridian_depth" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sect_combat_progress_valid" CHECK ("wanjiedaoyou_sect_combat_states"."revision" >= 0 AND "wanjiedaoyou_sect_combat_states"."meridian_depth" BETWEEN 0 AND 7)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_meridian_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loadout_id" uuid NOT NULL,
	"node_id" varchar(160) NOT NULL,
	"layer" integer NOT NULL
);
--> statement-breakpoint
-- Unreleased V6 hard cutover: V5 sect inputs are preserved above for admin migration.
DROP TABLE "wanjiedaoyou_combat_v6_manual_slots";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_manual_states";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_equipment_loadouts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_meridian_nodes";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_meridian_loadouts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_method_progress";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_build_profiles";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_beast_lineups";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_beasts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_replay_participants";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_replay_archives";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_sect_ability_loadouts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_sect_path_progress";--> statement-breakpoint
DELETE FROM "wanjiedaoyou_sect_meridian_loadouts";--> statement-breakpoint
DELETE FROM "wanjiedaoyou_sect_method_progress";--> statement-breakpoint
DROP INDEX "sect_meridian_membership_path_slot_unique";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ALTER COLUMN "path_id" SET DATA TYPE varchar(160);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ALTER COLUMN "path_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_method_progress" ALTER COLUMN "method_id" SET DATA TYPE varchar(160);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_replay_participants" ADD CONSTRAINT "wanjiedaoyou_combat_replay_participants_battle_id_wanjiedaoyou_combat_replay_archives_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."wanjiedaoyou_combat_replay_archives"("battle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_beast_lineups" ADD CONSTRAINT "wanjiedaoyou_cultivator_beast_lineups_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_beasts" ADD CONSTRAINT "wanjiedaoyou_cultivator_beasts_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_owner_id_unique" ON "wanjiedaoyou_inventory_items" USING btree ("cultivator_id","id");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_equipment_slots" ADD CONSTRAINT "wanjiedaoyou_cultivator_equipment_slots_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_equipment_slots" ADD CONSTRAINT "wanjiedaoyou_cultivator_equipment_slots_cultivator_id_equipment_instance_id_wanjiedaoyou_inventory_items_cultivator_id_id_fk" FOREIGN KEY ("cultivator_id","equipment_instance_id") REFERENCES "public"."wanjiedaoyou_inventory_items"("cultivator_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_manual_slots" ADD CONSTRAINT "wanjiedaoyou_cultivator_manual_slots_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_manual_states" ADD CONSTRAINT "wanjiedaoyou_cultivator_manual_states_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_combat_states" ADD CONSTRAINT "wanjiedaoyou_sect_combat_states_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_nodes" ADD CONSTRAINT "wanjiedaoyou_sect_meridian_nodes_loadout_id_wanjiedaoyou_sect_meridian_loadouts_id_fk" FOREIGN KEY ("loadout_id") REFERENCES "public"."wanjiedaoyou_sect_meridian_loadouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "combat_replay_source_idempotency_uidx" ON "wanjiedaoyou_combat_replay_archives" USING btree ("source_type","idempotency_key");--> statement-breakpoint
CREATE INDEX "combat_replay_finished_idx" ON "wanjiedaoyou_combat_replay_archives" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "combat_replay_participant_cultivator_idx" ON "wanjiedaoyou_combat_replay_participants" USING btree ("cultivator_id","battle_id");--> statement-breakpoint
CREATE INDEX "cultivator_beasts_owner_idx" ON "wanjiedaoyou_cultivator_beasts" USING btree ("cultivator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_equipment_instance_unique" ON "wanjiedaoyou_cultivator_equipment_slots" USING btree ("equipment_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_manual_unique" ON "wanjiedaoyou_cultivator_manual_slots" USING btree ("cultivator_id","manual_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_loadout_node_unique" ON "wanjiedaoyou_sect_meridian_nodes" USING btree ("loadout_id","node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_loadout_layer_unique" ON "wanjiedaoyou_sect_meridian_nodes" USING btree ("loadout_id","layer");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_membership_path_unique" ON "wanjiedaoyou_sect_meridian_loadouts" USING btree ("membership_id","path_id");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" DROP COLUMN "active_path_id";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "slot";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "node_ids";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_method_progress" DROP COLUMN "updated_at";
--> statement-breakpoint
-- Resume the normalized live progression in the final ownership model.
INSERT INTO "wanjiedaoyou_sect_combat_states"
  ("membership_id", "revision", "meridian_depth", "active_path_id")
SELECT membership_id, revision, meridian_depth, active_path_id
FROM daoyou_v0415_sect_states;
--> statement-breakpoint
INSERT INTO "wanjiedaoyou_sect_method_progress" ("membership_id", "method_id", "level")
SELECT membership_id, method_id, level FROM daoyou_v0415_sect_methods;
--> statement-breakpoint
INSERT INTO "wanjiedaoyou_sect_meridian_loadouts" ("membership_id", "path_id", "revision")
SELECT s.membership_id, paths.path_id, 0
FROM daoyou_v0415_sect_states s
CROSS JOIN (VALUES ('jiujie.path.law'), ('jiujie.path.thunder')) paths(path_id)
WHERE s.active_path_id IN ('jiujie.path.law', 'jiujie.path.thunder');
