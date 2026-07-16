CREATE TABLE "itms_project_politician_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"mp_id" integer NOT NULL,
	"path_type" text NOT NULL,
	"event_date" text NOT NULL,
	"event_date_basis" text NOT NULL,
	"rpvs_registration_id" integer NOT NULL,
	"rpvs_partner_id" integer NOT NULL,
	"rpvs_beneficial_owner_id" integer NOT NULL,
	"rpvs_registration_source_url" text NOT NULL,
	"rpvs_beneficial_owner_source_url" text NOT NULL,
	"politician_source_url" text NOT NULL,
	"verified_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itms_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"itms_id" integer NOT NULL,
	"source_state" text NOT NULL,
	"project_code" text NOT NULL,
	"title_sk" text NOT NULL,
	"contract_number" text,
	"recipient_ico" text,
	"recipient_subject_id" integer,
	"contracted_amount" double precision NOT NULL,
	"effective_date" text,
	"status" text,
	"source_updated_at" text,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_registry_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" text NOT NULL,
	"ico" text NOT NULL,
	"registered_from" text,
	"registered_to" text,
	"source_url" text NOT NULL,
	CONSTRAINT "party_registry_identities_unique" UNIQUE NULLS NOT DISTINCT("party_id","ico","registered_from")
);
--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD COLUMN "identity_source_url" text;--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD COLUMN "identity_birth_date" text;--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD COLUMN "verification_method" text;--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD COLUMN "review_status" text DEFAULT 'needs_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD COLUMN "verified_at" text;--> statement-breakpoint
ALTER TABLE "itms_project_politician_links" ADD CONSTRAINT "itms_project_politician_links_project_id_itms_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."itms_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itms_project_politician_links" ADD CONSTRAINT "itms_project_politician_links_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_registry_identities" ADD CONSTRAINT "party_registry_identities_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "itms_project_politician_links_project_idx" ON "itms_project_politician_links" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "itms_project_politician_links_mp_idx" ON "itms_project_politician_links" USING btree ("mp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "itms_project_politician_links_path_unique" ON "itms_project_politician_links" USING btree ("project_id","mp_id","rpvs_registration_id","rpvs_beneficial_owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "itms_projects_itms_id_unique" ON "itms_projects" USING btree ("itms_id");--> statement-breakpoint
CREATE INDEX "itms_projects_recipient_ico_idx" ON "itms_projects" USING btree ("recipient_ico");--> statement-breakpoint
CREATE INDEX "itms_projects_effective_date_idx" ON "itms_projects" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "itms_projects_amount_idx" ON "itms_projects" USING btree ("contracted_amount");--> statement-breakpoint
CREATE INDEX "party_registry_identities_ico_idx" ON "party_registry_identities" USING btree ("ico");