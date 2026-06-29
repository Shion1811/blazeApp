ALTER TABLE "achievement" DROP CONSTRAINT "achievement_admin_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "game" DROP CONSTRAINT "game_admin_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "news" DROP CONSTRAINT "news_admin_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reply" DROP CONSTRAINT "reply_admin_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "achievement" ALTER COLUMN "admin_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ALTER COLUMN "admin_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ALTER COLUMN "admin_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reply" ALTER COLUMN "admin_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "achievement" ADD CONSTRAINT "achievement_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;