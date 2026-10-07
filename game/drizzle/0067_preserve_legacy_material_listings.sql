-- Convert only supported ordinary V5 material listings; keep seller, listing ID,
-- price, quantities, privacy, buyer restriction and expiry exactly unchanged.
-- Unsupported live assets stop the transaction, rather than disappearing.
LOCK TABLE "wanjiedaoyou_auction_listings" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "wanjiedaoyou_auction_listings"
    WHERE status = 'active' AND coalesce(item_snapshot->>'version', '') NOT IN ('inventory_v1', 'beast_v1')
      AND (item_type <> 'material'
        OR coalesce(item_snapshot->>'type', '') NOT IN ('herb','ore','tcdb','aux','monster','gongfa_manual','skill_manual')
        OR coalesce(item_snapshot->>'rank', '') NOT IN ('凡品','灵品','玄品','真品','地品','天品','仙品','神品')
        OR (item_snapshot->>'element' IS NOT NULL AND item_snapshot->>'element' NOT IN ('金','木','水','火','土','风','雷','冰'))
        OR coalesce(length(trim(item_snapshot->>'name')), 0) NOT BETWEEN 1 AND 100
        OR length(coalesce(item_snapshot->>'description', '')) > 4000
        OR initial_quantity NOT BETWEEN 1 AND 99
        OR remaining_quantity NOT BETWEEN 1 AND initial_quantity)
  ) THEN
    RAISE EXCEPTION 'Unsupported active legacy listing: return it through the old application before migration';
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO "wanjiedaoyou_app_settings" ("key", "value")
SELECT 'custom-v0415:before:active-listings', coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.id), '[]'::jsonb)::text
FROM "wanjiedaoyou_auction_listings" l
WHERE status = 'active' AND coalesce(item_snapshot->>'version', '') NOT IN ('inventory_v1', 'beast_v1');
--> statement-breakpoint
UPDATE "wanjiedaoyou_auction_listings"
SET item_snapshot = jsonb_build_object('version', 'inventory_v1', 'item',
  jsonb_build_object('definitionId', 'material.v1', 'quantity', initial_quantity,
    'instanceData', jsonb_build_object(
      'name', item_snapshot->>'name', 'type', item_snapshot->>'type',
      'rank', item_snapshot->>'rank', 'element', item_snapshot->'element',
      'description', coalesce(item_snapshot->>'description', '')
    )))
WHERE status = 'active' AND item_type = 'material'
  AND coalesce(item_snapshot->>'version', '') NOT IN ('inventory_v1', 'beast_v1');
