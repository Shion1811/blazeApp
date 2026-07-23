CREATE TABLE "trial_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" varchar(255) NOT NULL,
	"trial_date" date NOT NULL,
	"name" varchar(100) NOT NULL,
	"furigana" varchar(100) NOT NULL,
	"gender" varchar(10) NOT NULL,
	"birth_date" date NOT NULL,
	"school_name" varchar(100) NOT NULL,
	"cram_school" varchar(100),
	"phone_number" varchar(20) NOT NULL,
	"motivation" varchar(20) NOT NULL,
	"motivation_other" varchar(200),
	"referrer_name" varchar(100)
);
