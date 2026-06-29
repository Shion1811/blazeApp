CREATE TABLE "achievement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"title" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"img" varchar(500),
	"movie" varchar(500),
	"file" varchar(500),
	"admin_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"path" varchar(500) NOT NULL,
	"inquiry_id" uuid,
	"reply_id" uuid,
	"achievement_id" uuid
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"img" varchar(500),
	"admin_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"path" varchar(500) NOT NULL,
	"news_id" uuid,
	"inquiry_id" uuid,
	"reply_id" uuid,
	"achievement_id" uuid,
	"game_id" uuid
);
--> statement-breakpoint
CREATE TABLE "inquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL,
	"title" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"img" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"path" varchar(500) NOT NULL,
	"achievement_id" uuid
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"title" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"img" varchar(500),
	"type" varchar(10) NOT NULL,
	"admin_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"title" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"img" varchar(500),
	"file" varchar(500)
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_issued_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "achievement" ADD CONSTRAINT "achievement_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_inquiry_id_inquiry_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_reply_id_reply_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."reply"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_achievement_id_achievement_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_inquiry_id_inquiry_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_reply_id_reply_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."reply"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_achievement_id_achievement_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_achievement_id_achievement_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_inquiry_id_inquiry_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;