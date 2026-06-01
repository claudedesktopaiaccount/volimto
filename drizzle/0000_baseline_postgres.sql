CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"key_hash" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"stripe_subscription_id" text,
	"created_at" text NOT NULL,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_id" text NOT NULL,
	"date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" text NOT NULL,
	"name" text NOT NULL,
	"list_rank" integer NOT NULL,
	"role" text,
	"portrait_url" text
);
--> statement-breakpoint
CREATE TABLE "coalition_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"party_ids" text NOT NULL,
	"combined_probability" double precision,
	"predicted_seats" integer,
	"prediction_id" integer
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"ico" text NOT NULL,
	"name" text NOT NULL,
	"legal_form" text,
	"rpvs_ubo_url" text,
	"finstat_url" text,
	"founded_date" text,
	"sector" text,
	"address_sk" text
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_number" text,
	"title_sk" text NOT NULL,
	"contracting_authority" text NOT NULL,
	"supplier_ico" text NOT NULL,
	"supplier_name" text NOT NULL,
	"amount_eur" double precision NOT NULL,
	"signed_date" text NOT NULL,
	"cpv_code" text,
	"source_url" text NOT NULL,
	"linked_politician_id" integer
);
--> statement-breakpoint
CREATE TABLE "crowd_aggregates" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" text NOT NULL,
	"total_bets" integer DEFAULT 0 NOT NULL,
	"avg_predicted_pct" double precision,
	"computed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" text NOT NULL,
	"donor_name" text NOT NULL,
	"donor_ico" text,
	"amount_eur" double precision NOT NULL,
	"donation_date" text NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"visitor_id_hash" text NOT NULL,
	"timestamp" text NOT NULL,
	"records_affected" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kalkulator_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"answer_index" integer NOT NULL,
	"party_id" text NOT NULL,
	"weight" double precision DEFAULT 0 NOT NULL,
	"source_url" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_activity_scrape_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"last_attempt_at" text,
	"last_success_at" text,
	"next_eligible_at" text,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_amendments" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"to_law" text NOT NULL,
	"date" text NOT NULL,
	"url" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_assistants" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_foreign_trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"date" text NOT NULL,
	"country" text NOT NULL,
	"purpose" text,
	"cost_eur" double precision,
	"source_url" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_interpellations" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"date" text NOT NULL,
	"addressee" text,
	"subject" text NOT NULL,
	"url" text NOT NULL,
	"answer_url" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_legislation" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"cislo_tlace" text,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"status" text,
	"url" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_offices" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"date" text NOT NULL,
	"subject" text NOT NULL,
	"url" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mps" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_full" text NOT NULL,
	"name_display" text NOT NULL,
	"party_id" text,
	"role" text NOT NULL,
	"constituency" text,
	"birth_year" integer,
	"photo_url" text,
	"active_from" text,
	"active_to" text,
	"nrsr_person_id" text
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"published_at" text,
	"scraped_at" text NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" text NOT NULL,
	"confirmed_at" text,
	"unsubscribed_at" text,
	"source" text DEFAULT 'web'
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"sent_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"color" text NOT NULL,
	"secondary_color" text,
	"leader" text NOT NULL,
	"ideology" text,
	"seats" integer DEFAULT 0,
	"logo_url" text,
	"portrait_url" text
);
--> statement-breakpoint
CREATE TABLE "party_promises" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" text NOT NULL,
	"promise_text" text NOT NULL,
	"category" text NOT NULL,
	"is_pro" boolean NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'not_started' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politician_company_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"relationship" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"party_id" text NOT NULL,
	"percentage" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"agency" text NOT NULL,
	"published_date" text NOT NULL,
	"fieldwork_start" text,
	"fieldwork_end" text,
	"sample_size" integer,
	"source_url" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_narrative" (
	"id" text PRIMARY KEY NOT NULL,
	"input_hash" text NOT NULL,
	"narrative" text NOT NULL,
	"generated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"prediction_id" integer NOT NULL,
	"party_id" text NOT NULL,
	"predicted_pct" double precision NOT NULL,
	"lower_bound" double precision NOT NULL,
	"upper_bound" double precision NOT NULL,
	"win_probability" double precision NOT NULL,
	"parliament_probability" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"visitor_id" text,
	"election_id" text NOT NULL,
	"winner_score" double precision,
	"percentage_score" double precision,
	"coalition_score" double precision,
	"total_score" double precision DEFAULT 0 NOT NULL,
	"scored_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"generated_at" text NOT NULL,
	"model_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promises" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text NOT NULL,
	"source_date" text NOT NULL,
	"party_id" text,
	"mp_id" integer,
	"text_sk" text NOT NULL,
	"status" text DEFAULT 'nesplnený' NOT NULL,
	"evidence_vote_id" integer,
	"evidence_url" text,
	"ai_confidence" double precision
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scandal_analysis_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"scandal_id" integer NOT NULL,
	"case_summary_sk" text NOT NULL,
	"public_interest_sk" text NOT NULL,
	"legal_status_sk" text NOT NULL,
	"open_questions_sk" text NOT NULL,
	"actor_claims_json" text NOT NULL,
	"source_urls_json" text NOT NULL,
	"review_status" text DEFAULT 'needs_review' NOT NULL,
	"model" text NOT NULL,
	"created_at" text NOT NULL,
	"reviewed_at" text
);
--> statement-breakpoint
CREATE TABLE "scandal_claim_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_id" integer NOT NULL,
	"source_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scandal_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"scandal_id" integer NOT NULL,
	"mp_id" integer,
	"target_label" text NOT NULL,
	"claim_kind" text NOT NULL,
	"process_status" text NOT NULL,
	"responsibility_kind" text NOT NULL,
	"statement_sk" text NOT NULL,
	"why_relevant_sk" text,
	"evidence_excerpt_sk" text,
	"source_type" text,
	"counterpoint_sk" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scandal_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"scandal_id" integer NOT NULL,
	"event_date" text NOT NULL,
	"title_sk" text NOT NULL,
	"description_sk" text NOT NULL,
	"event_type" text NOT NULL,
	"source_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scandal_politician_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"scandal_id" integer NOT NULL,
	"mp_id" integer NOT NULL,
	"role_in_scandal" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scandal_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"scandal_id" integer NOT NULL,
	"url" text NOT NULL,
	"outlet_name" text NOT NULL,
	"published_date" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"archive_url" text
);
--> statement-breakpoint
CREATE TABLE "scandals" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_sk" text NOT NULL,
	"summary_sk" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"status" text DEFAULT 'vyšetruje_sa' NOT NULL,
	"category" text NOT NULL,
	"institution_investigating" text,
	"verdict_url" text,
	"severity" integer DEFAULT 1 NOT NULL,
	"is_editorial_opinion" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speeches" (
	"id" serial PRIMARY KEY NOT NULL,
	"mp_id" integer NOT NULL,
	"date" text NOT NULL,
	"title_sk" text,
	"text_sk" text NOT NULL,
	"source_url" text NOT NULL,
	"nrsr_speech_id" text,
	"clean_title_sk" text,
	"speech_type" text,
	"summary_sk" text,
	"key_points_sk" text,
	"summary_status" text DEFAULT 'pending' NOT NULL,
	"summary_model" text,
	"summarized_at" text
);
--> statement-breakpoint
CREATE TABLE "user_notification_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"on_new_poll" boolean DEFAULT false NOT NULL,
	"on_score_change" boolean DEFAULT false NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_predictions" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"party_id" text NOT NULL,
	"predicted_pct" double precision,
	"coalition_pick" text,
	"created_at" text NOT NULL,
	"fingerprint" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" text NOT NULL,
	"email_verified_at" text,
	"visitor_id" text
);
--> statement-breakpoint
CREATE TABLE "vote_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"vote_id" integer NOT NULL,
	"mp_id" integer NOT NULL,
	"choice" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nrsr_vote_id" text NOT NULL,
	"date" text NOT NULL,
	"title_sk" text NOT NULL,
	"topic_category" text NOT NULL,
	"result" text NOT NULL,
	"votes_for" integer DEFAULT 0 NOT NULL,
	"votes_against" integer DEFAULT 0 NOT NULL,
	"votes_abstain" integer DEFAULT 0 NOT NULL,
	"votes_absent" integer DEFAULT 0 NOT NULL,
	"source_url" text
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coalition_scenarios" ADD CONSTRAINT "coalition_scenarios_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_linked_politician_id_mps_id_fk" FOREIGN KEY ("linked_politician_id") REFERENCES "public"."mps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crowd_aggregates" ADD CONSTRAINT "crowd_aggregates_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_activity_scrape_state" ADD CONSTRAINT "mp_activity_scrape_state_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_amendments" ADD CONSTRAINT "mp_amendments_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_assistants" ADD CONSTRAINT "mp_assistants_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_foreign_trips" ADD CONSTRAINT "mp_foreign_trips_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_interpellations" ADD CONSTRAINT "mp_interpellations_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_legislation" ADD CONSTRAINT "mp_legislation_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_offices" ADD CONSTRAINT "mp_offices_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_questions" ADD CONSTRAINT "mp_questions_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mps" ADD CONSTRAINT "mps_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_promises" ADD CONSTRAINT "party_promises_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD CONSTRAINT "politician_company_links_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politician_company_links" ADD CONSTRAINT "politician_company_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_results" ADD CONSTRAINT "poll_results_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_results" ADD CONSTRAINT "poll_results_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_results" ADD CONSTRAINT "prediction_results_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_results" ADD CONSTRAINT "prediction_results_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_scores" ADD CONSTRAINT "prediction_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises" ADD CONSTRAINT "promises_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises" ADD CONSTRAINT "promises_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises" ADD CONSTRAINT "promises_evidence_vote_id_votes_id_fk" FOREIGN KEY ("evidence_vote_id") REFERENCES "public"."votes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_analysis_drafts" ADD CONSTRAINT "scandal_analysis_drafts_scandal_id_scandals_id_fk" FOREIGN KEY ("scandal_id") REFERENCES "public"."scandals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_claim_sources" ADD CONSTRAINT "scandal_claim_sources_claim_id_scandal_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."scandal_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_claim_sources" ADD CONSTRAINT "scandal_claim_sources_source_id_scandal_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."scandal_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_claims" ADD CONSTRAINT "scandal_claims_scandal_id_scandals_id_fk" FOREIGN KEY ("scandal_id") REFERENCES "public"."scandals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_claims" ADD CONSTRAINT "scandal_claims_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_events" ADD CONSTRAINT "scandal_events_scandal_id_scandals_id_fk" FOREIGN KEY ("scandal_id") REFERENCES "public"."scandals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_politician_links" ADD CONSTRAINT "scandal_politician_links_scandal_id_scandals_id_fk" FOREIGN KEY ("scandal_id") REFERENCES "public"."scandals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_politician_links" ADD CONSTRAINT "scandal_politician_links_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scandal_sources" ADD CONSTRAINT "scandal_sources_scandal_id_scandals_id_fk" FOREIGN KEY ("scandal_id") REFERENCES "public"."scandals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speeches" ADD CONSTRAINT "speeches_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_predictions" ADD CONSTRAINT "user_predictions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_predictions" ADD CONSTRAINT "user_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_records" ADD CONSTRAINT "vote_records_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_records" ADD CONSTRAINT "vote_records_mp_id_mps_id_fk" FOREIGN KEY ("mp_id") REFERENCES "public"."mps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_unique" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_key_date_unique" ON "api_usage" USING btree ("key_id","date");--> statement-breakpoint
CREATE INDEX "api_usage_key_idx" ON "api_usage" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "candidates_party_id_idx" ON "candidates" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_party_rank_unique" ON "candidates" USING btree ("party_id","list_rank");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_ico_unique" ON "companies" USING btree ("ico");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "contracts_supplier_ico_idx" ON "contracts" USING btree ("supplier_ico");--> statement-breakpoint
CREATE INDEX "contracts_signed_date_idx" ON "contracts" USING btree ("signed_date");--> statement-breakpoint
CREATE INDEX "contracts_linked_politician_id_idx" ON "contracts" USING btree ("linked_politician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crowd_aggregates_party_id_unique" ON "crowd_aggregates" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "donations_party_id_idx" ON "donations" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "donations_donor_ico_idx" ON "donations" USING btree ("donor_ico");--> statement-breakpoint
CREATE INDEX "donations_donation_date_idx" ON "donations" USING btree ("donation_date");--> statement-breakpoint
CREATE INDEX "gdpr_audit_log_action_idx" ON "gdpr_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "gdpr_audit_log_timestamp_idx" ON "gdpr_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "kalkulator_q_a_p_unique" ON "kalkulator_weights" USING btree ("question_id","answer_index","party_id");--> statement-breakpoint
CREATE INDEX "kalkulator_question_idx" ON "kalkulator_weights" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_activity_state_mp_unique" ON "mp_activity_scrape_state" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "mp_activity_state_next_idx" ON "mp_activity_scrape_state" USING btree ("next_eligible_at");--> statement-breakpoint
CREATE INDEX "mp_activity_state_success_idx" ON "mp_activity_scrape_state" USING btree ("last_success_at");--> statement-breakpoint
CREATE INDEX "mp_amend_mp_idx" ON "mp_amendments" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "mp_amend_date_idx" ON "mp_amendments" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_amend_mp_url_unique" ON "mp_amendments" USING btree ("mp_id","url");--> statement-breakpoint
CREATE INDEX "mp_assist_mp_idx" ON "mp_assistants" USING btree ("mp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_assist_mp_name_unique" ON "mp_assistants" USING btree ("mp_id","name");--> statement-breakpoint
CREATE INDEX "mp_trips_mp_idx" ON "mp_foreign_trips" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "mp_trips_date_idx" ON "mp_foreign_trips" USING btree ("date");--> statement-breakpoint
CREATE INDEX "mp_interp_mp_idx" ON "mp_interpellations" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "mp_interp_date_idx" ON "mp_interpellations" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_interp_mp_url_unique" ON "mp_interpellations" USING btree ("mp_id","url");--> statement-breakpoint
CREATE INDEX "mp_legis_mp_idx" ON "mp_legislation" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "mp_legis_date_idx" ON "mp_legislation" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_legis_mp_url_unique" ON "mp_legislation" USING btree ("mp_id","url");--> statement-breakpoint
CREATE INDEX "mp_offices_mp_idx" ON "mp_offices" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "mp_questions_mp_idx" ON "mp_questions" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "mp_questions_date_idx" ON "mp_questions" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_questions_mp_url_unique" ON "mp_questions" USING btree ("mp_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "mps_slug_unique" ON "mps" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "mps_party_id_idx" ON "mps" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "mps_role_idx" ON "mps" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_url_unique" ON "news_items" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscribers_email_unique" ON "newsletter_subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "notif_log_user_idx" ON "notification_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_log_sent_idx" ON "notification_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "party_promises_party_id_idx" ON "party_promises" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "pol_company_links_mp_id_idx" ON "politician_company_links" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "pol_company_links_company_id_idx" ON "politician_company_links" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pol_company_links_unique" ON "politician_company_links" USING btree ("mp_id","company_id","relationship");--> statement-breakpoint
CREATE INDEX "poll_results_poll_id_idx" ON "poll_results" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_results_party_id_idx" ON "poll_results" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "polls_agency_date_unique" ON "polls" USING btree ("agency","published_date");--> statement-breakpoint
CREATE INDEX "pred_results_prediction_id_idx" ON "prediction_results" USING btree ("prediction_id");--> statement-breakpoint
CREATE INDEX "pred_scores_user_idx" ON "prediction_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pred_scores_election_idx" ON "prediction_scores" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX "pred_scores_total_idx" ON "prediction_scores" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "promises_party_id_idx" ON "promises" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "promises_mp_id_idx" ON "promises" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "promises_source_type_idx" ON "promises" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "promises_status_idx" ON "promises" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rate_limits_ip_hash_idx" ON "rate_limits" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "rate_limits_created_at_idx" ON "rate_limits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scandal_analysis_drafts_scandal_id_idx" ON "scandal_analysis_drafts" USING btree ("scandal_id");--> statement-breakpoint
CREATE INDEX "scandal_analysis_drafts_status_idx" ON "scandal_analysis_drafts" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "scandal_claim_sources_claim_id_idx" ON "scandal_claim_sources" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "scandal_claim_sources_source_id_idx" ON "scandal_claim_sources" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scandal_claim_sources_unique" ON "scandal_claim_sources" USING btree ("claim_id","source_id");--> statement-breakpoint
CREATE INDEX "scandal_claims_scandal_id_idx" ON "scandal_claims" USING btree ("scandal_id");--> statement-breakpoint
CREATE INDEX "scandal_claims_mp_id_idx" ON "scandal_claims" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "scandal_claims_process_status_idx" ON "scandal_claims" USING btree ("process_status");--> statement-breakpoint
CREATE INDEX "scandal_events_scandal_id_idx" ON "scandal_events" USING btree ("scandal_id");--> statement-breakpoint
CREATE INDEX "scandal_events_date_idx" ON "scandal_events" USING btree ("event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "scandal_events_unique" ON "scandal_events" USING btree ("scandal_id","event_date","title_sk","source_url");--> statement-breakpoint
CREATE INDEX "scandal_pol_links_scandal_id_idx" ON "scandal_politician_links" USING btree ("scandal_id");--> statement-breakpoint
CREATE INDEX "scandal_pol_links_mp_id_idx" ON "scandal_politician_links" USING btree ("mp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scandal_pol_links_unique" ON "scandal_politician_links" USING btree ("scandal_id","mp_id");--> statement-breakpoint
CREATE INDEX "scandal_sources_scandal_id_idx" ON "scandal_sources" USING btree ("scandal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scandal_sources_unique" ON "scandal_sources" USING btree ("scandal_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "scandals_slug_unique" ON "scandals" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "scandals_status_idx" ON "scandals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scandals_category_idx" ON "scandals" USING btree ("category");--> statement-breakpoint
CREATE INDEX "scandals_severity_idx" ON "scandals" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "scandals_start_date_idx" ON "scandals" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "speeches_mp_id_idx" ON "speeches" USING btree ("mp_id");--> statement-breakpoint
CREATE INDEX "speeches_date_idx" ON "speeches" USING btree ("date");--> statement-breakpoint
CREATE INDEX "speeches_summary_status_idx" ON "speeches" USING btree ("summary_status");--> statement-breakpoint
CREATE UNIQUE INDEX "speeches_nrsr_speech_id_unique" ON "speeches" USING btree ("nrsr_speech_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_predictions_visitor_unique" ON "user_predictions" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "user_predictions_fingerprint_idx" ON "user_predictions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "user_predictions_user_id_idx" ON "user_predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_visitor_id_idx" ON "users" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "vote_records_vote_id_idx" ON "vote_records" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "vote_records_mp_id_idx" ON "vote_records" USING btree ("mp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vote_records_vote_mp_unique" ON "vote_records" USING btree ("vote_id","mp_id");--> statement-breakpoint
CREATE INDEX "votes_date_idx" ON "votes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "votes_topic_category_idx" ON "votes" USING btree ("topic_category");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_nrsr_vote_id_unique" ON "votes" USING btree ("nrsr_vote_id");