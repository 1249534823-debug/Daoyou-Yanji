-- Apply transactionally; abort rather than wait indefinitely behind gameplay writes.
SET LOCAL lock_timeout = '3s';
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_spirit_stone_daily" (
	"cultivator_id" uuid NOT NULL,
	"day" date NOT NULL,
	"player_name" varchar(100) NOT NULL,
	"realm" varchar(20) NOT NULL,
	"stage" varchar(10) NOT NULL,
	"income" bigint DEFAULT 0 NOT NULL,
	"expense" bigint DEFAULT 0 NOT NULL,
	"transaction_count" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "wanjiedaoyou_spirit_stone_daily_cultivator_id_day_pk" PRIMARY KEY("cultivator_id","day")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_spirit_stone_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"day" date NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(128) NOT NULL,
	"delta" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_spirit_stone_tracking" (
	"id" integer PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "spirit_stone_daily_day_idx" ON "wanjiedaoyou_spirit_stone_daily" USING btree ("day");--> statement-breakpoint
CREATE INDEX "spirit_stone_ledger_player_day_idx" ON "wanjiedaoyou_spirit_stone_ledger" USING btree ("cultivator_id","day","id");
--> statement-breakpoint
CREATE FUNCTION public.wanjiedaoyou_track_spirit_stones() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  previous_balance integer;
  change_amount integer;
  happened_at timestamptz;
  happened_day date;
  event_source varchar(128);
BEGIN
  previous_balance := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.spirit_stones END;
  change_amount := NEW.spirit_stones - previous_balance;
  IF change_amount = 0 THEN RETURN NEW; END IF;
  happened_at := clock_timestamp();
  happened_day := (happened_at AT TIME ZONE 'Asia/Shanghai')::date;
  event_source := COALESCE(NULLIF(left(current_setting('daoyou.spirit_stone_source', true),128),''), CASE WHEN TG_OP='INSERT' THEN 'character_initial' ELSE 'other' END);
  INSERT INTO public.wanjiedaoyou_spirit_stone_ledger(cultivator_id,day,occurred_at,source,delta,balance_before,balance_after)
  VALUES(NEW.id,happened_day,happened_at,event_source,change_amount,previous_balance,NEW.spirit_stones);
  INSERT INTO public.wanjiedaoyou_spirit_stone_daily(cultivator_id,day,player_name,realm,stage,income,expense,transaction_count)
  VALUES(NEW.id,happened_day,NEW.name,NEW.realm,NEW.realm_stage,greatest(change_amount,0)::bigint,greatest(-change_amount,0)::bigint,1)
  ON CONFLICT(cultivator_id,day) DO UPDATE SET
    player_name=EXCLUDED.player_name,realm=EXCLUDED.realm,stage=EXCLUDED.stage,
    income=wanjiedaoyou_spirit_stone_daily.income+EXCLUDED.income,
    expense=wanjiedaoyou_spirit_stone_daily.expense+EXCLUDED.expense,
    transaction_count=wanjiedaoyou_spirit_stone_daily.transaction_count+1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER wanjiedaoyou_spirit_stone_capture
AFTER INSERT OR UPDATE OF spirit_stones ON public.wanjiedaoyou_cultivators
FOR EACH ROW EXECUTE FUNCTION public.wanjiedaoyou_track_spirit_stones();
--> statement-breakpoint
-- Existing balances are not earnings. Coverage begins with this installation only.
INSERT INTO public.wanjiedaoyou_spirit_stone_tracking(id,started_at) VALUES(1,clock_timestamp());
