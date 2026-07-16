DROP INDEX "pol_company_links_unique";--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD CONSTRAINT "pol_company_links_unique" UNIQUE NULLS NOT DISTINCT("mp_id","company_id","relationship","start_date");
