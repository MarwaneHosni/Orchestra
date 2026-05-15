CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"provider" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'unverified' NOT NULL,
	"encrypted_api_key" text,
	"key_reference" text,
	"default_model" varchar(100),
	"models_available" text,
	"last_verified_at" timestamp with time zone,
	"error_message" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_creds_user_id_idx" ON "provider_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_creds_project_id_idx" ON "provider_credentials" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "provider_creds_provider_idx" ON "provider_credentials" USING btree ("provider");