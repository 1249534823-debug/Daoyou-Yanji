CREATE TABLE "wanjiedaoyou_market_purchase_receipts" (
	"user_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"layer" varchar(16) NOT NULL,
	"cycle" bigint NOT NULL,
	"listing_id" text NOT NULL,
	"legacy" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_purchase_receipts_pk" PRIMARY KEY("user_id","node_id","layer","cycle","listing_id")
);
