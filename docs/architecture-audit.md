# Architecture audit

Labels: SCHEMA (structure exists), WRITTEN (code writes to it), READ (code reads it), UI (a screen renders it), LIVE (production rows exist / observed running).

---

## PASS 1 — Inventory

### A. Tables (schema.table | columns | RLS | live rows)

| Table | Cols | RLS | Rows |
|---|---|---|---|
| public.admin_login_log | 4 | on | 86 |
| public.admin_permissions | 10 | on | 5 |
| public.admin_settings | 4 | on | 5 |
| public.audience_groups | 4 | on | 7 |
| public.audience_members | 6 | on | 130 |
| public.blog_posts | 25 | on | 4 |
| public.campaign_events | 7 | on | 2997 |
| public.campaigns | 24 | on | 14 |
| public.contact_submissions | 16 | on | 67 |
| public.creator_applications | 19 | on | 31 |
| public.email_suppressions | 5 | on | 18 |
| public.heard_volunteers | 19 | on | 0 |
| public.heard_waitlist | 11 | on | 0 |
| public.join_applications | 49 | on | 97 |
| public.matchmaker_applications | 23 | on | 214 |
| public.matchmaker_email_log | 12 | on | 205 |
| public.matchmaker_opportunities | 34 | on | 7 |
| public.matchmaker_opportunity_facets | 7 | on | 38 |
| public.matchmaker_question_templates | 7 | on | 1 |
| public.matchmaker_share_events | 4 | on | 111 |
| public.mu_activity | 7 | on | 1027 |
| public.mu_availability_days | 6 | on | 1 |
| public.mu_availability_recurrence | 7 | on | 0 |
| public.mu_credentials | 17 | on | 736 |
| public.mu_cv_parses | 9 | on | 19 |
| public.mu_document_requests | 13 | on | 3 |
| public.mu_documents | 21 | on | 397 |
| public.mu_engagements | 16 | on | 0 |
| public.mu_facet_keywords | 10 | on | 115 |
| public.mu_field_conflicts | 10 | on | 77 |
| public.mu_leave_requests | 13 | on | 0 |
| public.mu_match_rationales | 8 | on | 5 |
| public.mu_match_weights | 4 | on | 9 |
| public.mu_merge_candidates | 9 | on | 0 |
| public.mu_offer_shifts | 7 | on | 0 |
| public.mu_offers | 20 | on | 0 |
| public.mu_parsed_fields | 14 | on | 2207 |
| public.mu_people | 38 | on | 275 |
| public.mu_profile_facets | 11 | on | 1139 |
| public.mu_required_documents | 8 | on | 4 |
| public.mu_shortlists | 11 | on | 0 |
| public.mu_work_preferences | 21 | on | 1 |
| public.orders | 13 | on | 0 |
| public.otp_codes | 6 | on | 117 |
| public.profiles | 4 | on | 8 |
| public.user_roles | 3 | on | 4 |

49 base tables. No table has RLS off.

### B. Edge functions

| Function | Path | Triggered by |
|---|---|---|
| admin-otp | supabase/functions/admin-otp/index.ts | admin login UI |
| admin-password-reset | supabase/functions/admin-password-reset/index.ts | admin settings UI |
| candidate-account-admin | supabase/functions/candidate-account-admin/index.ts | admin person profile |
| force-signout-admin | supabase/functions/force-signout-admin/index.ts | admin control centre |
| generate-paystack-link | supabase/functions/generate-paystack-link/index.ts | invoice editor |
| invite-admin | supabase/functions/invite-admin/index.ts | admin control centre |
| invite-candidate | supabase/functions/invite-candidate/index.ts | admin person profile |
| match-rationale | supabase/functions/match-rationale/index.ts | [src/pages/admin/MatchmakerMatches.tsx] |
| mcp | supabase/functions/mcp/index.ts | external MCP clients (HTTP) |
| notify-candidate-document | supabase/functions/notify-candidate-document/index.ts | [src/components/admin/DocumentsPanel.tsx], [src/pages/admin/MatchUniverseVerification.tsx] |
| notify-candidate-offer | supabase/functions/notify-candidate-offer/index.ts | [src/components/admin/mu/WorkPanel.tsx] |
| notify-new-post | supabase/functions/notify-new-post/index.ts | post editor |
| parse-cv | supabase/functions/parse-cv/index.ts | [src/pages/admin/MatchUniverseIntake.tsx], [src/pages/admin/MatchUniversePerson.tsx], [src/pages/admin/MatchUniverse.tsx]; also cron header PARSE_CV_CRON_SECRET |
| parse-opportunity | supabase/functions/parse-opportunity/index.ts | [src/pages/admin/MatchmakerMatches.tsx] |
| publish-scheduled-posts | supabase/functions/publish-scheduled-posts/index.ts | scheduled invocation with CRON_SECRET |
| request-candidate-documents | supabase/functions/request-candidate-documents/index.ts | [src/components/admin/DocumentsPanel.tsx] |
| resend-webhook | supabase/functions/resend-webhook/index.ts | Resend webhook |
| send-campaign | supabase/functions/send-campaign/index.ts | campaign editor |
| send-candidate-email | supabase/functions/send-candidate-email/index.ts | admin matchmaker applications |
| send-form-notification | supabase/functions/send-form-notification/index.ts | [src/pages/JoinNetwork.tsx] and other public forms |
| send-heard-signup | supabase/functions/send-heard-signup/index.ts | /heard forms |
| send-invoice-email | supabase/functions/send-invoice-email/index.ts | invoice editor |
| send-whatsapp | supabase/functions/send-whatsapp/index.ts | [src/components/admin/invoice/EditorTab.tsx:142] |
| unsubscribe-email | supabase/functions/unsubscribe-email/index.ts | /unsubscribe route |

### C. Triggers (43)

| Trigger | Table | Event | Function |
|---|---|---|---|
| heard_volunteers_updated_at | heard_volunteers | BEFORE UPDATE | matchmaker_set_updated_at |
| heard_volunteers_updated_at | heard_volunteers | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_link_join_app | join_applications | BEFORE INSERT | mu_link_join_application |
| validate_join_application_trigger | join_applications | BEFORE INSERT OR UPDATE | validate_join_application |
| mu_sync_join_docs | join_applications | AFTER INSERT OR UPDATE OF cv_url, person_id | mu_sync_join_documents |
| mu_link_mm_app | matchmaker_applications | BEFORE INSERT | mu_link_matchmaker_application |
| matchmaker_applications_set_updated_at | matchmaker_applications | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_sync_mm_docs | matchmaker_applications | AFTER INSERT OR UPDATE OF documents, person_id | mu_sync_matchmaker_documents |
| matchmaker_opportunities_set_updated_at | matchmaker_opportunities | BEFORE UPDATE | matchmaker_set_updated_at |
| mmo_facets_updated | matchmaker_opportunity_facets | BEFORE UPDATE | matchmaker_set_updated_at |
| matchmaker_question_templates_updated_at | matchmaker_question_templates | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_availability_days_touch / _del | mu_availability_days | BEFORE INSERT OR UPDATE / AFTER DELETE | mu_touch_availability / mu_touch_availability_del |
| mu_availability_recurrence_touch / _del | mu_availability_recurrence | BEFORE INSERT OR UPDATE / AFTER DELETE | mu_touch_availability / mu_touch_availability_del |
| mu_credentials_guard | mu_credentials | BEFORE INSERT OR UPDATE | mu_credentials_guard |
| mu_credentials_updated_at | mu_credentials | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_credentials_audit | mu_credentials | AFTER INSERT OR UPDATE | mu_credentials_audit |
| mu_credentials_rederive_gaps | mu_credentials | AFTER INSERT OR UPDATE OR DELETE | mu_rederive_gaps_for_person |
| mu_document_requests_touch | mu_document_requests | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_documents_touch_person | mu_documents | AFTER INSERT OR UPDATE OR DELETE | mu_documents_touch_person |
| mu_documents_queue_cv_parse | mu_documents | AFTER INSERT | mu_queue_cv_parse |
| mu_documents_close_requests | mu_documents | AFTER INSERT | mu_close_document_requests |
| mu_documents_updated_at | mu_documents | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_documents_sync | mu_documents | BEFORE INSERT OR UPDATE | mu_documents_sync |
| mu_engagements_touch | mu_engagements | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_facet_keywords_updated_at | mu_facet_keywords | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_field_conflicts_updated_at | mu_field_conflicts | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_leave_touch | mu_leave_requests | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_match_rationales_updated | mu_match_rationales | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_offers_touch | mu_offers | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_parsed_fields_rederive_gaps | mu_parsed_fields | AFTER INSERT OR UPDATE OR DELETE | mu_rederive_gaps_for_person |
| mu_parsed_fields_updated_at | mu_parsed_fields | BEFORE UPDATE | matchmaker_set_updated_at |
| zz_mu_people_derive_gaps | mu_people | BEFORE INSERT OR UPDATE | mu_people_derive_gaps |
| mu_people_updated_at | mu_people | BEFORE UPDATE | matchmaker_set_updated_at |
| zzz_mu_people_derive_verification | mu_people | BEFORE INSERT OR UPDATE | mu_people_derive_verification |
| mu_people_guard_admin_columns | mu_people | BEFORE UPDATE | mu_people_guard_admin_columns |
| mu_profile_facets_updated | mu_profile_facets | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_required_documents_updated_at | mu_required_documents | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_shortlists_updated | mu_shortlists | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_work_preferences_touch | mu_work_preferences | BEFORE UPDATE | matchmaker_set_updated_at |
| mu_work_preferences_audit_trg | mu_work_preferences | AFTER INSERT OR UPDATE | mu_work_preferences_audit |

### D. Routes [src/App.tsx]

Public: `/`, `/clinical-home-care`, `/post-surgical-care`, `/care-from-abroad`, `/agency-vs-private-nurse-lagos`, `/home-care-{ikoyi,lekki,victoria-island,ikeja,ajah,surulere,yaba}`, `/antenatal-care`, `/postnatal-care`, `/nanny-childcare`, `/eldercare`, `/pediatric-care`, `/hospital-staffing`, `/hospital-support`, `/clinical-research`, `/about`, `/contact`, `/join`, `/privacy`, `/terms`, `/creator`, `/blog`, `/blog/:slug`, `/hm`, `/hm/:slug`, `/hm/:slug/apply`, `/heard`, `/heard/thanks`, `/unsubscribe`, `*`.

Candidate: `/portal` [src/pages/portal/PortalAccount.tsx], `/portal/login`, `/portal/set-password`.

Admin (all inside `ProtectedRoute` + `AdminLayout`): `/admin`, `invoices`, `posts`, `posts/:id`, `campaigns`, `campaigns/:id`, `audience`, `enquiries`, `applications`, `archives`, `email-templates`, `creator-applications`, `settings`, `control-centre`, `approvals`, `match-universe`, `match-universe/opportunities`, `match-universe/opportunities/templates`, `match-universe/opportunities/:id/*`, `match-universe/merges`, `match-universe/verification`, `match-universe/intake`, `match-universe/availability`, `match-universe/workforce`, `match-universe/:id`, `heard`.

Auth: `/auth`, `/set-password`, `/.lovable/oauth/consent`.

---

## PASS 3 — Intake trace: Join application to mu_documents

| # | What runs | File / function | Table written | Values set |
|---|---|---|---|---|
| 1 | File chosen and size/type checked | [src/components/join/DocumentsStep.tsx:20-26] | none | browser only, no server code |
| 2 | File uploaded | [src/components/join/DocumentsStep.tsx:28-30] | storage.objects (`applications` bucket) | path `{timestamp}-{filename}`; public URL returned |
| 3 | Form insert | [src/pages/JoinNetwork.tsx:159-200] | join_applications | all form fields incl. `cv_url`, `state`, `lga_primary`, `lgas_willing_to_commute`, UTM columns, `status='new'`, `archived=false` |
| 4 | Field validation | trigger validate_join_application_trigger -> validate_join_application | join_applications (NEW) | rejects invalid rows |
| 5 | Identity resolution | trigger mu_link_join_app -> mu_link_join_application -> mu_resolve_person | mu_people | matches on `email_key`/`phone_key`; inserts or updates `full_name`, `email`, `phone`, `state`, `lga`, licensing fields, `languages`, `availability`, `right_to_work`, `nysc_status`; sets NEW.person_id |
| 6 | Gap + verification derivation | triggers zz_mu_people_derive_gaps, zzz_mu_people_derive_verification | mu_people | `candidate_gaps`, `verification_state`, `licence_status`, `right_to_work_status` |
| 7 | Document sync | trigger mu_sync_join_docs -> mu_sync_join_documents | mu_documents | `person_id`, `source_table='join_applications'`, `source_id`, `label='CV'`, `url=cv_url`, `verified=false`, `review_outcome='pending'` |
| 8 | Auto-typing | trigger mu_documents_sync -> mu_documents_sync / mu_doc_type | mu_documents (NEW) | `doc_type` from label/URL pattern match |
| 9 | Request closure | trigger mu_documents_close_requests | mu_document_requests | matching open request set `status='fulfilled'`, `fulfilled_document_id`, `fulfilled_at` |
| 10 | Parse queue | trigger mu_documents_queue_cv_parse -> mu_queue_cv_parse | mu_people | `parse_status='not_parsed'` when doc_type is a CV |
| 11 | Person touch | trigger mu_documents_touch_person | mu_people | `last_activity_at=now()`, gap rederivation |
| 12 | Admin email | [src/pages/JoinNetwork.tsx:209] invoke `send-form-notification` | none | browser-initiated edge call |

CV parsing itself is not invoked at intake. `parse-cv` runs only from admin UI or the cron entry point [supabase/functions/parse-cv/index.ts:439].

---

## PASS 4 — Stage per feature

| Feature | Labels | Missing to reach LIVE | Evidence |
|---|---|---|---|
| Portal needs-you tab | SCHEMA WRITTEN READ UI LIVE | none | [src/pages/portal/PortalAccount.tsx:39,384] reads mu_people.candidate_gaps, mu_parsed_fields, mu_documents; mu_parsed_fields 2207 rows, 3 `candidate_updated` |
| Offers | SCHEMA WRITTEN READ UI | zero rows: no offer ever sent; mu_offers 0, mu_offer_shifts 0 | [src/components/admin/mu/WorkPanel.tsx] rpc mu_send_offer/mu_withdraw_offer + invoke notify-candidate-offer; [src/components/portal/OffersPanel.tsx] rpc mu_my_offers/mu_respond_offer |
| Document requests | SCHEMA WRITTEN READ UI LIVE | none; 3 rows (2 fulfilled, 1 open) | [src/components/admin/DocumentsPanel.tsx] rpc mu_request_documents, invoke request-candidate-documents |
| Availability calendar | SCHEMA WRITTEN READ UI | adoption only: mu_availability_days has 1 row across 275 people | [src/components/portal/AvailabilityCalendar.tsx] writes mu_availability_days, reads mu_system_blocks |
| Recurring availability | SCHEMA WRITTEN READ UI | zero rows in mu_availability_recurrence | [src/components/portal/AvailabilityCalendar.tsx] mu_availability_recurrence |
| Verification queue | SCHEMA WRITTEN READ UI LIVE | none, but 394 of 397 documents still `pending` | [src/pages/admin/MatchUniverseVerification.tsx] rpc mu_review_queue / mu_review_document |
| Merges | SCHEMA WRITTEN READ UI | mu_merge_candidates has 0 rows; scan is manual from Intake | [src/pages/admin/MatchUniverseMerges.tsx], rpc mu_scan_name_duplicates [src/pages/admin/MatchUniverseIntake.tsx] |
| Intake health | SCHEMA READ UI LIVE | none | [src/pages/admin/MatchUniverseIntake.tsx] rpc mu_intake_health, mu_parse_backlog, mu_expire_documents |
| Availability board | SCHEMA READ UI LIVE | reads run, but results are empty because the underlying calendars are unfilled (1 day row) | [src/pages/admin/MatchUniverseAvailability.tsx] rpc mu_available_people, mu_availability_freshness |
| Workforce | SCHEMA READ UI | depends on engagements; mu_workforce_list returns nothing (0 engagements) | [src/pages/admin/MatchUniverseWorkforce.tsx] rpc mu_workforce_list, mu_end_engagement, mu_decide_leave |
| Engagements | SCHEMA WRITTEN READ UI | zero rows; only created by accepting an offer, and no offer exists | mu_engagements 0 rows; rpc mu_respond_offer, mu_end_engagement |
| Leave requests | SCHEMA WRITTEN READ UI | zero rows; requires an engagement first | [src/components/portal/LeavePanel.tsx] rpc mu_request_leave / mu_decide_leave; mu_leave_requests 0 rows |
| Shortlist | SCHEMA WRITTEN READ UI | mu_shortlists 0 rows; no candidate has been shortlisted | [src/pages/admin/MatchmakerMatches.tsx] writes mu_shortlists, rpc mu_shortlist_set_stage |
| Opportunities | SCHEMA WRITTEN READ UI LIVE | none; 7 opportunities, 38 facets, 214 applications | [src/pages/admin/MatchUniverseOpportunities.tsx], [src/pages/admin/MatchmakerMatches.tsx] |
| MCP tools | SCHEMA READ UI LIVE | none for the read tools; write tools (create_opportunity, shortlist_candidate, set_opportunity_criteria) have no rows attributable to them | [supabase/functions/mcp/index.ts:95-1081] 19 tools |

No handler in this set calls nothing; there is no UI NOT WIRED case among the listed features.

---

## PASS 5 — Incomplete work

### A. TODO / FIXME / commented-out blocks

| Item | Path |
|---|---|
| No TODO, FIXME, XXX or HACK markers anywhere in `src/` or `supabase/` | NOT FOUND |
| Commented-out executable blocks | NOT FOUND (only explanatory comments at [src/pages/portal/PortalAccount.tsx:287] and [src/components/portal/OffersPanel.tsx:4]) |

### B. Mock / hardcoded / placeholder data

| Item | Path |
|---|---|
| Invoice preview footer prints `info@medicconnect.ng`, `+234 XXX XXX XXXX`, `RC: XXXXXXX` | [src/components/admin/invoice/PreviewTab.tsx:155-156] |
| Placeholder/sample strings inside email preview scaffolding | [supabase/functions/_shared/branded-email.ts], [supabase/functions/send-campaign/index.ts] |

### C. RLS off / public read policies

| Item | Detail |
|---|---|
| Tables with RLS off | NONE (49/49 on) |
| blog_posts | `Anon can read published posts (safe columns)` SELECT to `anon` where `status='published' AND published_at <= now()` |
| matchmaker_opportunities | `Public can view open or closed opportunities` SELECT to `public` where `status IN ('open','closed')` |
| admin_permissions | SELECT to `public` where `user_id = auth.uid()` (self only) |
| mu_cv_parses | ALL to `public` gated by `private.has_role(auth.uid(),'admin')` |
| contact_submissions, creator_applications, join_applications, otp_codes | SELECT to `public` with `USING false` (deny) |

### D. Failed or stuck rows

| Queue | State |
|---|---|
| mu_people.parse_status | 7 `failed`, 18 `not_parsed`, 1 `empty`, 249 `parsed` |
| mu_documents.review_outcome | 394 `pending`, 2 `accepted`, 1 `rejected` |
| mu_parsed_fields.status | 2204 `pending`, 3 `candidate_updated` |
| mu_field_conflicts | 77 rows unresolved |
| mu_document_requests | 1 `open`, 2 `fulfilled` |
| campaigns | 5 `draft`, 9 `sent` |
| matchmaker_email_log | 205 `sent`, 0 failures |
| mu_offers / mu_leave_requests / mu_merge_candidates | 0 rows |

### E. Environment variables referenced but not set

| Variable | Referenced in | Status |
|---|---|---|
| CRON_SECRET | [supabase/functions/publish-scheduled-posts/index.ts:17] | NOT SET |
| WHATSAPP_ACCESS_TOKEN | [supabase/functions/send-whatsapp/index.ts] | NOT SET |
| WHATSAPP_PHONE_NUMBER_ID | [supabase/functions/send-whatsapp/index.ts] | NOT SET |
| ANTHROPIC_API_KEY, LOVABLE_API_KEY, MONDAY_API_KEY, NOTIFICATION_EMAIL, PARSE_CV_CRON_SECRET, PAYSTACK_SECRET_KEY, RESEND_API_KEY, RESEND_WEBHOOK_SECRET | edge functions | SET |
| SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | edge functions | platform-injected |
| VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID | [src/integrations/supabase/client.ts] | SET in .env |
