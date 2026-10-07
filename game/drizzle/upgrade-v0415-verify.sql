-- Run immediately after SQL + library snapshots, before ANY new writer starts.
-- Fails on any unexplained asset change; does not repair or write data.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE tname text; before_value jsonb; after_value jsonb; mismatch integer;
        before_row jsonb; current_row jsonb; r integer; s integer; natural_delta integer; free_delta integer;
        adaptation jsonb; expected jsonb; actual jsonb; receipt jsonb; sku jsonb; retired_sku boolean;
BEGIN
  FOREACH tname IN ARRAY ARRAY[
    'wanjiedaoyou_materials', 'wanjiedaoyou_consumables', 'wanjiedaoyou_creation_products',
    'wanjiedaoyou_market_purchase_receipts', 'wanjiedaoyou_secret_realms',
    'wanjiedaoyou_secret_realm_runs', 'wanjiedaoyou_secret_realm_audit',
    'wanjiedaoyou_admin_power_template_history', 'wanjiedaoyou_spirit_stone_daily',
    'wanjiedaoyou_spirit_stone_ledger', 'wanjiedaoyou_spirit_stone_tracking',
    'wanjiedaoyou_npc_actors', 'wanjiedaoyou_npc_action_logs',
    'wanjiedaoyou_npc_admin_audit', 'wanjiedaoyou_npc_world_settings'
  ] LOOP
    SELECT value::jsonb INTO before_value FROM wanjiedaoyou_app_settings WHERE key='custom-v0415:integrity:' || tname;
    IF before_value IS NULL THEN RAISE EXCEPTION 'Missing preservation evidence: %', tname; END IF;
    EXECUTE format('SELECT jsonb_build_object(''count'', count(*), ''checksum'', md5(coalesce(string_agg(to_jsonb(t)::text, E''\n'' ORDER BY to_jsonb(t)::text), ''''))) FROM %I t', tname) INTO after_value;
    IF before_value IS DISTINCT FROM after_value THEN RAISE EXCEPTION 'Preserved table changed: %', tname; END IF;
  END LOOP;
  SELECT value::jsonb INTO before_value FROM wanjiedaoyou_app_settings WHERE key='custom-v0415:before:cultivators';
  IF before_value IS NULL OR jsonb_array_length(before_value) <> (SELECT count(*) FROM wanjiedaoyou_cultivators) THEN
    RAISE EXCEPTION 'Player count changed or evidence missing';
  END IF;
  FOR before_row IN SELECT value FROM jsonb_array_elements(before_value) LOOP
    SELECT to_jsonb(c) INTO current_row FROM wanjiedaoyou_cultivators c WHERE id=(before_row->>'id')::uuid;
    r := array_position(ARRAY['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫'], before_row->>'realm') - 1;
    s := array_position(ARRAY['初期','中期','后期','圆满'], before_row->>'realm_stage') - 1;
    natural_delta := 5 + 10*r + 3*s;
    free_delta := 25 + 50*r + 15*s;
    expected := before_row || jsonb_build_object(
      'vitality', (before_row->>'vitality')::int + natural_delta,
      'strength', (before_row->>'strength')::int + natural_delta,
      'spirit', (before_row->>'spirit')::int + natural_delta,
      'endurance', (before_row->>'endurance')::int + natural_delta,
      'speed', (before_row->>'speed')::int + natural_delta,
      'willpower', (before_row->>'willpower')::int + natural_delta,
      'unallocated_attribute_points', (before_row->>'unallocated_attribute_points')::int + free_delta);
    IF expected IS DISTINCT FROM current_row THEN RAISE EXCEPTION 'Player facts differ beyond author additive attribute budget: %', before_row->>'id'; END IF;
  END LOOP;
  SELECT value::jsonb INTO before_value FROM wanjiedaoyou_app_settings WHERE key='custom-v0415:before:active-listings';
  IF before_value IS NULL THEN RAISE EXCEPTION 'Missing active listing archive'; END IF;
  FOR before_row IN SELECT value FROM jsonb_array_elements(before_value) LOOP
    SELECT to_jsonb(l) INTO current_row FROM wanjiedaoyou_auction_listings l WHERE id=(before_row->>'id')::uuid;
    expected := jsonb_build_object('version','inventory_v1','item',jsonb_build_object(
      'definitionId','material.v1', 'quantity', (before_row->>'initial_quantity')::int,
      'instanceData',jsonb_build_object('name',before_row->'item_snapshot'->>'name',
        'type',before_row->'item_snapshot'->>'type','rank',before_row->'item_snapshot'->>'rank',
        'element',before_row->'item_snapshot'->'element','description',coalesce(before_row->'item_snapshot'->>'description',''))));
    IF (current_row-'item_snapshot') IS DISTINCT FROM (before_row-'item_snapshot') OR current_row->'item_snapshot' IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'Listing identity, ownership, funds or facts changed: %', before_row->>'id';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM wanjiedaoyou_auction_listings WHERE status='active' AND coalesce(item_snapshot->>'version','') NOT IN ('inventory_v1','beast_v1')) THEN
    RAISE EXCEPTION 'An active listing is not usable by V6';
  END IF;
  SELECT value::jsonb INTO adaptation FROM wanjiedaoyou_app_settings WHERE key='custom-v0415:sect-adaptation';
  IF adaptation IS NULL THEN RAISE EXCEPTION 'Missing sect adaptation archive'; END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'membership_id',x->>'method_id'),'[]'::jsonb) INTO expected FROM jsonb_array_elements(adaptation->'methods') x;
  SELECT coalesce(jsonb_agg(jsonb_build_object('membership_id',p.membership_id,'method_id',p.method_id,'level',p.level) ORDER BY p.membership_id::text,p.method_id),'[]'::jsonb) INTO actual FROM wanjiedaoyou_sect_method_progress p;
  IF expected IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Mapped sect method progression differs'; END IF;
  FOR before_row IN SELECT value FROM jsonb_array_elements(adaptation->'states') LOOP
    SELECT jsonb_build_object('membership_id',membership_id,'revision',revision,'meridian_depth',meridian_depth,'active_path_id',active_path_id) INTO actual
      FROM wanjiedaoyou_sect_combat_states WHERE membership_id=(before_row->>'membership_id')::uuid;
    IF (before_row-'old_active_path_id') IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Sect unlocked depth or path changed'; END IF;
  END LOOP;
  SELECT value::jsonb INTO before_value FROM wanjiedaoyou_app_settings WHERE key='custom-v0415:before:wanjiedaoyou_sect_memberships';
  IF before_value IS NULL OR jsonb_array_length(before_value)<>(SELECT count(*) FROM wanjiedaoyou_sect_memberships) THEN RAISE EXCEPTION 'Sect membership evidence missing or count differs'; END IF;
  FOR before_row IN SELECT value FROM jsonb_array_elements(before_value) LOOP
    SELECT to_jsonb(m) INTO actual FROM wanjiedaoyou_sect_memberships m WHERE id=(before_row->>'id')::uuid;
    IF (before_row-'active_path_id') IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Sect membership contribution or membership facts changed'; END IF;
  END LOOP;
  SELECT value::jsonb INTO receipt FROM wanjiedaoyou_app_settings WHERE key='custom-v0415:library-snapshots';
  IF receipt IS NULL THEN RAISE EXCEPTION 'Shop snapshot adaptation has not completed'; END IF;
  FOR tname IN SELECT unnest(ARRAY['wanjiedaoyou_reputation_shop_items','wanjiedaoyou_sect_shop_items']) LOOP
    SELECT value::jsonb INTO before_value FROM wanjiedaoyou_app_settings WHERE key=CASE WHEN tname='wanjiedaoyou_reputation_shop_items' THEN 'custom-v0415:before:reputation-shop' ELSE 'custom-v0415:before:sect-shop' END;
    FOR sku IN SELECT value FROM jsonb_array_elements(before_value) LOOP
      EXECUTE format('SELECT to_jsonb(s) FROM %I s WHERE id=$1',tname) INTO actual USING (sku->>'id')::uuid;
      retired_sku := EXISTS (SELECT 1 FROM jsonb_array_elements(receipt->'retired') x WHERE x->>'table'=tname AND x->>'shopId'=sku->>'id');
      IF (actual-'item_snapshot'-'status') IS DISTINCT FROM (sku-'item_snapshot'-'status') THEN RAISE EXCEPTION 'SKU identity/price/quantity/limit changed: %', sku->>'id'; END IF;
      IF retired_sku THEN
        IF actual->>'status'<>'archived' THEN RAISE EXCEPTION 'Retired author feature remains on sale'; END IF;
      ELSIF sku->>'status'='active' THEN
        IF actual->>'status'<>'active' OR actual->'item_snapshot'='null'::jsonb OR actual->'item_snapshot' IS NULL THEN RAISE EXCEPTION 'An active supported SKU was lost: %',sku->>'id'; END IF;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'PASS: 15 custom/legacy tables byte-equivalent; all players/currency preserved with exact additive attributes; listings, sect progression and shops preserved';
END $$;
SELECT jsonb_build_object(
  'players',(SELECT count(*) FROM wanjiedaoyou_cultivators),
  'spiritStones',(SELECT sum(spirit_stones) FROM wanjiedaoyou_cultivators),
  'legacyMaterialQuantity',(SELECT sum(quantity) FROM wanjiedaoyou_materials),
  'legacyConsumableQuantity',(SELECT sum(quantity) FROM wanjiedaoyou_consumables),
  'legacyCreationProducts',(SELECT count(*) FROM wanjiedaoyou_creation_products),
  'activeListings',(SELECT count(*) FROM wanjiedaoyou_auction_listings WHERE status='active'),
  'activeReputationSKUs',(SELECT count(*) FROM wanjiedaoyou_reputation_shop_items WHERE status='active'),
  'activeSectSKUs',(SELECT count(*) FROM wanjiedaoyou_sect_shop_items WHERE status='active'),
  'retiredSKUs',(SELECT jsonb_array_length(value::jsonb->'retired') FROM wanjiedaoyou_app_settings WHERE key='custom-v0415:library-snapshots')
) AS preserved_assets;
ROLLBACK;
