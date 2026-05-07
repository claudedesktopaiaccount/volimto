import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ─── Rate Limits ────────────────────────────────────────

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ipHash: text("ip_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("rate_limits_ip_hash_idx").on(table.ipHash),
    index("rate_limits_created_at_idx").on(table.createdAt),
  ]
);

// ─── Parties ─────────────────────────────────────────────

export const parties = sqliteTable("parties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  color: text("color").notNull(),
  secondaryColor: text("secondary_color"),
  leader: text("leader").notNull(),
  ideology: text("ideology"),
  seats: integer("seats").default(0),
  logoUrl: text("logo_url"),
  portraitUrl: text("portrait_url"),
});

// ─── Polls ───────────────────────────────────────────────

export const polls = sqliteTable(
  "polls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    agency: text("agency").notNull(),
    publishedDate: text("published_date").notNull(),
    fieldworkStart: text("fieldwork_start"),
    fieldworkEnd: text("fieldwork_end"),
    sampleSize: integer("sample_size"),
    sourceUrl: text("source_url"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("polls_agency_date_unique").on(table.agency, table.publishedDate),
  ]
);

export const pollResults = sqliteTable(
  "poll_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pollId: integer("poll_id")
      .notNull()
      .references(() => polls.id),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id),
    percentage: real("percentage").notNull(),
  },
  (table) => [
    index("poll_results_poll_id_idx").on(table.pollId),
    index("poll_results_party_id_idx").on(table.partyId),
  ]
);

// ─── Predictions ─────────────────────────────────────────

export const predictions = sqliteTable("predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generatedAt: text("generated_at").notNull(),
  modelVersion: text("model_version").notNull(),
});

export const predictionResults = sqliteTable(
  "prediction_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id),
    predictedPct: real("predicted_pct").notNull(),
    lowerBound: real("lower_bound").notNull(),
    upperBound: real("upper_bound").notNull(),
    winProbability: real("win_probability").notNull(),
    parliamentProbability: real("parliament_probability").notNull(),
  },
  (table) => [
    index("pred_results_prediction_id_idx").on(table.predictionId),
  ]
);

// ─── News ────────────────────────────────────────────────

export const newsItems = sqliteTable(
  "news_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    source: text("source").notNull(),
    publishedAt: text("published_at"),
    scrapedAt: text("scraped_at").notNull(),
    category: text("category"),
  },
  (table) => [uniqueIndex("news_items_url_unique").on(table.url)]
);

// ─── Party Promises ──────────────────────────────────────

export const partyPromises = sqliteTable(
  "party_promises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id),
    promiseText: text("promise_text").notNull(),
    category: text("category").notNull(),
    isPro: integer("is_pro", { mode: "boolean" }).notNull(),
    sourceUrl: text("source_url"),
    status: text("status").notNull().default("not_started"),
    // status values: 'fulfilled' | 'in_progress' | 'broken' | 'not_started'
  },
  (table) => [index("party_promises_party_id_idx").on(table.partyId)]
);

// ─── Coalition Scenarios ─────────────────────────────────

export const coalitionScenarios = sqliteTable("coalition_scenarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  partyIds: text("party_ids").notNull(), // JSON array
  combinedProbability: real("combined_probability"),
  predictedSeats: integer("predicted_seats"),
  predictionId: integer("prediction_id").references(() => predictions.id),
});

// ─── Crowd Predictions (Tipovanie) ───────────────────────

export const userPredictions = sqliteTable(
  "user_predictions",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id").notNull(),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id),
    predictedPct: real("predicted_pct"),
    coalitionPick: text("coalition_pick"), // JSON array
    createdAt: text("created_at").notNull(),
    fingerprint: text("fingerprint"),
    userId: text("user_id").references(() => users.id),
  },
  (table) => [
    uniqueIndex("user_predictions_visitor_unique").on(table.visitorId),
    index("user_predictions_fingerprint_idx").on(table.fingerprint),
    index("user_predictions_user_id_idx").on(table.userId),
  ]
);

export const crowdAggregates = sqliteTable(
  "crowd_aggregates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id),
    totalBets: integer("total_bets").notNull().default(0),
    avgPredictedPct: real("avg_predicted_pct"),
    computedAt: text("computed_at").notNull(),
  },
  (table) => [
    uniqueIndex("crowd_aggregates_party_id_unique").on(table.partyId),
  ]
);

// ─── GDPR Audit Log ────────────────────────────────────

export const gdprAuditLog = sqliteTable(
  "gdpr_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    action: text("action").notNull(), // 'delete' | 'export'
    visitorIdHash: text("visitor_id_hash").notNull(),
    timestamp: text("timestamp").notNull(),
    recordsAffected: integer("records_affected").notNull().default(0),
  },
  (table) => [
    index("gdpr_audit_log_action_idx").on(table.action),
    index("gdpr_audit_log_timestamp_idx").on(table.timestamp),
  ]
);

// ─── Newsletter Subscribers ───────────────────────────────

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    createdAt: text("created_at").notNull(),
    confirmedAt: text("confirmed_at"),
    unsubscribedAt: text("unsubscribed_at"),
    source: text("source").default("web"), // 'web' | 'homepage' | 'footer'
  },
  (table) => [
    uniqueIndex("newsletter_subscribers_email_unique").on(table.email),
  ]
);

// ─── Users ──────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  emailVerifiedAt: text("email_verified_at"),
  visitorId: text("visitor_id"), // link to legacy cookie-based identity
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  index("users_visitor_id_idx").on(table.visitorId),
]);

// ─── User Sessions ──────────────────────────────────────

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(), // SHA-256 hash of session token
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("user_sessions_user_idx").on(table.userId),
  index("user_sessions_expires_idx").on(table.expiresAt),
]);

// ─── Prediction Scores ─────────────────────────────────

export const predictionScores = sqliteTable("prediction_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id),
  visitorId: text("visitor_id"),
  electionId: text("election_id").notNull(), // e.g., "sr-2027"
  winnerScore: real("winner_score"),
  percentageScore: real("percentage_score"),
  coalitionScore: real("coalition_score"),
  totalScore: real("total_score").notNull().default(0),
  scoredAt: text("scored_at").notNull(),
}, (table) => [
  index("pred_scores_user_idx").on(table.userId),
  index("pred_scores_election_idx").on(table.electionId),
  index("pred_scores_total_idx").on(table.totalScore),
]);

// ─── Kalkulator Weights ──────────────────────────────────
// Stores per-answer party weights for volebný kalkulátor.
// questionId: 1-20, answerIndex: 0-2, partyId: e.g. "ps"

export const kalkulatorWeights = sqliteTable(
  "kalkulator_weights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: integer("question_id").notNull(),
    answerIndex: integer("answer_index").notNull(),
    partyId: text("party_id").notNull(),
    weight: real("weight").notNull().default(0),
    sourceUrl: text("source_url"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("kalkulator_q_a_p_unique").on(table.questionId, table.answerIndex, table.partyId),
    index("kalkulator_question_idx").on(table.questionId),
  ]
);

// ─── User Notification Prefs ─────────────────────────────

export const userNotificationPrefs = sqliteTable("user_notification_prefs", {
  userId: text("user_id").primaryKey().references(() => users.id),
  onNewPoll: integer("on_new_poll").notNull().default(0), // 0 | 1
  onScoreChange: integer("on_score_change").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

// ─── Notification Log ─────────────────────────────────────
// Tracks sent notifications for rate-limiting (max 1/user/day).

export const notificationLog = sqliteTable(
  "notification_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().references(() => users.id),
    type: text("type").notNull(), // 'new_poll' | 'score_change' | 'digest'
    sentAt: text("sent_at").notNull(),
  },
  (table) => [
    index("notif_log_user_idx").on(table.userId),
    index("notif_log_sent_idx").on(table.sentAt),
  ]
);

// ─── API Keys ─────────────────────────────────────────────

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id").references(() => users.id),
    keyHash: text("key_hash").notNull(), // SHA-256 hex of raw key
    tier: text("tier").notNull().default("free"), // 'free' | 'paid'
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("api_keys_hash_unique").on(table.keyHash),
    index("api_keys_user_idx").on(table.userId),
  ]
);

// ─── API Usage ────────────────────────────────────────────
// Tracks daily request count per key for free-tier rate limiting.

export const apiUsage = sqliteTable(
  "api_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    keyId: text("key_id").notNull().references(() => apiKeys.id),
    date: text("date").notNull(), // YYYY-MM-DD UTC
    count: integer("count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("api_usage_key_date_unique").on(table.keyId, table.date),
    index("api_usage_key_idx").on(table.keyId),
  ]
);

// ─── Prediction Narrative ─────────────────────────────────
// Single-row cache for Claude-generated Slovak narrative.
// id is always 'current'; upserted on hash change.

export const predictionNarrative = sqliteTable("prediction_narrative", {
  id: text("id").primaryKey(), // always 'current'
  inputHash: text("input_hash").notNull(),
  narrative: text("narrative").notNull(),
  generatedAt: integer("generated_at").notNull(), // unix ms
});

// ─── Candidates (parliamentary candidate lists) ───────────

export const candidates = sqliteTable(
  "candidates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partyId: text("party_id")
      .notNull()
      .references(() => parties.id),
    name: text("name").notNull(),
    listRank: integer("list_rank").notNull(),
    role: text("role"),              // e.g. "Predseda vlády", "Minister vnútra"
    portraitUrl: text("portrait_url"), // e.g. "/portraits/smer-fico.jpg"
  },
  (table) => [
    index("candidates_party_id_idx").on(table.partyId),
    uniqueIndex("candidates_party_rank_unique").on(table.partyId, table.listRank),
  ]
);

// ─── Phase 0: Political Intelligence Tables ───────────────

// ─── MPs — Members of Parliament / politicians ────────────

export const mps = sqliteTable(
  "mps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),          // e.g. "robert-fico"
    nameFull: text("name_full").notNull(), // "Robert Fico"
    nameDisplay: text("name_display").notNull(), // display name (short)
    partyId: text("party_id").references(() => parties.id), // nullable — can be independent
    // role values: 'poslanec' | 'minister' | 'predseda_vlady' | 'prezident' | 'senator' | 'iny'
    role: text("role").notNull(),
    constituency: text("constituency"),
    birthYear: integer("birth_year"),
    photoUrl: text("photo_url"),
    activeFrom: text("active_from"),       // ISO date
    activeTo: text("active_to"),           // ISO date, null = currently active
    nrsrPersonId: text("nrsr_person_id"),  // NRSR internal ID for scraping
  },
  (table) => [
    uniqueIndex("mps_slug_unique").on(table.slug),
    index("mps_party_id_idx").on(table.partyId),
    index("mps_role_idx").on(table.role),
  ]
);

// ─── Votes — Parliamentary vote sessions ──────────────────

export const votes = sqliteTable(
  "votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nrsrVoteId: text("nrsr_vote_id").notNull(), // NRSR internal vote ID
    date: text("date").notNull(),               // ISO date
    titleSk: text("title_sk").notNull(),
    // topicCategory values: 'rozpočet' | 'zákon' | 'personálne' | 'procedurálne' | 'zahranično-politické' | 'iné'
    topicCategory: text("topic_category").notNull(),
    // result values: 'schválené' | 'zamietnuté' | 'odročené'
    result: text("result").notNull(),
    votesFor: integer("votes_for").notNull().default(0),
    votesAgainst: integer("votes_against").notNull().default(0),
    votesAbstain: integer("votes_abstain").notNull().default(0),
    votesAbsent: integer("votes_absent").notNull().default(0),
    sourceUrl: text("source_url"),
  },
  (table) => [
    index("votes_date_idx").on(table.date),
    index("votes_topic_category_idx").on(table.topicCategory),
    uniqueIndex("votes_nrsr_vote_id_unique").on(table.nrsrVoteId),
  ]
);

// ─── Vote Records — How each MP voted in each vote ────────

export const voteRecords = sqliteTable(
  "vote_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    voteId: integer("vote_id").notNull().references(() => votes.id),
    mpId: integer("mp_id").notNull().references(() => mps.id),
    // choice values: 'za' | 'proti' | 'zdržal_sa' | 'neprítomný' | 'nehlasoval'
    choice: text("choice").notNull(),
  },
  (table) => [
    index("vote_records_vote_id_idx").on(table.voteId),
    index("vote_records_mp_id_idx").on(table.mpId),
    uniqueIndex("vote_records_vote_mp_unique").on(table.voteId, table.mpId),
  ]
);

// ─── Speeches — Parliamentary speeches ───────────────────

export const speeches = sqliteTable(
  "speeches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id),
    date: text("date").notNull(),           // ISO date
    titleSk: text("title_sk"),
    textSk: text("text_sk").notNull(),
    sourceUrl: text("source_url").notNull(),
    nrsrSpeechId: text("nrsr_speech_id"),
  },
  (table) => [
    index("speeches_mp_id_idx").on(table.mpId),
    index("speeches_date_idx").on(table.date),
    uniqueIndex("speeches_nrsr_speech_id_unique").on(table.nrsrSpeechId),
  ]
);

// ─── Promises — Extracted political promises (AI-assisted) ─

export const promises = sqliteTable(
  "promises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // sourceType values: 'program' | 'prejav' | 'rozhovor' | 'socialne_siete'
    sourceType: text("source_type").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceDate: text("source_date").notNull(), // ISO date
    partyId: text("party_id").references(() => parties.id),
    mpId: integer("mp_id").references(() => mps.id),
    textSk: text("text_sk").notNull(),
    // status values: 'nesplnený' | 'čiastočne' | 'splnený' | 'v_procese' | 'nezhodnotiteľný'
    status: text("status").notNull().default("nesplnený"),
    evidenceVoteId: integer("evidence_vote_id").references(() => votes.id),
    evidenceUrl: text("evidence_url"),
    aiConfidence: real("ai_confidence"), // 0.0–1.0
  },
  (table) => [
    index("promises_party_id_idx").on(table.partyId),
    index("promises_mp_id_idx").on(table.mpId),
    index("promises_source_type_idx").on(table.sourceType),
    index("promises_status_idx").on(table.status),
  ]
);

// ─── Scandals — Documented scandals (per politician career) ─

export const scandals = sqliteTable(
  "scandals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    titleSk: text("title_sk").notNull(),
    summarySk: text("summary_sk").notNull(), // 150-300 words, neutral language
    startDate: text("start_date").notNull(), // ISO date
    endDate: text("end_date"),               // ISO date, null = ongoing
    // status values: 'prebieha' | 'uzavretá_bez_výsledku' | 'odsúdený' | 'oslobodený' | 'disciplinárne_potrestaný' | 'vyšetruje_sa' | 'zastavené'
    status: text("status").notNull().default("vyšetruje_sa"),
    // category values: 'korupcia' | 'klientelizmus' | 'plagiátorstvo' | 'zneužitie_moci' | 'konflikt_záujmov' | 'hanlivý_výrok' | 'nepotizmus' | 'podvod' | 'porušenie_ústavy' | 'iné'
    category: text("category").notNull(),
    // institutionInvestigating values: 'NAKA' | 'ÚVO' | 'NKÚ' | 'OLAF' | 'súd' | 'iné' | 'žiadne'
    institutionInvestigating: text("institution_investigating"),
    verdictUrl: text("verdict_url"),
    // severity: 1=kontroverzný výrok, 2=trestné oznámenie, 3=právoplatný rozsudok
    severity: integer("severity").notNull().default(1),
    isEditorialOpinion: integer("is_editorial_opinion", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("scandals_slug_unique").on(table.slug),
    index("scandals_status_idx").on(table.status),
    index("scandals_category_idx").on(table.category),
    index("scandals_severity_idx").on(table.severity),
    index("scandals_start_date_idx").on(table.startDate),
  ]
);

// ─── Scandal Politician Links — Many-to-many: scandal ↔ MP ──

export const scandalPoliticianLinks = sqliteTable(
  "scandal_politician_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scandalId: integer("scandal_id").notNull().references(() => scandals.id),
    mpId: integer("mp_id").notNull().references(() => mps.id),
    // roleInScandal values: 'hlavný_aktér' | 'spoluobvinený' | 'svedok' | 'podpisovateľ'
    roleInScandal: text("role_in_scandal").notNull(),
  },
  (table) => [
    index("scandal_pol_links_scandal_id_idx").on(table.scandalId),
    index("scandal_pol_links_mp_id_idx").on(table.mpId),
    uniqueIndex("scandal_pol_links_unique").on(table.scandalId, table.mpId),
  ]
);

// ─── Scandal Sources — Min 2 sources required per scandal ───

export const scandalSources = sqliteTable(
  "scandal_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scandalId: integer("scandal_id").notNull().references(() => scandals.id),
    url: text("url").notNull(),
    outletName: text("outlet_name").notNull(),
    publishedDate: text("published_date"), // ISO date
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    archiveUrl: text("archive_url"),       // wayback machine
  },
  (table) => [
    index("scandal_sources_scandal_id_idx").on(table.scandalId),
  ]
);

// ─── Companies — Companies from RPVS, FinStat ────────────

export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ico: text("ico").notNull(),            // Slovak company registration number
    name: text("name").notNull(),
    legalForm: text("legal_form"),         // 's.r.o.' | 'a.s.' | etc.
    rpvsUboUrl: text("rpvs_ubo_url"),      // RPVS beneficial owner URL
    finstatUrl: text("finstat_url"),
    foundedDate: text("founded_date"),     // ISO date
    sector: text("sector"),
    addressSk: text("address_sk"),
  },
  (table) => [
    uniqueIndex("companies_ico_unique").on(table.ico),
    index("companies_name_idx").on(table.name),
  ]
);

// ─── Politician Company Links — MP ↔ Company relationships ──

export const politicianCompanyLinks = sqliteTable(
  "politician_company_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id),
    companyId: integer("company_id").notNull().references(() => companies.id),
    // relationship values: 'štatutár' | 'spoločník' | 'prokurista' | 'beneficiár' | 'akcionár'
    relationship: text("relationship").notNull(),
    startDate: text("start_date"),         // ISO date
    endDate: text("end_date"),             // ISO date, null = current
    sourceUrl: text("source_url").notNull(),
  },
  (table) => [
    index("pol_company_links_mp_id_idx").on(table.mpId),
    index("pol_company_links_company_id_idx").on(table.companyId),
    uniqueIndex("pol_company_links_unique").on(table.mpId, table.companyId, table.relationship),
  ]
);

// ─── Donations — Party donations (from RPPOZ register) ───

export const donations = sqliteTable(
  "donations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partyId: text("party_id").notNull().references(() => parties.id),
    donorName: text("donor_name").notNull(),
    donorIco: text("donor_ico"),
    amountEur: real("amount_eur").notNull(),
    donationDate: text("donation_date").notNull(), // ISO date
    sourceUrl: text("source_url").notNull(),
  },
  (table) => [
    index("donations_party_id_idx").on(table.partyId),
    index("donations_donor_ico_idx").on(table.donorIco),
    index("donations_donation_date_idx").on(table.donationDate),
  ]
);

// ─── MP Activities (NRSR per-poslanec scraping) ───────────

export const mpInterpellations = sqliteTable(
  "mp_interpellations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id, { onDelete: "cascade" }),
    date: text("date").notNull(),         // ISO date
    addressee: text("addressee"),         // adresát interpelácie
    subject: text("subject").notNull(),   // predmet
    url: text("url").notNull(),
    answerUrl: text("answer_url"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mp_interp_mp_idx").on(table.mpId),
    index("mp_interp_date_idx").on(table.date),
    uniqueIndex("mp_interp_mp_url_unique").on(table.mpId, table.url),
  ]
);

export const mpQuestions = sqliteTable(
  "mp_questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    subject: text("subject").notNull(),
    url: text("url").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mp_questions_mp_idx").on(table.mpId),
    index("mp_questions_date_idx").on(table.date),
    uniqueIndex("mp_questions_mp_url_unique").on(table.mpId, table.url),
  ]
);

export const mpLegislation = sqliteTable(
  "mp_legislation",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id, { onDelete: "cascade" }),
    cisloTlace: text("cislo_tlace"),       // číslo parlamentnej tlače
    title: text("title").notNull(),
    date: text("date").notNull(),
    status: text("status"),                // stav legislatívneho procesu
    url: text("url").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mp_legis_mp_idx").on(table.mpId),
    index("mp_legis_date_idx").on(table.date),
    uniqueIndex("mp_legis_mp_url_unique").on(table.mpId, table.url),
  ]
);

export const mpAmendments = sqliteTable(
  "mp_amendments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id, { onDelete: "cascade" }),
    toLaw: text("to_law").notNull(),       // k akému zákonu/tlači
    date: text("date").notNull(),
    url: text("url").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mp_amend_mp_idx").on(table.mpId),
    index("mp_amend_date_idx").on(table.date),
    uniqueIndex("mp_amend_mp_url_unique").on(table.mpId, table.url),
  ]
);

export const mpForeignTrips = sqliteTable(
  "mp_foreign_trips",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    country: text("country").notNull(),
    purpose: text("purpose"),
    costEur: real("cost_eur"),
    sourceUrl: text("source_url"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mp_trips_mp_idx").on(table.mpId),
    index("mp_trips_date_idx").on(table.date),
  ]
);

export const mpAssistants = sqliteTable(
  "mp_assistants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type"),                    // 'asistent' | 'odborný' | iné
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mp_assist_mp_idx").on(table.mpId),
    uniqueIndex("mp_assist_mp_name_unique").on(table.mpId, table.name),
  ]
);

export const mpOffices = sqliteTable(
  "mp_offices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mpId: integer("mp_id").notNull().references(() => mps.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    city: text("city"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mp_offices_mp_idx").on(table.mpId),
  ]
);

// ─── Contracts — Public procurement contracts (UVO/EKS/CRZ) ─

export const contracts = sqliteTable(
  "contracts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contractNumber: text("contract_number"), // nullable; uniqueness enforced in app logic when non-null
    titleSk: text("title_sk").notNull(),
    contractingAuthority: text("contracting_authority").notNull(),
    supplierIco: text("supplier_ico").notNull(),
    supplierName: text("supplier_name").notNull(),
    amountEur: real("amount_eur").notNull(),
    signedDate: text("signed_date").notNull(),  // ISO date
    cpvCode: text("cpv_code"),
    sourceUrl: text("source_url").notNull(),
    linkedPoliticianId: integer("linked_politician_id").references(() => mps.id),
  },
  (table) => [
    index("contracts_supplier_ico_idx").on(table.supplierIco),
    index("contracts_signed_date_idx").on(table.signedDate),
    index("contracts_linked_politician_id_idx").on(table.linkedPoliticianId),
  ]
);
