CREATE TABLE IF NOT EXISTS "community_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_profile_id" integer NOT NULL,
	"blocked_profile_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"profile_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"profile_id" integer NOT NULL,
	"body" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"nickname" text NOT NULL,
	"avatar_icon" text DEFAULT 'bear' NOT NULL,
	"child_age_months" integer,
	"show_child_age" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "community_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"profile_id" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"reporter_profile_id" integer NOT NULL,
	"target_profile_id" integer NOT NULL,
	"reason" text DEFAULT '不適切な投稿' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"trigger_log_types" text,
	"age_months_min" integer,
	"age_months_max" integer,
	"max_members" integer DEFAULT 100 NOT NULL,
	"current_members" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "community_rooms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mama_health_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"user_id" text NOT NULL,
	"recorded_date" date NOT NULL,
	"bowel_movement" boolean,
	"bowel_note" text,
	"lochia_state" text,
	"perineum_pain" integer,
	"mood" integer,
	"sleep_hours" integer,
	"sleep_minutes" integer,
	"breastfeeding_trouble" text,
	"weight_kg" text,
	"has_edema" boolean,
	"holding_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mama_medicine_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"user_id" text NOT NULL,
	"medicine_name" text NOT NULL,
	"dosage" text,
	"memo" text,
	"taken_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotion_impressions" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer NOT NULL,
	"family_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sponsor_id" integer,
	"trigger_log_type" text NOT NULL,
	"trigger_time_start" integer,
	"trigger_time_end" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"impression_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"cta_url" text,
	"cta_label" text,
	"display_type" text DEFAULT 'banner' NOT NULL,
	"target_log_types" text,
	"weight" integer DEFAULT 1 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsored_coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"sponsor_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"points_cost" integer NOT NULL,
	"remaining_stock" integer,
	"quantity" integer,
	"discount_value" integer,
	"discount_type" text,
	"exchanged_at" timestamp,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"website_url" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
