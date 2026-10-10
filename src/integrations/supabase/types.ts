export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_access_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          note: string | null
          permissions_after: Json
          permissions_before: Json
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          permissions_after?: Json
          permissions_before?: Json
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          permissions_after?: Json
          permissions_before?: Json
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_alerts: {
        Row: {
          created_at: string
          detail: Json
          emailed_at: string | null
          id: string
          kind: string
          resolved_at: string | null
          title: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          emailed_at?: string | null
          id?: string
          kind: string
          resolved_at?: string | null
          title: string
        }
        Update: {
          created_at?: string
          detail?: Json
          emailed_at?: string | null
          id?: string
          kind?: string
          resolved_at?: string | null
          title?: string
        }
        Relationships: []
      }
      admin_login_log: {
        Row: {
          email: string
          id: string
          logged_in_at: string
          user_id: string
        }
        Insert: {
          email: string
          id?: string
          logged_in_at?: string
          user_id: string
        }
        Update: {
          email?: string
          id?: string
          logged_in_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          permissions: Json
          requires_blog_approval: boolean
          requires_campaign_approval: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          is_active?: boolean
          permissions?: Json
          requires_blog_approval?: boolean
          requires_campaign_approval?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          permissions?: Json
          requires_blog_approval?: boolean
          requires_campaign_approval?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audience_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      audience_members: {
        Row: {
          created_at: string
          email: string
          group_id: string
          id: string
          name: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          group_id: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          group_id?: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audience_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "audience_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          approval_status: string | null
          archived: boolean | null
          author: string
          body_captions: Json | null
          body_images: Json | null
          body_template: string | null
          category: string
          content: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          drop_cap_enabled: boolean
          editors: Json | null
          excerpt: string
          featured_image_url: string | null
          hero_template: string
          id: string
          last_edited_by: string | null
          last_edited_by_name: string | null
          polaroid_caption: string | null
          published_at: string | null
          slug: string
          status: string
          subscribers_notified: boolean | null
          title: string
        }
        Insert: {
          approval_status?: string | null
          archived?: boolean | null
          author: string
          body_captions?: Json | null
          body_images?: Json | null
          body_template?: string | null
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          drop_cap_enabled?: boolean
          editors?: Json | null
          excerpt: string
          featured_image_url?: string | null
          hero_template?: string
          id?: string
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          polaroid_caption?: string | null
          published_at?: string | null
          slug: string
          status?: string
          subscribers_notified?: boolean | null
          title: string
        }
        Update: {
          approval_status?: string | null
          archived?: boolean | null
          author?: string
          body_captions?: Json | null
          body_images?: Json | null
          body_template?: string | null
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          drop_cap_enabled?: boolean
          editors?: Json | null
          excerpt?: string
          featured_image_url?: string | null
          hero_template?: string
          id?: string
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          polaroid_caption?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          subscribers_notified?: boolean | null
          title?: string
        }
        Relationships: []
      }
      budget_bands: {
        Row: {
          id: string
          is_active: boolean
          is_discuss: boolean
          label: string
          lower_naira: number | null
          sort_order: number
          upper_naira: number | null
        }
        Insert: {
          id?: string
          is_active?: boolean
          is_discuss?: boolean
          label: string
          lower_naira?: number | null
          sort_order?: number
          upper_naira?: number | null
        }
        Update: {
          id?: string
          is_active?: boolean
          is_discuss?: boolean
          label?: string
          lower_naira?: number | null
          sort_order?: number
          upper_naira?: number | null
        }
        Relationships: []
      }
      campaign_events: {
        Row: {
          campaign_id: string | null
          created_at: string
          event_type: string
          id: string
          link_url: string | null
          metadata: Json | null
          person_id: string | null
          recipient_email: string
          resend_email_id: string | null
          template: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          link_url?: string | null
          metadata?: Json | null
          person_id?: string | null
          recipient_email: string
          resend_email_id?: string | null
          template?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          link_url?: string | null
          metadata?: Json | null
          person_id?: string | null
          recipient_email?: string
          resend_email_id?: string | null
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      campaigns: {
        Row: {
          approval_status: string | null
          archived: boolean
          audience_type: string
          blocks: Json
          content: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          editors: Json | null
          id: string
          kind: string
          last_edited_by: string | null
          last_edited_by_name: string | null
          manual_recipients: string[] | null
          preheader: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string
          template_data: Json | null
          title: string
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_opened: number | null
          total_recipients: number | null
          total_sent: number
          tracking_enabled: boolean
        }
        Insert: {
          approval_status?: string | null
          archived?: boolean
          audience_type?: string
          blocks?: Json
          content?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          editors?: Json | null
          id?: string
          kind?: string
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          manual_recipients?: string[] | null
          preheader?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          template_data?: Json | null
          title?: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number
          tracking_enabled?: boolean
        }
        Update: {
          approval_status?: string | null
          archived?: boolean
          audience_type?: string
          blocks?: Json
          content?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          editors?: Json | null
          id?: string
          kind?: string
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          manual_recipients?: string[] | null
          preheader?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          template_data?: Json | null
          title?: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number
          tracking_enabled?: boolean
        }
        Relationships: []
      }
      care_access_bases: {
        Row: {
          basis_kind: string
          client_id: string
          created_at: string
          evidence_note: string | null
          evidence_sighted: boolean
          id: string
          person_id: string
          recorded_at: string
          recorded_by: string | null
          updated_at: string
          withdrawn_at: string | null
          withdrawn_by: string | null
          withdrawn_reason: string | null
        }
        Insert: {
          basis_kind: string
          client_id: string
          created_at?: string
          evidence_note?: string | null
          evidence_sighted?: boolean
          id?: string
          person_id: string
          recorded_at?: string
          recorded_by?: string | null
          updated_at?: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          withdrawn_reason?: string | null
        }
        Update: {
          basis_kind?: string
          client_id?: string
          created_at?: string
          evidence_note?: string | null
          evidence_sighted?: boolean
          id?: string
          person_id?: string
          recorded_at?: string
          recorded_by?: string | null
          updated_at?: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          withdrawn_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_access_bases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_bases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      care_access_grants: {
        Row: {
          client_id: string
          clinical_basis_id: string | null
          clinical_scope: boolean
          created_at: string
          finance_basis_id: string | null
          finance_scope: boolean
          grant_reason: string | null
          granted_at: string
          granted_by: string | null
          id: string
          journey_scope: boolean
          person_id: string
          purpose: string | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          state: string
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          clinical_basis_id?: string | null
          clinical_scope?: boolean
          created_at?: string
          finance_basis_id?: string | null
          finance_scope?: boolean
          grant_reason?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          journey_scope?: boolean
          person_id: string
          purpose?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          state?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          clinical_basis_id?: string | null
          clinical_scope?: boolean
          created_at?: string
          finance_basis_id?: string | null
          finance_scope?: boolean
          grant_reason?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          journey_scope?: boolean
          person_id?: string
          purpose?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          state?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_access_grants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_grants_clinical_basis_id_fkey"
            columns: ["clinical_basis_id"]
            isOneToOne: false
            referencedRelation: "care_access_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_grants_finance_basis_id_fkey"
            columns: ["finance_basis_id"]
            isOneToOne: false
            referencedRelation: "care_access_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_grants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      care_access_log: {
        Row: {
          action: string
          client_id: string
          created_at: string
          document_id: string | null
          id: string
          ip: string | null
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          client_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          ip?: string | null
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          client_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          ip?: string | null
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_access_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "care_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      care_access_tokens: {
        Row: {
          client_id: string
          contact_id: string | null
          covers_recipient_key: string | null
          covers_services: string[] | null
          created_at: string
          delivery_method: string | null
          document_id: string | null
          expires_at: string | null
          filler_type: string
          first_opened_at: string | null
          frozen_at: string | null
          id: string
          onboarding_link_id: string | null
          parent_token_id: string | null
          person_id: string | null
          position: Json
          purpose: string
          request_id: string | null
          request_recipient_id: string | null
          revoked_at: string | null
          scope: string
          session_id: string | null
          submitted_at: string | null
          suppress_auto_grant: boolean
          token_hash: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contact_id?: string | null
          covers_recipient_key?: string | null
          covers_services?: string[] | null
          created_at?: string
          delivery_method?: string | null
          document_id?: string | null
          expires_at?: string | null
          filler_type: string
          first_opened_at?: string | null
          frozen_at?: string | null
          id?: string
          onboarding_link_id?: string | null
          parent_token_id?: string | null
          person_id?: string | null
          position?: Json
          purpose?: string
          request_id?: string | null
          request_recipient_id?: string | null
          revoked_at?: string | null
          scope?: string
          session_id?: string | null
          submitted_at?: string | null
          suppress_auto_grant?: boolean
          token_hash: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contact_id?: string | null
          covers_recipient_key?: string | null
          covers_services?: string[] | null
          created_at?: string
          delivery_method?: string | null
          document_id?: string | null
          expires_at?: string | null
          filler_type?: string
          first_opened_at?: string | null
          frozen_at?: string | null
          id?: string
          onboarding_link_id?: string | null
          parent_token_id?: string | null
          person_id?: string | null
          position?: Json
          purpose?: string
          request_id?: string | null
          request_recipient_id?: string | null
          revoked_at?: string | null
          scope?: string
          session_id?: string | null
          submitted_at?: string | null
          suppress_auto_grant?: boolean
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_access_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_onboarding_link_id_fkey"
            columns: ["onboarding_link_id"]
            isOneToOne: false
            referencedRelation: "care_client_onboarding_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_parent_token_id_fkey"
            columns: ["parent_token_id"]
            isOneToOne: false
            referencedRelation: "care_access_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_request_recipient_id_fkey"
            columns: ["request_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_request_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_access_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "care_questionnaire_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      care_activity: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          client_id: string
          created_at: string
          detail: Json
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          client_id: string
          created_at?: string
          detail?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          client_id?: string
          created_at?: string
          detail?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_activity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_answer_context_maps: {
        Row: {
          cardinality: string
          created_at: string
          display_context: string
          field_id: string
          form_definition_id: string
          id: string
          subject: string
        }
        Insert: {
          cardinality: string
          created_at?: string
          display_context: string
          field_id: string
          form_definition_id: string
          id?: string
          subject: string
        }
        Update: {
          cardinality?: string
          created_at?: string
          display_context?: string
          field_id?: string
          form_definition_id?: string
          id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_answer_context_maps_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      care_assessment_capture_events: {
        Row: {
          assessment_id: string
          author_person_id: string | null
          captured_at: string
          client_event_id: string
          client_seq: number | null
          field_id: string
          id: string
          received_at: string
          value: Json | null
        }
        Insert: {
          assessment_id: string
          author_person_id?: string | null
          captured_at?: string
          client_event_id: string
          client_seq?: number | null
          field_id: string
          id?: string
          received_at?: string
          value?: Json | null
        }
        Update: {
          assessment_id?: string
          author_person_id?: string | null
          captured_at?: string
          client_event_id?: string
          client_seq?: number | null
          field_id?: string
          id?: string
          received_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "care_assessment_capture_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "care_assessment_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_capture_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_capture_events_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      care_assessment_events: {
        Row: {
          actor_id: string | null
          assessment_id: string
          created_at: string
          detail: Json
          event: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          assessment_id: string
          created_at?: string
          detail?: Json
          event: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          assessment_id?: string
          created_at?: string
          detail?: Json
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_assessment_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "care_assessment_work"
            referencedColumns: ["id"]
          },
        ]
      }
      care_assessment_reviews: {
        Row: {
          assessment_document_id: string
          assessment_work_id: string
          checklist: Json
          client_id: string
          completed_at: string | null
          created_at: string
          decision: string | null
          decision_notes: string | null
          decision_reason: string | null
          id: string
          return_category: string | null
          return_instructions: string | null
          return_priority: string | null
          reviewer_user_id: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          assessment_document_id: string
          assessment_work_id: string
          checklist?: Json
          client_id: string
          completed_at?: string | null
          created_at?: string
          decision?: string | null
          decision_notes?: string | null
          decision_reason?: string | null
          id?: string
          return_category?: string | null
          return_instructions?: string | null
          return_priority?: string | null
          reviewer_user_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_document_id?: string
          assessment_work_id?: string
          checklist?: Json
          client_id?: string
          completed_at?: string | null
          created_at?: string
          decision?: string | null
          decision_notes?: string | null
          decision_reason?: string | null
          id?: string
          return_category?: string | null
          return_instructions?: string | null
          return_priority?: string | null
          reviewer_user_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_assessment_reviews_assessment_document_id_fkey"
            columns: ["assessment_document_id"]
            isOneToOne: true
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_reviews_assessment_work_id_fkey"
            columns: ["assessment_work_id"]
            isOneToOne: false
            referencedRelation: "care_assessment_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_assessment_visits: {
        Row: {
          address_line: string | null
          appointment_at: string | null
          appointment_ends_at: string | null
          assessor_person_id: string | null
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          landmark: string | null
          location_kind: string
          notes: string | null
          request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          appointment_at?: string | null
          appointment_ends_at?: string | null
          assessor_person_id?: string | null
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          landmark?: string | null
          location_kind?: string
          notes?: string | null
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          appointment_at?: string | null
          appointment_ends_at?: string | null
          assessor_person_id?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          landmark?: string | null
          location_kind?: string
          notes?: string | null
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_assessment_visits_assessor_person_id_fkey"
            columns: ["assessor_person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_visits_assessor_person_id_fkey"
            columns: ["assessor_person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "care_assessment_visits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_visits_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      care_assessment_work: {
        Row: {
          appointment_at: string | null
          appointment_ends_at: string | null
          assessor_person_id: string | null
          assigned_at: string | null
          assigned_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          client_id: string
          created_at: string
          document_id: string | null
          id: string
          location_kind: string
          notes: string | null
          requested_by: string | null
          review_checklist: Json | null
          review_decision: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_document_id: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          appointment_at?: string | null
          appointment_ends_at?: string | null
          assessor_person_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          location_kind?: string
          notes?: string | null
          requested_by?: string | null
          review_checklist?: Json | null
          review_decision?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          appointment_at?: string | null
          appointment_ends_at?: string | null
          assessor_person_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          location_kind?: string
          notes?: string | null
          requested_by?: string | null
          review_checklist?: Json | null
          review_decision?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_assessment_work_assessor_person_id_fkey"
            columns: ["assessor_person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_work_assessor_person_id_fkey"
            columns: ["assessor_person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "care_assessment_work_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_work_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_work_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assessment_work_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "care_assessment_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      care_assignments: {
        Row: {
          client_id: string
          created_at: string
          ends_on: string | null
          id: string
          person_id: string
          plan_version_id: string | null
          role: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          ends_on?: string | null
          id?: string
          person_id: string
          plan_version_id?: string | null
          role: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          person_id?: string
          plan_version_id?: string | null
          role?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "care_assignments_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      care_client_onboarding_links: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivery_method: string | null
          destination_email: string | null
          duplicate_signals: Json
          expires_at: string
          first_opened_at: string | null
          id: string
          intake: Json
          position: number
          pre_assessment_token_id: string | null
          request_id: string | null
          revoked_at: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string | null
          destination_email?: string | null
          duplicate_signals?: Json
          expires_at: string
          first_opened_at?: string | null
          id?: string
          intake?: Json
          position?: number
          pre_assessment_token_id?: string | null
          request_id?: string | null
          revoked_at?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string | null
          destination_email?: string | null
          duplicate_signals?: Json
          expires_at?: string
          first_opened_at?: string | null
          id?: string
          intake?: Json
          position?: number
          pre_assessment_token_id?: string | null
          request_id?: string | null
          revoked_at?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_client_onboarding_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_client_onboarding_links_pre_assessment_token_id_fkey"
            columns: ["pre_assessment_token_id"]
            isOneToOne: false
            referencedRelation: "care_access_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_client_onboarding_links_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      care_delivery_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          capability_code: string
          created_at: string
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          episode_id: string
          id: string
          person_id: string
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          capability_code: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          episode_id: string
          id?: string
          person_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          capability_code?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          episode_id?: string
          id?: string
          person_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_delivery_assignments_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "care_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_delivery_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_delivery_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      care_documents: {
        Row: {
          active_evidence: Json | null
          assessment_work_id: string | null
          authored_by_person_id: string | null
          authored_by_token_id: string | null
          built_from_id: string | null
          client_id: string
          content_hash: string | null
          created_at: string
          form_definition_id: string
          id: string
          kind: string
          outstanding_required: Json
          reissue_reason: string | null
          resolved_modules: Json
          responses: Json
          routing_facts: Json | null
          status: string
          submitted_at: string | null
          supersedes_id: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          active_evidence?: Json | null
          assessment_work_id?: string | null
          authored_by_person_id?: string | null
          authored_by_token_id?: string | null
          built_from_id?: string | null
          client_id: string
          content_hash?: string | null
          created_at?: string
          form_definition_id: string
          id?: string
          kind: string
          outstanding_required?: Json
          reissue_reason?: string | null
          resolved_modules?: Json
          responses?: Json
          routing_facts?: Json | null
          status?: string
          submitted_at?: string | null
          supersedes_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          active_evidence?: Json | null
          assessment_work_id?: string | null
          authored_by_person_id?: string | null
          authored_by_token_id?: string | null
          built_from_id?: string | null
          client_id?: string
          content_hash?: string | null
          created_at?: string
          form_definition_id?: string
          id?: string
          kind?: string
          outstanding_required?: Json
          reissue_reason?: string | null
          resolved_modules?: Json
          responses?: Json
          routing_facts?: Json | null
          status?: string
          submitted_at?: string | null
          supersedes_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "care_documents_assessment_work_id_fkey"
            columns: ["assessment_work_id"]
            isOneToOne: false
            referencedRelation: "care_assessment_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_documents_built_from_id_fkey"
            columns: ["built_from_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_documents_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      care_episodes: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          client_id: string
          configuration_snapshot: Json
          created_at: string
          created_by: string | null
          ended_reason: string | null
          ends_at: string | null
          id: string
          overrides: Json
          service_code: string
          service_configuration_id: string | null
          service_configuration_version: number | null
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          client_id: string
          configuration_snapshot?: Json
          created_at?: string
          created_by?: string | null
          ended_reason?: string | null
          ends_at?: string | null
          id?: string
          overrides?: Json
          service_code: string
          service_configuration_id?: string | null
          service_configuration_version?: number | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          client_id?: string
          configuration_snapshot?: Json
          created_at?: string
          created_by?: string | null
          ended_reason?: string | null
          ends_at?: string | null
          id?: string
          overrides?: Json
          service_code?: string
          service_configuration_id?: string | null
          service_configuration_version?: number | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_episodes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_episodes_service_code_fkey"
            columns: ["service_code"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "care_episodes_service_configuration_id_fkey"
            columns: ["service_configuration_id"]
            isOneToOne: false
            referencedRelation: "care_service_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_finance_adjustments: {
        Row: {
          amount: number
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          kind: string
          reason: string
          reference: string
          status: string
        }
        Insert: {
          amount: number
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          invoice_id: string
          kind: string
          reason: string
          reference: string
          status?: string
        }
        Update: {
          amount?: number
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          kind?: string
          reason?: string
          reference?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_finance_adjustments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_finance_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "paystack_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      care_flags: {
        Row: {
          clear_note: string | null
          cleared_at: string | null
          cleared_by: string | null
          client_id: string
          created_at: string
          detail: string | null
          document_id: string | null
          id: string
          kind: string
          raised_by: string
          severity: string
        }
        Insert: {
          clear_note?: string | null
          cleared_at?: string | null
          cleared_by?: string | null
          client_id: string
          created_at?: string
          detail?: string | null
          document_id?: string | null
          id?: string
          kind: string
          raised_by?: string
          severity?: string
        }
        Update: {
          clear_note?: string | null
          cleared_at?: string | null
          cleared_by?: string | null
          client_id?: string
          created_at?: string
          detail?: string | null
          document_id?: string | null
          id?: string
          kind?: string
          raised_by?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_flags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_flags_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      care_form_revision_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          actor_name: string | null
          changed_fields: Json
          client_id: string
          created_at: string
          document_id: string
          event: string
          id: string
          outstanding_required: Json
          reason: string | null
          revision_number: number
          session_id: string | null
          token_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          actor_name?: string | null
          changed_fields?: Json
          client_id: string
          created_at?: string
          document_id: string
          event: string
          id?: string
          outstanding_required?: Json
          reason?: string | null
          revision_number?: number
          session_id?: string | null
          token_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          actor_name?: string | null
          changed_fields?: Json
          client_id?: string
          created_at?: string
          document_id?: string
          event?: string
          id?: string
          outstanding_required?: Json
          reason?: string | null
          revision_number?: number
          session_id?: string | null
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_form_revision_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_form_revision_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_form_revision_events_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "care_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      care_group_members: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          notes: string | null
          person_id: string
          role: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          notes?: string | null
          person_id: string
          role: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          notes?: string | null
          person_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_group_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      care_group_relationship_terms: {
        Row: {
          code: string
          inverse_code: string | null
          is_active: boolean
          label: string
          requires_text: boolean
          version: number
        }
        Insert: {
          code: string
          inverse_code?: string | null
          is_active?: boolean
          label: string
          requires_text?: boolean
          version?: number
        }
        Update: {
          code?: string
          inverse_code?: string | null
          is_active?: boolean
          label?: string
          requires_text?: boolean
          version?: number
        }
        Relationships: []
      }
      care_groups: {
        Row: {
          address_line: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          landmark: string | null
          lga_code: string | null
          origin_client_id: string | null
          source: string
          state_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          landmark?: string | null
          lga_code?: string | null
          origin_client_id?: string | null
          source?: string
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          landmark?: string | null
          lga_code?: string | null
          origin_client_id?: string | null
          source?: string
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_groups_origin_client_id_fkey"
            columns: ["origin_client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_languages: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      care_lgas: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          label: string
          state_code: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          label: string
          state_code: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          label?: string
          state_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_lgas_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "care_states"
            referencedColumns: ["code"]
          },
        ]
      }
      care_notifications: {
        Row: {
          attempt_count: number
          channel: string
          client_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string
          destination: string | null
          failed_at: string | null
          id: string
          kind: string
          last_attempt_at: string | null
          origin: string
          person_id: string | null
          provider_error: string | null
          provider_message_id: string | null
          queued_at: string
          related_id: string | null
          related_table: string | null
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key: string
          destination?: string | null
          failed_at?: string | null
          id?: string
          kind: string
          last_attempt_at?: string | null
          origin?: string
          person_id?: string | null
          provider_error?: string | null
          provider_message_id?: string | null
          queued_at?: string
          related_id?: string | null
          related_table?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string
          destination?: string | null
          failed_at?: string | null
          id?: string
          kind?: string
          last_attempt_at?: string | null
          origin?: string
          person_id?: string | null
          provider_error?: string | null
          provider_message_id?: string | null
          queued_at?: string
          related_id?: string | null
          related_table?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_notifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      care_people: {
        Row: {
          auth_user_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          phone: string | null
          preferred_name: string | null
          source: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          auth_user_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          phone?: string | null
          preferred_name?: string | null
          source?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          auth_user_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          preferred_name?: string | null
          source?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      care_person_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          from_person_id: string
          group_id: string | null
          id: string
          other_label: string | null
          relationship_code: string
          to_person_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_person_id: string
          group_id?: string | null
          id?: string
          other_label?: string | null
          relationship_code: string
          to_person_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_person_id?: string
          group_id?: string | null
          id?: string
          other_label?: string | null
          relationship_code?: string
          to_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_person_relationships_from_person_id_fkey"
            columns: ["from_person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_person_relationships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_person_relationships_relationship_code_fkey"
            columns: ["relationship_code"]
            isOneToOne: false
            referencedRelation: "care_group_relationship_terms"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "care_person_relationships_to_person_id_fkey"
            columns: ["to_person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_approvals: {
        Row: {
          actor_id: string
          actor_name: string | null
          actor_role: string
          client_id: string
          content_hash: string
          created_at: string
          decision: string
          document_id: string
          id: string
          reason: string | null
        }
        Insert: {
          actor_id: string
          actor_name?: string | null
          actor_role: string
          client_id: string
          content_hash: string
          created_at?: string
          decision: string
          document_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          actor_id?: string
          actor_name?: string | null
          actor_role?: string
          client_id?: string
          content_hash?: string
          created_at?: string
          decision?: string
          document_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_approvals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_goals: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          detail: string | null
          document_id: string
          id: string
          measure: string | null
          need_id: string | null
          ordering: number
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id: string
          id?: string
          measure?: string | null
          need_id?: string | null
          ordering?: number
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id?: string
          id?: string
          measure?: string | null
          need_id?: string | null
          ordering?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_goals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_goals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_goals_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "care_plan_needs"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_needs: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          detail: string | null
          document_id: string
          id: string
          ordering: number
          section_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id: string
          id?: string
          ordering?: number
          section_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id?: string
          id?: string
          ordering?: number
          section_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_needs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_needs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_tasks: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          detail: string | null
          document_id: string
          frequency: string | null
          goal_id: string | null
          id: string
          ordering: number
          section_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id: string
          frequency?: string | null
          goal_id?: string | null
          id?: string
          ordering?: number
          section_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id?: string
          frequency?: string | null
          goal_id?: string | null
          id?: string
          ordering?: number
          section_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_tasks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "care_plan_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      care_portal_invitations: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          destination: string | null
          expires_at: string
          first_opened_at: string | null
          grant_id: string
          id: string
          person_id: string
          revoked_at: string | null
          revoked_reason: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          expires_at: string
          first_opened_at?: string | null
          grant_id: string
          id?: string
          person_id: string
          revoked_at?: string | null
          revoked_reason?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          expires_at?: string
          first_opened_at?: string | null
          grant_id?: string
          id?: string
          person_id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_portal_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_portal_invitations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "care_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_portal_invitations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      care_pre_assessment_coverage: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          intention_id: string
          request_id: string
          request_recipient_id: string
          returned_at: string | null
          status: string
          token_id: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          intention_id: string
          request_id: string
          request_recipient_id: string
          returned_at?: string | null
          status?: string
          token_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          intention_id?: string
          request_id?: string
          request_recipient_id?: string
          returned_at?: string | null
          status?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_pre_assessment_coverage_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_pre_assessment_coverage_intention_id_fkey"
            columns: ["intention_id"]
            isOneToOne: false
            referencedRelation: "care_service_intentions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_pre_assessment_coverage_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_pre_assessment_coverage_request_recipient_id_fkey"
            columns: ["request_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_request_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_pre_assessment_coverage_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "care_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      care_proposal_comments: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          person_id: string | null
          proposal_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          person_id?: string | null
          proposal_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          person_id?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_proposal_comments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_proposal_comments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "care_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      care_proposal_responses: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          person_id: string | null
          proposal_id: string
          responded_by: string | null
          response: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          person_id?: string | null
          proposal_id: string
          responded_by?: string | null
          response: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          person_id?: string | null
          proposal_id?: string
          responded_by?: string | null
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_proposal_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_proposal_responses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_proposal_responses_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "care_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      care_proposal_sends: {
        Row: {
          id: string
          person_id: string
          proposal_id: string
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          id?: string
          person_id: string
          proposal_id: string
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          id?: string
          person_id?: string
          proposal_id?: string
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_proposal_sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_proposal_sends_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "care_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      care_proposals: {
        Row: {
          client_id: string
          content: Json
          content_hash: string | null
          created_at: string
          created_by: string | null
          id: string
          plan_document_id: string
          sent_at: string | null
          sent_by: string | null
          status: string
          supersedes_id: string | null
          version: number
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          client_id: string
          content?: Json
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          plan_document_id: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          supersedes_id?: string | null
          version: number
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          client_id?: string
          content?: Json
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          plan_document_id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          supersedes_id?: string | null
          version?: number
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_proposals_plan_document_id_fkey"
            columns: ["plan_document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_proposals_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "care_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      care_public_holidays: {
        Row: {
          holiday_on: string
          name: string
        }
        Insert: {
          holiday_on: string
          name: string
        }
        Update: {
          holiday_on?: string
          name?: string
        }
        Relationships: []
      }
      care_questionnaire_session_recipients: {
        Row: {
          client_id: string
          created_at: string
          display_order: number
          document_id: string
          id: string
          request_recipient_id: string
          session_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          display_order?: number
          document_id: string
          id?: string
          request_recipient_id: string
          session_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          display_order?: number
          document_id?: string
          id?: string
          request_recipient_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_questionnaire_session_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_questionnaire_session_recipients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_questionnaire_session_recipients_request_recipient_id_fkey"
            columns: ["request_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_request_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_questionnaire_session_recipients_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "care_questionnaire_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      care_questionnaire_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          filler_type: string
          form_definition_id: string
          id: string
          position_page: string | null
          position_recipient_id: string | null
          position_section: string | null
          request_id: string
          respondent_contact_id: string | null
          respondent_person_id: string | null
          shared_responses: Json
          status: string
          submitted_at: string | null
          superseded_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filler_type?: string
          form_definition_id: string
          id?: string
          position_page?: string | null
          position_recipient_id?: string | null
          position_section?: string | null
          request_id: string
          respondent_contact_id?: string | null
          respondent_person_id?: string | null
          shared_responses?: Json
          status?: string
          submitted_at?: string | null
          superseded_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filler_type?: string
          form_definition_id?: string
          id?: string
          position_page?: string | null
          position_recipient_id?: string | null
          position_section?: string | null
          request_id?: string
          respondent_contact_id?: string | null
          respondent_person_id?: string | null
          shared_responses?: Json
          status?: string
          submitted_at?: string | null
          superseded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_questionnaire_sessions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_questionnaire_sessions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_questionnaire_sessions_respondent_person_id_fkey"
            columns: ["respondent_person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      care_quote_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          position: number
          quantity: number
          quote_version_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_version_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_version_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "care_quote_lines_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: false
            referencedRelation: "care_quote_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      care_quote_versions: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string
          id: string
          issued_at: string | null
          notes: string | null
          quote_id: string
          status: string
          subtotal: number
          total: number
          valid_until: string | null
          vat_amount: number
          vat_rate: number
          version: number
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          quote_id: string
          status?: string
          subtotal?: number
          total?: number
          valid_until?: string | null
          vat_amount?: number
          vat_rate?: number
          version: number
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          quote_id?: string
          status?: string
          subtotal?: number
          total?: number
          valid_until?: string | null
          vat_amount?: number
          vat_rate?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "care_quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "care_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      care_quotes: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_version_id: string | null
          client_id: string
          created_at: string
          created_by: string
          currency: string
          current_version: number
          id: string
          quote_number: string
          recipient_contact_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_version_id?: string | null
          client_id: string
          created_at?: string
          created_by: string
          currency?: string
          current_version?: number
          id?: string
          quote_number: string
          recipient_contact_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_version_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          current_version?: number
          id?: string
          quote_number?: string
          recipient_contact_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_quotes_accepted_version_fk"
            columns: ["accepted_version_id"]
            isOneToOne: false
            referencedRelation: "care_quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_quotes_recipient_contact_id_fkey"
            columns: ["recipient_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      care_relationship_terms: {
        Row: {
          code: string
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      care_request_recipients: {
        Row: {
          address_line: string | null
          client_id: string
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          intake_recipient_key: string | null
          landmark: string | null
          lga_code: string | null
          person_id: string | null
          request_id: string
          role: string
          state_code: string | null
        }
        Insert: {
          address_line?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          intake_recipient_key?: string | null
          landmark?: string | null
          lga_code?: string | null
          person_id?: string | null
          request_id: string
          role?: string
          state_code?: string | null
        }
        Update: {
          address_line?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          intake_recipient_key?: string | null
          landmark?: string | null
          lga_code?: string | null
          person_id?: string | null
          request_id?: string
          role?: string
          state_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_request_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_request_recipients_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_request_recipients_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      care_requests: {
        Row: {
          attribution: Json | null
          callback_at: string | null
          callback_phone: string | null
          created_at: string
          created_by: string | null
          created_from_submission_id: string | null
          enquirer_person_id: string | null
          enquiry_notes: string | null
          group_id: string
          id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          attribution?: Json | null
          callback_at?: string | null
          callback_phone?: string | null
          created_at?: string
          created_by?: string | null
          created_from_submission_id?: string | null
          enquirer_person_id?: string | null
          enquiry_notes?: string | null
          group_id: string
          id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attribution?: Json | null
          callback_at?: string | null
          callback_phone?: string | null
          created_at?: string
          created_by?: string | null
          created_from_submission_id?: string | null
          enquirer_person_id?: string | null
          enquiry_notes?: string | null
          group_id?: string
          id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_requests_enquirer_person_id_fkey"
            columns: ["enquirer_person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "care_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      care_response_amendments: {
        Row: {
          amended_by: string | null
          amended_by_name: string | null
          client_id: string
          corrected_value: Json | null
          created_at: string
          document_id: string
          field_id: string
          id: string
          original_value: Json | null
          reason: string
          section_id: string | null
          session_id: string | null
        }
        Insert: {
          amended_by?: string | null
          amended_by_name?: string | null
          client_id: string
          corrected_value?: Json | null
          created_at?: string
          document_id: string
          field_id: string
          id?: string
          original_value?: Json | null
          reason: string
          section_id?: string | null
          session_id?: string | null
        }
        Update: {
          amended_by?: string | null
          amended_by_name?: string | null
          client_id?: string
          corrected_value?: Json | null
          created_at?: string
          document_id?: string
          field_id?: string
          id?: string
          original_value?: Json | null
          reason?: string
          section_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_response_amendments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_response_amendments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      care_service_configurations: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          modules: Json
          published_at: string | null
          published_by: string | null
          retired_at: string | null
          retired_by: string | null
          service_code: string
          status: string
          supersedes_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          modules?: Json
          published_at?: string | null
          published_by?: string | null
          retired_at?: string | null
          retired_by?: string | null
          service_code: string
          status?: string
          supersedes_id?: string | null
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          modules?: Json
          published_at?: string | null
          published_by?: string | null
          retired_at?: string | null
          retired_by?: string | null
          service_code?: string
          status?: string
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "care_service_configurations_service_code_fkey"
            columns: ["service_code"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "care_service_configurations_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "care_service_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_service_intention_recipients: {
        Row: {
          conflict_reason: string | null
          created_at: string
          id: string
          intention_id: string
          needs_clinical_resolution: boolean
          request_recipient_id: string
        }
        Insert: {
          conflict_reason?: string | null
          created_at?: string
          id?: string
          intention_id: string
          needs_clinical_resolution?: boolean
          request_recipient_id: string
        }
        Update: {
          conflict_reason?: string | null
          created_at?: string
          id?: string
          intention_id?: string
          needs_clinical_resolution?: boolean
          request_recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_service_intention_recipients_intention_id_fkey"
            columns: ["intention_id"]
            isOneToOne: false
            referencedRelation: "care_service_intentions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_service_intention_recipients_request_recipient_id_fkey"
            columns: ["request_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_request_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_service_intentions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_shared: boolean
          reason: string | null
          request_id: string
          service_id: string
          source: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean
          reason?: string | null
          request_id: string
          service_id: string
          source?: string
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_shared?: boolean
          reason?: string | null
          request_id?: string
          service_id?: string
          source?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_service_intentions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_service_intentions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      care_sex_terms: {
        Row: {
          code: string
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      care_states: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      care_upload_files: {
        Row: {
          byte_size: number
          client_id: string
          created_at: string
          detected_mime: string
          document_id: string | null
          field_id: string
          id: string
          original_name: string
          request_id: string | null
          request_recipient_id: string | null
          session_id: string | null
          storage_bucket: string
          storage_path: string
          token_id: string | null
        }
        Insert: {
          byte_size: number
          client_id: string
          created_at?: string
          detected_mime: string
          document_id?: string | null
          field_id: string
          id?: string
          original_name: string
          request_id?: string | null
          request_recipient_id?: string | null
          session_id?: string | null
          storage_bucket?: string
          storage_path: string
          token_id?: string | null
        }
        Update: {
          byte_size?: number
          client_id?: string
          created_at?: string
          detected_mime?: string
          document_id?: string | null
          field_id?: string
          id?: string
          original_name?: string
          request_id?: string | null
          request_recipient_id?: string | null
          session_id?: string | null
          storage_bucket?: string
          storage_path?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_upload_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_upload_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_upload_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_upload_files_request_recipient_id_fkey"
            columns: ["request_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_request_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_upload_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "care_questionnaire_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_upload_files_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "care_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      care_work_items: {
        Row: {
          assignee_user_id: string | null
          blocked_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          document_id: string | null
          due_at: string | null
          enquiry_id: string | null
          id: string
          is_blocker: boolean
          kind: string
          outcome: string | null
          priority: string
          reopen_reason: string | null
          source_event: string | null
          source_key: string
          status: string
          team: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_user_id?: string | null
          blocked_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id?: string | null
          due_at?: string | null
          enquiry_id?: string | null
          id?: string
          is_blocker?: boolean
          kind: string
          outcome?: string | null
          priority?: string
          reopen_reason?: string | null
          source_event?: string | null
          source_key: string
          status?: string
          team?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_user_id?: string | null
          blocked_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          document_id?: string | null
          due_at?: string | null
          enquiry_id?: string | null
          id?: string
          is_blocker?: boolean
          kind?: string
          outcome?: string | null
          priority?: string
          reopen_reason?: string | null
          source_event?: string | null
          source_key?: string
          status?: string
          team?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_work_items_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "care_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_work_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_work_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "care_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_work_items_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "contact_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      care_working_hours: {
        Row: {
          closes: string
          is_working: boolean
          opens: string
          weekday: number
        }
        Insert: {
          closes?: string
          is_working?: boolean
          opens?: string
          weekday: number
        }
        Update: {
          closes?: string
          is_working?: boolean
          opens?: string
          weekday?: number
        }
        Relationships: []
      }
      claim_invites: {
        Row: {
          claimed_at: string | null
          created_at: string
          email: string
          id: string
          opened_at: string | null
          person_id: string | null
          sent_at: string | null
          source: string
          token: string
          track: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          email: string
          id?: string
          opened_at?: string | null
          person_id?: string | null
          sent_at?: string | null
          source?: string
          token: string
          track?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          opened_at?: string | null
          person_id?: string | null
          sent_at?: string | null
          source?: string
          token?: string
          track?: string | null
        }
        Relationships: []
      }
      client_commercial: {
        Row: {
          assessment_fee_state: string
          budget_band_id: string | null
          client_id: string
          created_at: string
          notes: string | null
          payer_person_id: string | null
          referral_source: string | null
          updated_at: string
          wants_to_discuss_budget: boolean
        }
        Insert: {
          assessment_fee_state?: string
          budget_band_id?: string | null
          client_id: string
          created_at?: string
          notes?: string | null
          payer_person_id?: string | null
          referral_source?: string | null
          updated_at?: string
          wants_to_discuss_budget?: boolean
        }
        Update: {
          assessment_fee_state?: string
          budget_band_id?: string | null
          client_id?: string
          created_at?: string
          notes?: string | null
          payer_person_id?: string | null
          referral_source?: string | null
          updated_at?: string
          wants_to_discuss_budget?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_commercial_budget_band_id_fkey"
            columns: ["budget_band_id"]
            isOneToOne: false
            referencedRelation: "budget_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_commercial_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_commercial_payer_person_id_fkey"
            columns: ["payer_person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          authority_basis: string | null
          authority_evidence_sighted: boolean
          best_time_to_reach: string | null
          client_id: string
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string
          id: string
          is_enquirer: boolean
          is_primary: boolean
          last_name: string | null
          may_act_for_client: boolean
          person_id: string
          phone: string | null
          relationship: string | null
          relationship_code: string | null
          relationship_other: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          authority_basis?: string | null
          authority_evidence_sighted?: boolean
          best_time_to_reach?: string | null
          client_id: string
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          is_enquirer?: boolean
          is_primary?: boolean
          last_name?: string | null
          may_act_for_client?: boolean
          person_id: string
          phone?: string | null
          relationship?: string | null
          relationship_code?: string | null
          relationship_other?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          authority_basis?: string | null
          authority_evidence_sighted?: boolean
          best_time_to_reach?: string | null
          client_id?: string
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          is_enquirer?: boolean
          is_primary?: boolean
          last_name?: string | null
          may_act_for_client?: boolean
          person_id?: string
          phone?: string | null
          relationship?: string | null
          relationship_code?: string | null
          relationship_other?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "care_people"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          abroad_country: string | null
          address_line: string | null
          age_years: number | null
          archived_at: string | null
          archived_by: string | null
          arranged_from_abroad: boolean
          care_language_codes: string[] | null
          client_group: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          created_from_submission_id: string | null
          date_of_birth: string | null
          date_of_birth_is_estimated: boolean
          enquiry_number: string | null
          first_name: string | null
          full_name: string
          id: string
          landmark: string | null
          language_codes: string[]
          languages: string[]
          last_name: string | null
          lga: string | null
          lga_code: string | null
          paused_at: string | null
          paused_reason: string | null
          preferred_name: string | null
          service_id: string | null
          sex: string | null
          sex_code: string | null
          stage: string
          state: string
          state_code: string | null
          updated_at: string
        }
        Insert: {
          abroad_country?: string | null
          address_line?: string | null
          age_years?: number | null
          archived_at?: string | null
          archived_by?: string | null
          arranged_from_abroad?: boolean
          care_language_codes?: string[] | null
          client_group?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          created_from_submission_id?: string | null
          date_of_birth?: string | null
          date_of_birth_is_estimated?: boolean
          enquiry_number?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          landmark?: string | null
          language_codes?: string[]
          languages?: string[]
          last_name?: string | null
          lga?: string | null
          lga_code?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          preferred_name?: string | null
          service_id?: string | null
          sex?: string | null
          sex_code?: string | null
          stage?: string
          state?: string
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          abroad_country?: string | null
          address_line?: string | null
          age_years?: number | null
          archived_at?: string | null
          archived_by?: string | null
          arranged_from_abroad?: boolean
          care_language_codes?: string[] | null
          client_group?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          created_from_submission_id?: string | null
          date_of_birth?: string | null
          date_of_birth_is_estimated?: boolean
          enquiry_number?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          landmark?: string | null
          language_codes?: string[]
          languages?: string[]
          last_name?: string | null
          lga?: string | null
          lga_code?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          preferred_name?: string | null
          service_id?: string | null
          sex?: string | null
          sex_code?: string | null
          stage?: string
          state?: string
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          answers: Json
          archived: boolean
          care_client_id: string | null
          city: string | null
          consent_email: boolean
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          landing_path: string | null
          last_name: string | null
          last_sent_at: string | null
          message: string
          name: string
          owner: string | null
          phone: string
          referrer: string | null
          replied_at: string | null
          service: string
          service_line: string | null
          source: string
          stage: string
          status: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          answers?: Json
          archived?: boolean
          care_client_id?: string | null
          city?: string | null
          consent_email?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          landing_path?: string | null
          last_name?: string | null
          last_sent_at?: string | null
          message: string
          name: string
          owner?: string | null
          phone: string
          referrer?: string | null
          replied_at?: string | null
          service: string
          service_line?: string | null
          source?: string
          stage?: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          answers?: Json
          archived?: boolean
          care_client_id?: string | null
          city?: string | null
          consent_email?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          landing_path?: string | null
          last_name?: string | null
          last_sent_at?: string | null
          message?: string
          name?: string
          owner?: string | null
          phone?: string
          referrer?: string | null
          replied_at?: string | null
          service?: string
          service_line?: string | null
          source?: string
          stage?: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      creator_applications: {
        Row: {
          archived: boolean
          country: string
          created_at: string
          email: string
          id: string
          landing_path: string | null
          message: string
          name: string
          phone: string
          portfolio_url: string | null
          rate_card_url: string | null
          referrer: string | null
          social_links: string
          status: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          archived?: boolean
          country: string
          created_at?: string
          email: string
          id?: string
          landing_path?: string | null
          message: string
          name: string
          phone: string
          portfolio_url?: string | null
          rate_card_url?: string | null
          referrer?: string | null
          social_links: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          archived?: boolean
          country?: string
          created_at?: string
          email?: string
          id?: string
          landing_path?: string | null
          message?: string
          name?: string
          phone?: string
          portfolio_url?: string | null
          rate_card_url?: string | null
          referrer?: string | null
          social_links?: string
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      email_kit_templates: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          kind: string
          name: string
          preheader: string
          purpose: string | null
          recipe: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          name: string
          preheader?: string
          purpose?: string | null
          recipe?: string | null
          subject?: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          name?: string
          preheader?: string
          purpose?: string | null
          recipe?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      enquiry_questions: {
        Row: {
          active: boolean
          created_at: string
          field_key: string
          help: string
          id: string
          input_type: string
          label: string
          options: Json
          required: boolean
          service_line_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          field_key: string
          help?: string
          id?: string
          input_type?: string
          label: string
          options?: Json
          required?: boolean
          service_line_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          field_key?: string
          help?: string
          id?: string
          input_type?: string
          label?: string
          options?: Json
          required?: boolean
          service_line_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_questions_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "enquiry_service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiry_sends: {
        Row: {
          actor: string | null
          brochure_name: string | null
          email: string
          enquiry_id: string | null
          error: string | null
          id: string
          kind: string
          provider_id: string | null
          sent_at: string
          service_line: string | null
          status: string
          subject: string
        }
        Insert: {
          actor?: string | null
          brochure_name?: string | null
          email: string
          enquiry_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          provider_id?: string | null
          sent_at?: string
          service_line?: string | null
          status?: string
          subject?: string
        }
        Update: {
          actor?: string | null
          brochure_name?: string | null
          email?: string
          enquiry_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          provider_id?: string | null
          sent_at?: string
          service_line?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      enquiry_service_lines: {
        Row: {
          active: boolean
          blurb: string
          brochure_name: string | null
          brochure_path: string | null
          brochure_updated_at: string | null
          created_at: string
          id: string
          key: string
          name: string
          reply_intro: string
          reply_outro: string
          reply_subject: string
          route: string | null
          segment: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          blurb?: string
          brochure_name?: string | null
          brochure_path?: string | null
          brochure_updated_at?: string | null
          created_at?: string
          id?: string
          key: string
          name: string
          reply_intro?: string
          reply_outro?: string
          reply_subject?: string
          route?: string | null
          segment?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          blurb?: string
          brochure_name?: string | null
          brochure_path?: string | null
          brochure_updated_at?: string | null
          created_at?: string
          id?: string
          key?: string
          name?: string
          reply_intro?: string
          reply_outro?: string
          reply_subject?: string
          route?: string | null
          segment?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      followup_queue: {
        Row: {
          created_at: string
          email: string
          id: string
          person_id: string | null
          queued_at: string
          reason: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          person_id?: string | null
          queued_at?: string
          reason?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          person_id?: string | null
          queued_at?: string
          reason?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_queue_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      form_definitions: {
        Row: {
          created_at: string
          definition: Json
          id: string
          kind: string
          published_at: string | null
          published_by: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          definition?: Json
          id?: string
          kind: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          definition?: Json
          id?: string
          kind?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      heard_consents: {
        Row: {
          consent_type: string
          consent_version: string
          created_at: string
          email: string | null
          granted_at: string
          id: string
          source: string | null
          subject_id: string | null
          subject_table: string | null
          withdrawn_at: string | null
        }
        Insert: {
          consent_type: string
          consent_version?: string
          created_at?: string
          email?: string | null
          granted_at?: string
          id?: string
          source?: string | null
          subject_id?: string | null
          subject_table?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          consent_type?: string
          consent_version?: string
          created_at?: string
          email?: string | null
          granted_at?: string
          id?: string
          source?: string | null
          subject_id?: string | null
          subject_table?: string | null
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      heard_letter_deliveries: {
        Row: {
          created_at: string
          delivery_status: string
          id: string
          letter_id: string
          provider_message_id: string | null
          recipient_id: string
          sent_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          id?: string
          letter_id: string
          provider_message_id?: string | null
          recipient_id: string
          sent_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_status?: string
          id?: string
          letter_id?: string
          provider_message_id?: string | null
          recipient_id?: string
          sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "heard_letter_deliveries_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "heard_letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heard_letter_deliveries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "heard_letter_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      heard_letter_recipients: {
        Row: {
          auth_user_id: string | null
          consent_version: string
          created_at: string
          email: string
          id: string
          status: string
          subscribed_at: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          consent_version?: string
          created_at?: string
          email: string
          id?: string
          status?: string
          subscribed_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          consent_version?: string
          created_at?: string
          email?: string
          id?: string
          status?: string
          subscribed_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      heard_letters: {
        Row: {
          approval_state: string
          auth_user_id: string | null
          content: string
          created_at: string
          destination: string
          heading: string | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          moderation_state: string
          public_ref: string
          published_at: string | null
          sign_it_as: string | null
          submitter_email: string | null
          updated_at: string
        }
        Insert: {
          approval_state?: string
          auth_user_id?: string | null
          content: string
          created_at?: string
          destination?: string
          heading?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_state?: string
          public_ref?: string
          published_at?: string | null
          sign_it_as?: string | null
          submitter_email?: string | null
          updated_at?: string
        }
        Update: {
          approval_state?: string
          auth_user_id?: string | null
          content?: string
          created_at?: string
          destination?: string
          heading?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_state?: string
          public_ref?: string
          published_at?: string | null
          sign_it_as?: string | null
          submitter_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      heard_stories: {
        Row: {
          approval_state: string
          auth_user_id: string | null
          content: string
          created_at: string
          delivery_state: string
          id: string
          matched_with_story_id: string | null
          matching_state: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          moderation_state: string
          sign_it_as: string | null
          subject: string | null
          submitter_email: string | null
          updated_at: string
        }
        Insert: {
          approval_state?: string
          auth_user_id?: string | null
          content: string
          created_at?: string
          delivery_state?: string
          id?: string
          matched_with_story_id?: string | null
          matching_state?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_state?: string
          sign_it_as?: string | null
          subject?: string | null
          submitter_email?: string | null
          updated_at?: string
        }
        Update: {
          approval_state?: string
          auth_user_id?: string | null
          content?: string
          created_at?: string
          delivery_state?: string
          id?: string
          matched_with_story_id?: string | null
          matching_state?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_state?: string
          sign_it_as?: string | null
          subject?: string | null
          submitter_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "heard_stories_matched_with_story_id_fkey"
            columns: ["matched_with_story_id"]
            isOneToOne: false
            referencedRelation: "heard_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      heard_submissions: {
        Row: {
          auth_user_id: string | null
          content: string
          created_at: string
          email: string | null
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          moderation_state: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          content: string
          created_at?: string
          email?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_state?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          content?: string
          created_at?: string
          email?: string | null
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_state?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      heard_volunteer_applications: {
        Row: {
          answers: Json
          created_at: string
          id: string
          profile_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          profile_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          profile_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "heard_volunteer_applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "heard_volunteer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      heard_volunteer_profiles: {
        Row: {
          adjustments: string | null
          adjustments_discuss_privately: boolean
          application_status: string
          city: string | null
          country_code: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          languages: Json
          last_name: string
          lga: string | null
          phone: string | null
          preferred_name: string | null
          role_interest: string
          subdivision_code: string | null
          subdivision_name: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustments?: string | null
          adjustments_discuss_privately?: boolean
          application_status?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          languages?: Json
          last_name: string
          lga?: string | null
          phone?: string | null
          preferred_name?: string | null
          role_interest: string
          subdivision_code?: string | null
          subdivision_name?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustments?: string | null
          adjustments_discuss_privately?: boolean
          application_status?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          languages?: Json
          last_name?: string
          lga?: string | null
          phone?: string | null
          preferred_name?: string | null
          role_interest?: string
          subdivision_code?: string | null
          subdivision_name?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      heard_volunteers: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          landing_path: string | null
          last_name: string
          motivation: string | null
          notes: string | null
          referrer: string | null
          role_interest: string
          state: string
          status: string
          time_commitment: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          landing_path?: string | null
          last_name: string
          motivation?: string | null
          notes?: string | null
          referrer?: string | null
          role_interest: string
          state: string
          status?: string
          time_commitment?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          landing_path?: string | null
          last_name?: string
          motivation?: string | null
          notes?: string | null
          referrer?: string | null
          role_interest?: string
          state?: string
          status?: string
          time_commitment?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      heard_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          landing_path: string | null
          purpose: string
          referrer: string | null
          source: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          landing_path?: string | null
          purpose?: string
          referrer?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          landing_path?: string | null
          purpose?: string
          referrer?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      invoice_service_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      invoice_services: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          price: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          price?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "invoice_service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      job_key_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          key_name: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          key_name: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          key_name?: string
        }
        Relationships: []
      }
      join_applications: {
        Row: {
          archived: boolean
          availability: string[] | null
          background_check_consent: boolean | null
          created_at: string
          criminal_record: boolean | null
          criminal_record_details: string | null
          cv_url: string | null
          declaration_accepted: boolean | null
          declaration_accepted_at: string | null
          drug_test_consent: boolean | null
          email: string
          emergency_med_interest: string | null
          experience: string | null
          first_name: string | null
          has_transport: boolean | null
          id: string
          landing_path: string | null
          languages: Json | null
          last_name: string | null
          lga_primary: string | null
          lgas_willing_to_commute: string[] | null
          license_expiry: string | null
          license_number: string | null
          license_to_practice: string | null
          licensing_body: string | null
          licensing_body_other: string | null
          lives_in_lagos: boolean | null
          message: string | null
          name: string
          nysc_status: string | null
          person_id: string | null
          phone: string
          qualification: string | null
          qualification_other: string | null
          referrer: string | null
          right_to_work: boolean | null
          role: string
          role_other: string | null
          start_date: string | null
          start_window: string | null
          state: string | null
          status: string
          training_commitment: boolean | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          years_experience: number | null
        }
        Insert: {
          archived?: boolean
          availability?: string[] | null
          background_check_consent?: boolean | null
          created_at?: string
          criminal_record?: boolean | null
          criminal_record_details?: string | null
          cv_url?: string | null
          declaration_accepted?: boolean | null
          declaration_accepted_at?: string | null
          drug_test_consent?: boolean | null
          email: string
          emergency_med_interest?: string | null
          experience?: string | null
          first_name?: string | null
          has_transport?: boolean | null
          id?: string
          landing_path?: string | null
          languages?: Json | null
          last_name?: string | null
          lga_primary?: string | null
          lgas_willing_to_commute?: string[] | null
          license_expiry?: string | null
          license_number?: string | null
          license_to_practice?: string | null
          licensing_body?: string | null
          licensing_body_other?: string | null
          lives_in_lagos?: boolean | null
          message?: string | null
          name: string
          nysc_status?: string | null
          person_id?: string | null
          phone: string
          qualification?: string | null
          qualification_other?: string | null
          referrer?: string | null
          right_to_work?: boolean | null
          role: string
          role_other?: string | null
          start_date?: string | null
          start_window?: string | null
          state?: string | null
          status?: string
          training_commitment?: boolean | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          years_experience?: number | null
        }
        Update: {
          archived?: boolean
          availability?: string[] | null
          background_check_consent?: boolean | null
          created_at?: string
          criminal_record?: boolean | null
          criminal_record_details?: string | null
          cv_url?: string | null
          declaration_accepted?: boolean | null
          declaration_accepted_at?: string | null
          drug_test_consent?: boolean | null
          email?: string
          emergency_med_interest?: string | null
          experience?: string | null
          first_name?: string | null
          has_transport?: boolean | null
          id?: string
          landing_path?: string | null
          languages?: Json | null
          last_name?: string | null
          lga_primary?: string | null
          lgas_willing_to_commute?: string[] | null
          license_expiry?: string | null
          license_number?: string | null
          license_to_practice?: string | null
          licensing_body?: string | null
          licensing_body_other?: string | null
          lives_in_lagos?: boolean | null
          message?: string | null
          name?: string
          nysc_status?: string | null
          person_id?: string | null
          phone?: string
          qualification?: string | null
          qualification_other?: string | null
          referrer?: string | null
          right_to_work?: boolean | null
          role?: string
          role_other?: string | null
          start_date?: string | null
          start_window?: string | null
          state?: string | null
          status?: string
          training_commitment?: boolean | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "join_applications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_applications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      matchmaker_applications: {
        Row: {
          admin_notes: string | null
          cover_note: string | null
          created_at: string
          current_position: string | null
          documents: Json
          email: string
          full_name: string
          id: string
          landing_path: string | null
          opportunity_id: string
          person_id: string | null
          phone: string | null
          question_answers: Json
          referrer: string | null
          requirement_answers: Json
          stage: string
          stage_at: string
          stage_by: string | null
          stage_note: string | null
          status: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          years_experience: number | null
        }
        Insert: {
          admin_notes?: string | null
          cover_note?: string | null
          created_at?: string
          current_position?: string | null
          documents?: Json
          email: string
          full_name: string
          id?: string
          landing_path?: string | null
          opportunity_id: string
          person_id?: string | null
          phone?: string | null
          question_answers?: Json
          referrer?: string | null
          requirement_answers?: Json
          stage?: string
          stage_at?: string
          stage_by?: string | null
          stage_note?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          years_experience?: number | null
        }
        Update: {
          admin_notes?: string | null
          cover_note?: string | null
          created_at?: string
          current_position?: string | null
          documents?: Json
          email?: string
          full_name?: string
          id?: string
          landing_path?: string | null
          opportunity_id?: string
          person_id?: string | null
          phone?: string | null
          question_answers?: Json
          referrer?: string | null
          requirement_answers?: Json
          stage?: string
          stage_at?: string
          stage_by?: string | null
          stage_note?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matchmaker_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaker_applications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaker_applications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      matchmaker_email_log: {
        Row: {
          application_id: string
          booking_link: string | null
          created_at: string
          email_type: string
          error: string | null
          id: string
          opportunity_id: string | null
          recipient_email: string
          sent_by: string | null
          sent_by_name: string | null
          status: string
          subject: string | null
        }
        Insert: {
          application_id: string
          booking_link?: string | null
          created_at?: string
          email_type: string
          error?: string | null
          id?: string
          opportunity_id?: string | null
          recipient_email: string
          sent_by?: string | null
          sent_by_name?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          application_id?: string
          booking_link?: string | null
          created_at?: string
          email_type?: string
          error?: string | null
          id?: string
          opportunity_id?: string | null
          recipient_email?: string
          sent_by?: string | null
          sent_by_name?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchmaker_email_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaker_opportunities: {
        Row: {
          audience_group_id: string | null
          availability_from: string | null
          availability_to: string | null
          brief: string | null
          client_notes: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          criteria_edited_by_admin: boolean
          deleted_at: string | null
          description: string | null
          document_fields: Json
          id: string
          kind: string
          last_match_count: number | null
          last_matched_at: string | null
          link_target: string
          location: string | null
          match_care_types: string[]
          match_lgas: string[]
          match_live_in: string
          match_min_years: number | null
          match_professions: string[]
          match_requires_licence: boolean
          match_requires_right_to_work: boolean
          match_shift_patterns: string[]
          match_states: string[]
          min_availability_evidence: string
          min_licence_evidence: string
          min_right_to_work_evidence: string
          questions: Json
          request_status: string
          requirements: string | null
          requirements_model: string | null
          requirements_parsed_at: string | null
          role_details: string | null
          slug: string
          standard_fields: Json
          start_asap: boolean
          start_date: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience_group_id?: string | null
          availability_from?: string | null
          availability_to?: string | null
          brief?: string | null
          client_notes?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          criteria_edited_by_admin?: boolean
          deleted_at?: string | null
          description?: string | null
          document_fields?: Json
          id?: string
          kind?: string
          last_match_count?: number | null
          last_matched_at?: string | null
          link_target?: string
          location?: string | null
          match_care_types?: string[]
          match_lgas?: string[]
          match_live_in?: string
          match_min_years?: number | null
          match_professions?: string[]
          match_requires_licence?: boolean
          match_requires_right_to_work?: boolean
          match_shift_patterns?: string[]
          match_states?: string[]
          min_availability_evidence?: string
          min_licence_evidence?: string
          min_right_to_work_evidence?: string
          questions?: Json
          request_status?: string
          requirements?: string | null
          requirements_model?: string | null
          requirements_parsed_at?: string | null
          role_details?: string | null
          slug: string
          standard_fields?: Json
          start_asap?: boolean
          start_date?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience_group_id?: string | null
          availability_from?: string | null
          availability_to?: string | null
          brief?: string | null
          client_notes?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          criteria_edited_by_admin?: boolean
          deleted_at?: string | null
          description?: string | null
          document_fields?: Json
          id?: string
          kind?: string
          last_match_count?: number | null
          last_matched_at?: string | null
          link_target?: string
          location?: string | null
          match_care_types?: string[]
          match_lgas?: string[]
          match_live_in?: string
          match_min_years?: number | null
          match_professions?: string[]
          match_requires_licence?: boolean
          match_requires_right_to_work?: boolean
          match_shift_patterns?: string[]
          match_states?: string[]
          min_availability_evidence?: string
          min_licence_evidence?: string
          min_right_to_work_evidence?: string
          questions?: Json
          request_status?: string
          requirements?: string | null
          requirements_model?: string | null
          requirements_parsed_at?: string | null
          role_details?: string | null
          slug?: string
          standard_fields?: Json
          start_asap?: boolean
          start_date?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaker_opportunities_audience_group_id_fkey"
            columns: ["audience_group_id"]
            isOneToOne: false
            referencedRelation: "audience_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaker_opportunity_facets: {
        Row: {
          code: string
          created_at: string
          facet_type: string
          id: string
          opportunity_id: string
          requirement: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          facet_type: string
          id?: string
          opportunity_id: string
          requirement?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          facet_type?: string
          id?: string
          opportunity_id?: string
          requirement?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaker_opportunity_facets_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaker_question_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          questions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          questions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          questions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      matchmaker_share_events: {
        Row: {
          channel: string
          created_at: string
          id: string
          opportunity_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          opportunity_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          opportunity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchmaker_share_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_audit_findings: {
        Row: {
          check_key: string
          created_at: string
          dashboard_value: number | null
          delta: number | null
          detail: Json
          id: string
          metric: string
          note: string
          run_id: string
          scope: string
          scope_id: string | null
          severity: string
          source_value: number | null
        }
        Insert: {
          check_key: string
          created_at?: string
          dashboard_value?: number | null
          delta?: number | null
          detail?: Json
          id?: string
          metric: string
          note?: string
          run_id: string
          scope?: string
          scope_id?: string | null
          severity?: string
          source_value?: number | null
        }
        Update: {
          check_key?: string
          created_at?: string
          dashboard_value?: number | null
          delta?: number | null
          detail?: Json
          id?: string
          metric?: string
          note?: string
          run_id?: string
          scope?: string
          scope_id?: string | null
          severity?: string
          source_value?: number | null
        }
        Relationships: []
      }
      mu_activity: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          detail: Json
          id: string
          person_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json
          id?: string
          person_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: Json
          id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_activity_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_activity_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_availability_days: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          person_id: string
          slot_date: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          person_id: string
          slot_date: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          person_id?: string
          slot_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_availability_days_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_availability_days_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_availability_recurrence: {
        Row: {
          active: boolean
          blocks: Json
          created_at: string
          id: string
          person_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          blocks?: Json
          created_at?: string
          id?: string
          person_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          blocks?: Json
          created_at?: string
          id?: string
          person_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "mu_availability_recurrence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_availability_recurrence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_awards: {
        Row: {
          active: boolean
          code: string
          created_at: string
          is_clinical: boolean
          level: string | null
          profession: string | null
          seniority: string | null
          title: string
          updated_at: string
          variants: string[]
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          is_clinical?: boolean
          level?: string | null
          profession?: string | null
          seniority?: string | null
          title: string
          updated_at?: string
          variants?: string[]
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          is_clinical?: boolean
          level?: string | null
          profession?: string | null
          seniority?: string | null
          title?: string
          updated_at?: string
          variants?: string[]
        }
        Relationships: []
      }
      mu_capabilities: {
        Row: {
          capability: string
          granted_at: string
          granted_by: string | null
          id: string
          person_id: string
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          capability: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          person_id: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          capability?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          person_id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_capabilities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_capabilities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_contract_annex_library: {
        Row: {
          active: boolean
          body: string
          clinical_only: boolean
          code: string
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          note: string | null
          requires_signature: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          clinical_only?: boolean
          code: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          note?: string | null
          requires_signature?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          clinical_only?: boolean
          code?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          note?: string | null
          requires_signature?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mu_contract_clause_library: {
        Row: {
          active: boolean
          body: string
          created_at: string
          heading: string
          id: string
          key: string
          locked: boolean
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          heading: string
          id?: string
          key: string
          locked?: boolean
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          heading?: string
          id?: string
          key?: string
          locked?: boolean
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mu_contract_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          contract_id: string
          created_at: string
          detail: string | null
          event_type: string
          id: string
          ip: string | null
          payload: Json
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          contract_id: string
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          ip?: string | null
          payload?: Json
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          contract_id?: string
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          payload?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "mu_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      mu_contract_templates: {
        Row: {
          active: boolean
          annexes: Json
          clauses: Json
          contract_type: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          department: string | null
          description: string | null
          field_rules: Json
          fields: Json
          id: string
          is_clinical: boolean
          job_title: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          annexes?: Json
          clauses?: Json
          contract_type?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          department?: string | null
          description?: string | null
          field_rules?: Json
          fields?: Json
          id?: string
          is_clinical?: boolean
          job_title?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          annexes?: Json
          clauses?: Json
          contract_type?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          department?: string | null
          description?: string | null
          field_rules?: Json
          fields?: Json
          id?: string
          is_clinical?: boolean
          job_title?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mu_contracts: {
        Row: {
          annex_acknowledgements: Json
          annex_signatures: Json
          annexes: Json
          clauses: Json
          contract_type: string
          countersignature_image: string | null
          countersigned_at: string | null
          countersigned_by: string | null
          countersigned_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          document_id: string | null
          document_url: string | null
          end_date: string | null
          ended_at: string | null
          fields: Json
          id: string
          is_clinical: boolean
          issued_annexes: Json | null
          issued_at: string | null
          issued_by: string | null
          issued_by_name: string | null
          issued_clauses: Json | null
          issued_fields: Json | null
          issued_hash: string | null
          job_title: string | null
          location: string | null
          notes: string | null
          notice_period: string | null
          offer_id: string | null
          pay_amount: number | null
          pay_currency: string
          pay_frequency: string
          pdf_path: string | null
          person_id: string
          probation_end: string | null
          sign_token: string | null
          signature_image: string | null
          signature_method: string | null
          signed_acknowledged_at: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_name: string | null
          signed_user_agent: string | null
          start_date: string | null
          status: string
          supersedes_id: string | null
          template_id: string | null
          token_expires_at: string | null
          updated_at: string
          withdrawn_at: string | null
          working_pattern: string | null
        }
        Insert: {
          annex_acknowledgements?: Json
          annex_signatures?: Json
          annexes?: Json
          clauses?: Json
          contract_type?: string
          countersignature_image?: string | null
          countersigned_at?: string | null
          countersigned_by?: string | null
          countersigned_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          document_id?: string | null
          document_url?: string | null
          end_date?: string | null
          ended_at?: string | null
          fields?: Json
          id?: string
          is_clinical?: boolean
          issued_annexes?: Json | null
          issued_at?: string | null
          issued_by?: string | null
          issued_by_name?: string | null
          issued_clauses?: Json | null
          issued_fields?: Json | null
          issued_hash?: string | null
          job_title?: string | null
          location?: string | null
          notes?: string | null
          notice_period?: string | null
          offer_id?: string | null
          pay_amount?: number | null
          pay_currency?: string
          pay_frequency?: string
          pdf_path?: string | null
          person_id: string
          probation_end?: string | null
          sign_token?: string | null
          signature_image?: string | null
          signature_method?: string | null
          signed_acknowledged_at?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_user_agent?: string | null
          start_date?: string | null
          status?: string
          supersedes_id?: string | null
          template_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          withdrawn_at?: string | null
          working_pattern?: string | null
        }
        Update: {
          annex_acknowledgements?: Json
          annex_signatures?: Json
          annexes?: Json
          clauses?: Json
          contract_type?: string
          countersignature_image?: string | null
          countersigned_at?: string | null
          countersigned_by?: string | null
          countersigned_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          document_id?: string | null
          document_url?: string | null
          end_date?: string | null
          ended_at?: string | null
          fields?: Json
          id?: string
          is_clinical?: boolean
          issued_annexes?: Json | null
          issued_at?: string | null
          issued_by?: string | null
          issued_by_name?: string | null
          issued_clauses?: Json | null
          issued_fields?: Json | null
          issued_hash?: string | null
          job_title?: string | null
          location?: string | null
          notes?: string | null
          notice_period?: string | null
          offer_id?: string | null
          pay_amount?: number | null
          pay_currency?: string
          pay_frequency?: string
          pdf_path?: string | null
          person_id?: string
          probation_end?: string | null
          sign_token?: string | null
          signature_image?: string | null
          signature_method?: string | null
          signed_acknowledged_at?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_name?: string | null
          signed_user_agent?: string | null
          start_date?: string | null
          status?: string
          supersedes_id?: string | null
          template_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          withdrawn_at?: string | null
          working_pattern?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_contracts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_contracts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "mu_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_contracts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_contracts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "mu_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mu_contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      mu_credentials: {
        Row: {
          claim: string | null
          claim_at: string | null
          claim_source: string | null
          created_at: string
          credential_type: string
          evidence_at: string | null
          evidence_document_id: string | null
          expires_at: string | null
          id: string
          note: string | null
          person_id: string
          reference: string | null
          updated_at: string
          verification_method: string | null
          verification_outcome: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          claim?: string | null
          claim_at?: string | null
          claim_source?: string | null
          created_at?: string
          credential_type: string
          evidence_at?: string | null
          evidence_document_id?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          person_id: string
          reference?: string | null
          updated_at?: string
          verification_method?: string | null
          verification_outcome?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          claim?: string | null
          claim_at?: string | null
          claim_source?: string | null
          created_at?: string
          credential_type?: string
          evidence_at?: string | null
          evidence_document_id?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          person_id?: string
          reference?: string | null
          updated_at?: string
          verification_method?: string | null
          verification_outcome?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_credentials_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_credentials_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_credentials_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_cv_parses: {
        Row: {
          chunks: number
          created_at: string
          document_id: string | null
          document_label: string | null
          error: string | null
          extraction: Json
          fields: Json
          gaps: Json
          id: string
          model: string | null
          not_found: string[]
          person_id: string
          profession: string | null
          quality: Json
          text_chars: number | null
        }
        Insert: {
          chunks?: number
          created_at?: string
          document_id?: string | null
          document_label?: string | null
          error?: string | null
          extraction?: Json
          fields?: Json
          gaps?: Json
          id?: string
          model?: string | null
          not_found?: string[]
          person_id: string
          profession?: string | null
          quality?: Json
          text_chars?: number | null
        }
        Update: {
          chunks?: number
          created_at?: string
          document_id?: string | null
          document_label?: string | null
          error?: string | null
          extraction?: Json
          fields?: Json
          gaps?: Json
          id?: string
          model?: string | null
          not_found?: string[]
          person_id?: string
          profession?: string | null
          quality?: Json
          text_chars?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_cv_parses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_cv_parses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_document_extractions: {
        Row: {
          classification_confidence: number
          classification_evidence: string | null
          classified_by: string
          created_at: string
          doc_type: string
          document_id: string
          error: string | null
          extraction: Json
          id: string
          model: string | null
          not_found: string[]
          person_id: string
          quality: Json
          updated_at: string
        }
        Insert: {
          classification_confidence?: number
          classification_evidence?: string | null
          classified_by?: string
          created_at?: string
          doc_type: string
          document_id: string
          error?: string | null
          extraction?: Json
          id?: string
          model?: string | null
          not_found?: string[]
          person_id: string
          quality?: Json
          updated_at?: string
        }
        Update: {
          classification_confidence?: number
          classification_evidence?: string | null
          classified_by?: string
          created_at?: string
          doc_type?: string
          document_id?: string
          error?: string | null
          extraction?: Json
          id?: string
          model?: string | null
          not_found?: string[]
          person_id?: string
          quality?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_document_extractions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_document_extractions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_document_requests: {
        Row: {
          cancelled_at: string | null
          created_at: string
          doc_type: string
          due_by: string | null
          fulfilled_at: string | null
          fulfilled_document_id: string | null
          id: string
          note: string | null
          person_id: string
          requested_by: string | null
          requested_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          doc_type: string
          due_by?: string | null
          fulfilled_at?: string | null
          fulfilled_document_id?: string | null
          id?: string
          note?: string | null
          person_id: string
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          doc_type?: string
          due_by?: string | null
          fulfilled_at?: string | null
          fulfilled_document_id?: string | null
          id?: string
          note?: string | null
          person_id?: string
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_document_requests_fulfilled_document_id_fkey"
            columns: ["fulfilled_document_id"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_document_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_document_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_document_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          evidences: string[]
          expected_fields: string[]
          expires: boolean
          helper: string | null
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          evidences?: string[]
          expected_fields?: string[]
          expires?: boolean
          helper?: string | null
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          evidences?: string[]
          expected_fields?: string[]
          expires?: boolean
          helper?: string | null
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mu_documents: {
        Row: {
          classified_at: string | null
          conditional_reason: string | null
          conditional_until: string | null
          created_at: string
          doc_kind: string | null
          doc_kind_confidence: number
          doc_kind_evidence: string | null
          doc_kind_source: string
          doc_type: string | null
          expires_at: string | null
          hold_reason: string | null
          id: string
          label: string
          person_id: string
          rejected: boolean
          review_outcome: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          source_note: string | null
          source_table: string
          superseded_at: string | null
          superseded_by: string | null
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
          url: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          classified_at?: string | null
          conditional_reason?: string | null
          conditional_until?: string | null
          created_at?: string
          doc_kind?: string | null
          doc_kind_confidence?: number
          doc_kind_evidence?: string | null
          doc_kind_source?: string
          doc_type?: string | null
          expires_at?: string | null
          hold_reason?: string | null
          id?: string
          label: string
          person_id: string
          rejected?: boolean
          review_outcome?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_note?: string | null
          source_table: string
          superseded_at?: string | null
          superseded_by?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          url: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          classified_at?: string | null
          conditional_reason?: string | null
          conditional_until?: string | null
          created_at?: string
          doc_kind?: string | null
          doc_kind_confidence?: number
          doc_kind_evidence?: string | null
          doc_kind_source?: string
          doc_type?: string | null
          expires_at?: string | null
          hold_reason?: string | null
          id?: string
          label?: string
          person_id?: string
          rejected?: boolean
          review_outcome?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_note?: string | null
          source_table?: string
          superseded_at?: string | null
          superseded_by?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          url?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_documents_doc_kind_fkey"
            columns: ["doc_kind"]
            isOneToOne: false
            referencedRelation: "mu_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "mu_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "mu_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      mu_engagements: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          end_date: string | null
          id: string
          location: string | null
          notes: string | null
          offer_id: string | null
          opportunity_id: string | null
          pattern: string | null
          person_id: string
          rate_note: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          offer_id?: string | null
          opportunity_id?: string | null
          pattern?: string | null
          person_id: string
          rate_note?: string | null
          start_date?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          offer_id?: string | null
          opportunity_id?: string | null
          pattern?: string | null
          person_id?: string
          rate_note?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_engagements_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "mu_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_engagements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_engagements_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_engagements_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_facet_keywords: {
        Row: {
          active: boolean
          code: string
          confidence: number
          created_at: string
          facet_type: string
          id: string
          note: string | null
          pattern: string
          source_field: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          confidence?: number
          created_at?: string
          facet_type: string
          id?: string
          note?: string | null
          pattern: string
          source_field: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          confidence?: number
          created_at?: string
          facet_type?: string
          id?: string
          note?: string | null
          pattern?: string
          source_field?: string
          updated_at?: string
        }
        Relationships: []
      }
      mu_field_conflicts: {
        Row: {
          created_at: string
          field: string
          id: string
          parsed_field_id: string | null
          parsed_value: string | null
          person_id: string
          precedence: string
          status: string
          stored_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          parsed_field_id?: string | null
          parsed_value?: string | null
          person_id: string
          precedence?: string
          status?: string
          stored_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          parsed_field_id?: string | null
          parsed_value?: string | null
          person_id?: string
          precedence?: string
          status?: string
          stored_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_field_conflicts_parsed_field_id_fkey"
            columns: ["parsed_field_id"]
            isOneToOne: false
            referencedRelation: "mu_parsed_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_field_conflicts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_field_conflicts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_institutions: {
        Row: {
          active: boolean
          country: string
          created_at: string
          id: string
          kind: string
          name: string
          state: string | null
          updated_at: string
          variants: string[]
        }
        Insert: {
          active?: boolean
          country?: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          state?: string | null
          updated_at?: string
          variants?: string[]
        }
        Update: {
          active?: boolean
          country?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          state?: string | null
          updated_at?: string
          variants?: string[]
        }
        Relationships: []
      }
      mu_interview_slots: {
        Row: {
          application_id: string
          booked_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          location: string | null
          mode: string
          person_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          booked_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          mode?: string
          person_id: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          booked_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          mode?: string
          person_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_interview_slots_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_interview_slots_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_interview_slots_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_leave_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          decision_note: string | null
          engagement_id: string | null
          from_date: string
          id: string
          person_id: string
          reason: string | null
          status: string
          to_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          engagement_id?: string | null
          from_date: string
          id?: string
          person_id: string
          reason?: string | null
          status?: string
          to_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_note?: string | null
          engagement_id?: string | null
          from_date?: string
          id?: string
          person_id?: string
          reason?: string | null
          status?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_leave_requests_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "mu_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_leave_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_leave_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_lexicon_phrases: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          facet_type: string
          id: string
          phrase: string
          reference_code: string | null
          source: string
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          facet_type: string
          id?: string
          phrase: string
          reference_code?: string | null
          source?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          facet_type?: string
          id?: string
          phrase?: string
          reference_code?: string | null
          source?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      mu_lga_index: {
        Row: {
          created_at: string
          lga: string
          state: string
        }
        Insert: {
          created_at?: string
          lga: string
          state: string
        }
        Update: {
          created_at?: string
          lga?: string
          state?: string
        }
        Relationships: []
      }
      mu_licensing_bodies: {
        Row: {
          active: boolean
          code: string
          country: string
          created_at: string
          issues_registration_certificate: boolean
          licence_expires: boolean
          name: string
          note: string | null
          number_pattern: string | null
          professions: string[]
          updated_at: string
          variants: string[]
        }
        Insert: {
          active?: boolean
          code: string
          country?: string
          created_at?: string
          issues_registration_certificate?: boolean
          licence_expires?: boolean
          name: string
          note?: string | null
          number_pattern?: string | null
          professions?: string[]
          updated_at?: string
          variants?: string[]
        }
        Update: {
          active?: boolean
          code?: string
          country?: string
          created_at?: string
          issues_registration_certificate?: boolean
          licence_expires?: boolean
          name?: string
          note?: string | null
          number_pattern?: string | null
          professions?: string[]
          updated_at?: string
          variants?: string[]
        }
        Relationships: []
      }
      mu_match_rationales: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          model: string | null
          opportunity_id: string
          person_id: string
          rationale: string
          updated_at: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          model?: string | null
          opportunity_id: string
          person_id: string
          rationale: string
          updated_at?: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          model?: string | null
          opportunity_id?: string
          person_id?: string
          rationale?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_match_rationales_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_match_rationales_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_match_rationales_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_match_weights: {
        Row: {
          key: string
          label: string
          updated_at: string
          weight: number
        }
        Insert: {
          key: string
          label?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          key?: string
          label?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      mu_merge_candidates: {
        Row: {
          created_at: string
          id: string
          person_a: string
          person_b: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          score: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          person_a: string
          person_b: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          person_a?: string
          person_b?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_merge_candidates_person_a_fkey"
            columns: ["person_a"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_merge_candidates_person_a_fkey"
            columns: ["person_a"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "mu_merge_candidates_person_b_fkey"
            columns: ["person_b"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_merge_candidates_person_b_fkey"
            columns: ["person_b"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_offer_shifts: {
        Row: {
          created_at: string
          end_hour: number
          id: string
          location: string | null
          offer_id: string
          slot_date: string
          start_hour: number
        }
        Insert: {
          created_at?: string
          end_hour?: number
          id?: string
          location?: string | null
          offer_id: string
          slot_date: string
          start_hour?: number
        }
        Update: {
          created_at?: string
          end_hour?: number
          id?: string
          location?: string | null
          offer_id?: string
          slot_date?: string
          start_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "mu_offer_shifts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "mu_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      mu_offers: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          decline_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          engagement_type: string | null
          expires_at: string | null
          id: string
          kind: string
          location: string | null
          message: string | null
          opportunity_id: string | null
          parent_offer_id: string | null
          pattern: string | null
          person_id: string
          rate_note: string | null
          responded_at: string | null
          sent_at: string | null
          start_date: string | null
          status: string
          terms: Json
          title: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          decline_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          engagement_type?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          message?: string | null
          opportunity_id?: string | null
          parent_offer_id?: string | null
          pattern?: string | null
          person_id: string
          rate_note?: string | null
          responded_at?: string | null
          sent_at?: string | null
          start_date?: string | null
          status?: string
          terms?: Json
          title: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          decline_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          engagement_type?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          message?: string | null
          opportunity_id?: string | null
          parent_offer_id?: string | null
          pattern?: string | null
          person_id?: string
          rate_note?: string | null
          responded_at?: string | null
          sent_at?: string | null
          start_date?: string | null
          status?: string
          terms?: Json
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_offers_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "mu_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_offers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_offers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_parsed_fields: {
        Row: {
          confidence: number
          created_at: string
          document_id: string | null
          evidence: string | null
          field: string
          id: string
          model: string | null
          note: string | null
          person_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          value: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          document_id?: string | null
          evidence?: string | null
          field: string
          id?: string
          model?: string | null
          note?: string | null
          person_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          document_id?: string | null
          evidence?: string | null
          field?: string
          id?: string
          model?: string | null
          note?: string | null
          person_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_parsed_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_parsed_fields_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_parsed_fields_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_people: {
        Row: {
          address_area: string | null
          address_captured_at: string | null
          address_landmark: string | null
          address_line: string | null
          address_source: string | null
          admin_notes: string | null
          auth_user_id: string | null
          availability: Json
          candidate_gaps: Json
          claimed_at: string | null
          contact_verified_at: string | null
          course_of_study: string | null
          created_at: string
          current_position: string | null
          department: string | null
          email: string | null
          email_key: string | null
          employment_type: string | null
          expected_graduation: string | null
          full_name: string
          id: string
          institution: string | null
          invited_at: string | null
          is_staff: boolean
          job_title: string | null
          joining_statement: string | null
          languages: Json
          last_activity_at: string
          last_availability_update: string | null
          lga: string | null
          licence_status: string
          license_expiry: string | null
          license_number: string | null
          licensing_body: string | null
          lifecycle_state: string | null
          location_source: string | null
          looking_status: string
          nysc_status: string | null
          parse_attempts: number
          parse_document_id: string | null
          parse_last_attempt_at: string | null
          parse_status: string
          parsed_at: string | null
          phone: string | null
          phone_key: string | null
          profession: string | null
          profession_confidence: number | null
          profession_source: string | null
          promotion_provenance: Json
          reports_to: string | null
          right_to_work: boolean | null
          right_to_work_status: string
          sex: string | null
          staff_end_date: string | null
          staff_start_date: string | null
          staff_status: string
          state: string | null
          status: string
          study_level: string | null
          track: string | null
          track_confirmed_at: string | null
          track_source: string | null
          updated_at: string
          verification_state: string
          work_email: string | null
          year_of_study: string | null
          years_experience: number | null
        }
        Insert: {
          address_area?: string | null
          address_captured_at?: string | null
          address_landmark?: string | null
          address_line?: string | null
          address_source?: string | null
          admin_notes?: string | null
          auth_user_id?: string | null
          availability?: Json
          candidate_gaps?: Json
          claimed_at?: string | null
          contact_verified_at?: string | null
          course_of_study?: string | null
          created_at?: string
          current_position?: string | null
          department?: string | null
          email?: string | null
          email_key?: string | null
          employment_type?: string | null
          expected_graduation?: string | null
          full_name?: string
          id?: string
          institution?: string | null
          invited_at?: string | null
          is_staff?: boolean
          job_title?: string | null
          joining_statement?: string | null
          languages?: Json
          last_activity_at?: string
          last_availability_update?: string | null
          lga?: string | null
          licence_status?: string
          license_expiry?: string | null
          license_number?: string | null
          licensing_body?: string | null
          lifecycle_state?: string | null
          location_source?: string | null
          looking_status?: string
          nysc_status?: string | null
          parse_attempts?: number
          parse_document_id?: string | null
          parse_last_attempt_at?: string | null
          parse_status?: string
          parsed_at?: string | null
          phone?: string | null
          phone_key?: string | null
          profession?: string | null
          profession_confidence?: number | null
          profession_source?: string | null
          promotion_provenance?: Json
          reports_to?: string | null
          right_to_work?: boolean | null
          right_to_work_status?: string
          sex?: string | null
          staff_end_date?: string | null
          staff_start_date?: string | null
          staff_status?: string
          state?: string | null
          status?: string
          study_level?: string | null
          track?: string | null
          track_confirmed_at?: string | null
          track_source?: string | null
          updated_at?: string
          verification_state?: string
          work_email?: string | null
          year_of_study?: string | null
          years_experience?: number | null
        }
        Update: {
          address_area?: string | null
          address_captured_at?: string | null
          address_landmark?: string | null
          address_line?: string | null
          address_source?: string | null
          admin_notes?: string | null
          auth_user_id?: string | null
          availability?: Json
          candidate_gaps?: Json
          claimed_at?: string | null
          contact_verified_at?: string | null
          course_of_study?: string | null
          created_at?: string
          current_position?: string | null
          department?: string | null
          email?: string | null
          email_key?: string | null
          employment_type?: string | null
          expected_graduation?: string | null
          full_name?: string
          id?: string
          institution?: string | null
          invited_at?: string | null
          is_staff?: boolean
          job_title?: string | null
          joining_statement?: string | null
          languages?: Json
          last_activity_at?: string
          last_availability_update?: string | null
          lga?: string | null
          licence_status?: string
          license_expiry?: string | null
          license_number?: string | null
          licensing_body?: string | null
          lifecycle_state?: string | null
          location_source?: string | null
          looking_status?: string
          nysc_status?: string | null
          parse_attempts?: number
          parse_document_id?: string | null
          parse_last_attempt_at?: string | null
          parse_status?: string
          parsed_at?: string | null
          phone?: string | null
          phone_key?: string | null
          profession?: string | null
          profession_confidence?: number | null
          profession_source?: string | null
          promotion_provenance?: Json
          reports_to?: string | null
          right_to_work?: boolean | null
          right_to_work_status?: string
          sex?: string | null
          staff_end_date?: string | null
          staff_start_date?: string | null
          staff_status?: string
          state?: string | null
          status?: string
          study_level?: string | null
          track?: string | null
          track_confirmed_at?: string | null
          track_source?: string | null
          updated_at?: string
          verification_state?: string
          work_email?: string | null
          year_of_study?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      mu_profile_facets: {
        Row: {
          code: string
          confidence: number
          created_at: string
          document_id: string | null
          evidence: string | null
          facet_type: string
          id: string
          model: string | null
          person_id: string
          source: string
          updated_at: string
        }
        Insert: {
          code: string
          confidence?: number
          created_at?: string
          document_id?: string | null
          evidence?: string | null
          facet_type: string
          id?: string
          model?: string | null
          person_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          code?: string
          confidence?: number
          created_at?: string
          document_id?: string | null
          evidence?: string | null
          facet_type?: string
          id?: string
          model?: string | null
          person_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_profile_facets_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_profile_facets_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_profile_facets_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_references: {
        Row: {
          created_at: string
          email: string | null
          id: string
          job_title: string | null
          note: string | null
          organisation: string | null
          person_id: string
          phone: string | null
          referee_name: string
          relationship: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          job_title?: string | null
          note?: string | null
          organisation?: string | null
          person_id: string
          phone?: string | null
          referee_name: string
          relationship?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          job_title?: string | null
          note?: string | null
          organisation?: string | null
          person_id?: string
          phone?: string | null
          referee_name?: string
          relationship?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_references_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_references_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_required_documents: {
        Row: {
          active: boolean
          created_at: string
          doc_type: string
          exempt_tracks: string[]
          helper: string | null
          label: string
          rule: string
          sort_order: number
          track_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          doc_type: string
          exempt_tracks?: string[]
          helper?: string | null
          label: string
          rule?: string
          sort_order?: number
          track_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          doc_type?: string
          exempt_tracks?: string[]
          helper?: string | null
          label?: string
          rule?: string
          sort_order?: number
          track_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mu_role_requirements: {
        Row: {
          active: boolean
          created_at: string
          expects_licence: boolean
          label: string
          min_references: number
          needs_availability: boolean
          needs_institution: boolean
          needs_nysc: boolean
          needs_preferences: boolean
          needs_right_to_work: boolean
          pattern: string | null
          role_key: string
          sort_order: number
          track_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expects_licence?: boolean
          label: string
          min_references?: number
          needs_availability?: boolean
          needs_institution?: boolean
          needs_nysc?: boolean
          needs_preferences?: boolean
          needs_right_to_work?: boolean
          pattern?: string | null
          role_key: string
          sort_order?: number
          track_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expects_licence?: boolean
          label?: string
          min_references?: number
          needs_availability?: boolean
          needs_institution?: boolean
          needs_nysc?: boolean
          needs_preferences?: boolean
          needs_right_to_work?: boolean
          pattern?: string | null
          role_key?: string
          sort_order?: number
          track_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mu_shortlists: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          breakdown: Json
          created_at: string
          id: string
          note: string | null
          opportunity_id: string
          person_id: string
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          breakdown?: Json
          created_at?: string
          id?: string
          note?: string | null
          opportunity_id: string
          person_id: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          breakdown?: Json
          created_at?: string
          id?: string
          note?: string | null
          opportunity_id?: string
          person_id?: string
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_shortlists_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "matchmaker_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_shortlists_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_shortlists_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_staff_emergency_contacts: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_next_of_kin: boolean
          name: string
          person_id: string
          phone: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_next_of_kin?: boolean
          name: string
          person_id: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_next_of_kin?: boolean
          name?: string
          person_id?: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mu_staff_emergency_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_staff_emergency_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_training_catalogue: {
        Row: {
          active: boolean
          code: string
          created_at: string
          name: string
          skill_facets: string[]
          specialty_facets: string[]
          standard: string | null
          updated_at: string
          usual_issuer: string | null
          validity_months: number | null
          variants: string[]
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          name: string
          skill_facets?: string[]
          specialty_facets?: string[]
          standard?: string | null
          updated_at?: string
          usual_issuer?: string | null
          validity_months?: number | null
          variants?: string[]
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          name?: string
          skill_facets?: string[]
          specialty_facets?: string[]
          standard?: string | null
          updated_at?: string
          usual_issuer?: string | null
          validity_months?: number | null
          variants?: string[]
        }
        Relationships: []
      }
      mu_verifications: {
        Row: {
          attempts: number
          auth_user_id: string
          channel: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          destination: string
          expires_at: string
          id: string
          person_id: string | null
        }
        Insert: {
          attempts?: number
          auth_user_id: string
          channel?: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          destination: string
          expires_at: string
          id?: string
          person_id?: string | null
        }
        Update: {
          attempts?: number
          auth_user_id?: string
          channel?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          destination?: string
          expires_at?: string
          id?: string
          person_id?: string | null
        }
        Relationships: []
      }
      mu_work_preferences: {
        Row: {
          care_types: string[]
          client_religion: string
          client_sex: string
          contract_types: string[]
          created_at: string
          deal_breakers: string | null
          employer_types: string[]
          engagement_types: string[]
          function_areas: string[]
          live_in: string
          max_travel_minutes: number | null
          notes: string | null
          notice_period: string | null
          person_id: string
          pets: string
          placement_types: string[]
          religion: string | null
          roles_wanted: string[]
          roles_wanted_other: string | null
          salary_band: string | null
          shift_patterns: string[]
          smoking_household: string
          travel_lgas: string[]
          travel_states: string[]
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
          willing_to_relocate: boolean | null
          work_setting: string | null
        }
        Insert: {
          care_types?: string[]
          client_religion?: string
          client_sex?: string
          contract_types?: string[]
          created_at?: string
          deal_breakers?: string | null
          employer_types?: string[]
          engagement_types?: string[]
          function_areas?: string[]
          live_in?: string
          max_travel_minutes?: number | null
          notes?: string | null
          notice_period?: string | null
          person_id: string
          pets?: string
          placement_types?: string[]
          religion?: string | null
          roles_wanted?: string[]
          roles_wanted_other?: string | null
          salary_band?: string | null
          shift_patterns?: string[]
          smoking_household?: string
          travel_lgas?: string[]
          travel_states?: string[]
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          willing_to_relocate?: boolean | null
          work_setting?: string | null
        }
        Update: {
          care_types?: string[]
          client_religion?: string
          client_sex?: string
          contract_types?: string[]
          created_at?: string
          deal_breakers?: string | null
          employer_types?: string[]
          engagement_types?: string[]
          function_areas?: string[]
          live_in?: string
          max_travel_minutes?: number | null
          notes?: string | null
          notice_period?: string | null
          person_id?: string
          pets?: string
          placement_types?: string[]
          religion?: string | null
          roles_wanted?: string[]
          roles_wanted_other?: string | null
          salary_band?: string | null
          shift_patterns?: string[]
          smoking_household?: string
          travel_lgas?: string[]
          travel_states?: string[]
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          willing_to_relocate?: boolean | null
          work_setting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_work_preferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_work_preferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_kobo: number
          archived: boolean
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          id: string
          items: Json
          paystack_data: Json | null
          reference: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          archived?: boolean
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          items?: Json
          paystack_data?: Json | null
          reference: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          archived?: boolean
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          items?: Json
          paystack_data?: Json | null
          reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      paystack_invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          position: number
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          position?: number
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          position?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "paystack_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "paystack_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      paystack_invoices: {
        Row: {
          amount_paid: number
          client_email: string
          client_first_name: string | null
          client_id: string | null
          client_last_name: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          hosted_link: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          notes: string | null
          offline_reference: string | null
          paid_at: string | null
          paystack_id: number | null
          quote_version_id: string | null
          recipient_contact_id: string | null
          request_code: string | null
          sent_at: string | null
          status: string
          subtotal: number
          total: number
          type: string
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          amount_paid?: number
          client_email: string
          client_first_name?: string | null
          client_id?: string | null
          client_last_name?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          hosted_link?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          notes?: string | null
          offline_reference?: string | null
          paid_at?: string | null
          paystack_id?: number | null
          quote_version_id?: string | null
          recipient_contact_id?: string | null
          request_code?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          type?: string
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          amount_paid?: number
          client_email?: string
          client_first_name?: string | null
          client_id?: string | null
          client_last_name?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          hosted_link?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          notes?: string | null
          offline_reference?: string | null
          paid_at?: string | null
          paystack_id?: number | null
          quote_version_id?: string | null
          recipient_contact_id?: string | null
          request_code?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          type?: string
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "paystack_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paystack_invoices_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: false
            referencedRelation: "care_quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paystack_invoices_recipient_contact_id_fkey"
            columns: ["recipient_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      seo_claims: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          claim_code: string
          claim_text: string
          claim_type: string
          clinical_reviewed_at: string | null
          clinical_reviewed_by: string | null
          created_at: string
          evidence_as_of: string | null
          evidence_reference: string | null
          evidence_type: string | null
          evidence_url: string | null
          id: string
          requires_clinical_review: boolean
          risk_level: string
          state: string
          structured_value: Json
          subject_id: string | null
          subject_type: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          claim_code: string
          claim_text: string
          claim_type: string
          clinical_reviewed_at?: string | null
          clinical_reviewed_by?: string | null
          created_at?: string
          evidence_as_of?: string | null
          evidence_reference?: string | null
          evidence_type?: string | null
          evidence_url?: string | null
          id?: string
          requires_clinical_review?: boolean
          risk_level?: string
          state?: string
          structured_value?: Json
          subject_id?: string | null
          subject_type?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          claim_code?: string
          claim_text?: string
          claim_type?: string
          clinical_reviewed_at?: string | null
          clinical_reviewed_by?: string | null
          created_at?: string
          evidence_as_of?: string | null
          evidence_reference?: string | null
          evidence_type?: string | null
          evidence_url?: string | null
          id?: string
          requires_clinical_review?: boolean
          risk_level?: string
          state?: string
          structured_value?: Json
          subject_id?: string | null
          subject_type?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      seo_fee_refs: {
        Row: {
          created_at: string
          id: string
          module_id: string | null
          page_id: string | null
          service_fee_id: string
          usage_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id?: string | null
          page_id?: string | null
          service_fee_id: string
          usage_key?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string | null
          page_id?: string | null
          service_fee_id?: string
          usage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_fee_refs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "seo_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_fee_refs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_indexable_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_fee_refs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_fee_refs_service_fee_id_fkey"
            columns: ["service_fee_id"]
            isOneToOne: false
            referencedRelation: "service_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_markets: {
        Row: {
          city_name: string | null
          country_code: string
          created_at: string
          demand_state: string
          evidence_as_of: string | null
          id: string
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          lga_name: string | null
          market_key: string
          market_state: string
          notes: string | null
          safety_state: string
          state_name: string | null
          updated_at: string
        }
        Insert: {
          city_name?: string | null
          country_code?: string
          created_at?: string
          demand_state?: string
          evidence_as_of?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          lga_name?: string | null
          market_key: string
          market_state?: string
          notes?: string | null
          safety_state?: string
          state_name?: string | null
          updated_at?: string
        }
        Update: {
          city_name?: string | null
          country_code?: string
          created_at?: string
          demand_state?: string
          evidence_as_of?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          lga_name?: string | null
          market_key?: string
          market_state?: string
          notes?: string | null
          safety_state?: string
          state_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_module_revisions: {
        Row: {
          change_note: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          review_state: string
          summary: string | null
          version: number
        }
        Insert: {
          change_note: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          review_state: string
          summary?: string | null
          version: number
        }
        Update: {
          change_note?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          review_state?: string
          summary?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_module_revisions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "seo_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_modules: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clinical_reviewed_at: string | null
          clinical_reviewed_by: string | null
          content: Json
          created_at: string
          effective_from: string | null
          id: string
          module_code: string
          module_type: string
          name: string
          owner_domain: string | null
          requires_clinical_review: boolean
          review_due_at: string | null
          review_state: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clinical_reviewed_at?: string | null
          clinical_reviewed_by?: string | null
          content?: Json
          created_at?: string
          effective_from?: string | null
          id?: string
          module_code: string
          module_type: string
          name: string
          owner_domain?: string | null
          requires_clinical_review?: boolean
          review_due_at?: string | null
          review_state?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clinical_reviewed_at?: string | null
          clinical_reviewed_by?: string | null
          content?: Json
          created_at?: string
          effective_from?: string | null
          id?: string
          module_code?: string
          module_type?: string
          name?: string
          owner_domain?: string | null
          requires_clinical_review?: boolean
          review_due_at?: string | null
          review_state?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_page_claims: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          page_id: string
          required: boolean
          usage_key: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          page_id: string
          required?: boolean
          usage_key: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          page_id?: string
          required?: boolean
          usage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_claims_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "seo_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_claims_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_indexable_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_claims_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_page_markets: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          local_evidence: Json
          market_id: string
          page_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          local_evidence?: Json
          market_id: string
          page_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          local_evidence?: Json
          market_id?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_markets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "seo_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_markets_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_indexable_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_markets_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_page_modules: {
        Row: {
          created_at: string
          id: string
          local_context: Json
          module_id: string
          page_id: string
          required: boolean
          section_key: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          local_context?: Json
          module_id: string
          page_id: string
          required?: boolean
          section_key: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          local_context?: Json
          module_id?: string
          page_id?: string
          required?: boolean
          section_key?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "seo_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_modules_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_indexable_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_modules_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_page_services: {
        Row: {
          created_at: string
          id: string
          page_id: string
          relationship: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_id: string
          relationship?: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_id?: string
          relationship?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_services_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_indexable_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_services_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_pages: {
        Row: {
          audience: string[]
          canonical_path: string | null
          clinical_requirement: string | null
          clinical_review_required: boolean
          clinical_reviewed_at: string | null
          clinical_reviewed_by: string | null
          created_at: string
          estate: string
          evidence_state: string
          factual_reviewed_at: string | null
          factual_reviewed_by: string | null
          h1: string | null
          id: string
          index_state: string
          last_published_at: string | null
          meta_description: string | null
          notes: string | null
          page_key: string
          page_promise: string | null
          page_type: string
          path: string
          primary_cta_code: string | null
          primary_query: string | null
          priority: number | null
          publication_state: string
          schema_types: string[]
          search_intent: string | null
          secondary_cta_code: string | null
          secondary_queries: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          audience?: string[]
          canonical_path?: string | null
          clinical_requirement?: string | null
          clinical_review_required?: boolean
          clinical_reviewed_at?: string | null
          clinical_reviewed_by?: string | null
          created_at?: string
          estate: string
          evidence_state?: string
          factual_reviewed_at?: string | null
          factual_reviewed_by?: string | null
          h1?: string | null
          id?: string
          index_state?: string
          last_published_at?: string | null
          meta_description?: string | null
          notes?: string | null
          page_key: string
          page_promise?: string | null
          page_type: string
          path: string
          primary_cta_code?: string | null
          primary_query?: string | null
          priority?: number | null
          publication_state?: string
          schema_types?: string[]
          search_intent?: string | null
          secondary_cta_code?: string | null
          secondary_queries?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string[]
          canonical_path?: string | null
          clinical_requirement?: string | null
          clinical_review_required?: boolean
          clinical_reviewed_at?: string | null
          clinical_reviewed_by?: string | null
          created_at?: string
          estate?: string
          evidence_state?: string
          factual_reviewed_at?: string | null
          factual_reviewed_by?: string | null
          h1?: string | null
          id?: string
          index_state?: string
          last_published_at?: string | null
          meta_description?: string | null
          notes?: string | null
          page_key?: string
          page_promise?: string | null
          page_type?: string
          path?: string
          primary_cta_code?: string | null
          primary_query?: string | null
          priority?: number | null
          publication_state?: string
          schema_types?: string[]
          search_intent?: string | null
          secondary_cta_code?: string | null
          secondary_queries?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_fees: {
        Row: {
          amount_naira: number | null
          billing_unit: string | null
          created_at: string
          effective_from: string | null
          fee_type: string
          id: string
          is_current: boolean
          label: string | null
          notes: string | null
          price_treatment: string
          public_label: string | null
          public_visibility: string
          service_id: string
          sku: string | null
          state: string
          updated_at: string
        }
        Insert: {
          amount_naira?: number | null
          billing_unit?: string | null
          created_at?: string
          effective_from?: string | null
          fee_type: string
          id?: string
          is_current?: boolean
          label?: string | null
          notes?: string | null
          price_treatment?: string
          public_label?: string | null
          public_visibility?: string
          service_id: string
          sku?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          amount_naira?: number | null
          billing_unit?: string | null
          created_at?: string
          effective_from?: string | null
          fee_type?: string
          id?: string
          is_current?: boolean
          label?: string | null
          notes?: string | null
          price_treatment?: string
          public_label?: string | null
          public_visibility?: string
          service_id?: string
          sku?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_fees_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          always_modules: string[]
          client_facing: boolean
          client_group: string | null
          client_groups: string[]
          conditional_modules: string[]
          created_at: string
          id: string
          is_offered: boolean
          name: string
          notes: string | null
          questionnaire_section: string | null
          slug: string
          sort_order: number
          takes_pre_assessment: boolean
          updated_at: string
        }
        Insert: {
          always_modules?: string[]
          client_facing?: boolean
          client_group?: string | null
          client_groups?: string[]
          conditional_modules?: string[]
          created_at?: string
          id?: string
          is_offered?: boolean
          name: string
          notes?: string | null
          questionnaire_section?: string | null
          slug: string
          sort_order?: number
          takes_pre_assessment?: boolean
          updated_at?: string
        }
        Update: {
          always_modules?: string[]
          client_facing?: boolean
          client_group?: string | null
          client_groups?: string[]
          conditional_modules?: string[]
          created_at?: string
          id?: string
          is_offered?: boolean
          name?: string
          notes?: string | null
          questionnaire_section?: string | null
          slug?: string
          sort_order?: number
          takes_pre_assessment?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      signup_failures: {
        Row: {
          created_at: string
          detail: string | null
          email: string | null
          id: string
          reason: string
          track: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          email?: string | null
          id?: string
          reason: string
          track?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          email?: string | null
          id?: string
          reason?: string
          track?: string | null
        }
        Relationships: []
      }
      syn_results: {
        Row: {
          name: string | null
          note: string | null
          pass: boolean | null
          seq: number
        }
        Insert: {
          name?: string | null
          note?: string | null
          pass?: boolean | null
          seq?: number
        }
        Update: {
          name?: string | null
          note?: string | null
          pass?: boolean | null
          seq?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      care_client_next_action: {
        Row: {
          assignee_user_id: string | null
          client_id: string | null
          due_at: string | null
          is_blocker: boolean | null
          kind: string | null
          priority: string | null
          rank_order: number | null
          rank_reason: string | null
          status: string | null
          team: string | null
          title: string | null
          work_id: string | null
        }
        Relationships: []
      }
      care_controlled_value_review: {
        Row: {
          code: string | null
          field: string | null
          original_value: string | null
          record_id: string | null
          source: string | null
        }
        Relationships: []
      }
      mu_credentials_v: {
        Row: {
          claim: string | null
          claim_at: string | null
          claim_source: string | null
          created_at: string | null
          credential_type: string | null
          evidence_at: string | null
          evidence_document_id: string | null
          expires_at: string | null
          id: string | null
          note: string | null
          person_id: string | null
          reference: string | null
          state: string | null
          state_rank: number | null
          updated_at: string | null
          verification_method: string | null
          verification_outcome: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          claim?: string | null
          claim_at?: string | null
          claim_source?: string | null
          created_at?: string | null
          credential_type?: string | null
          evidence_at?: string | null
          evidence_document_id?: string | null
          expires_at?: string | null
          id?: string | null
          note?: string | null
          person_id?: string | null
          reference?: string | null
          state?: never
          state_rank?: never
          updated_at?: string | null
          verification_method?: string | null
          verification_outcome?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          claim?: string | null
          claim_at?: string | null
          claim_source?: string | null
          created_at?: string | null
          credential_type?: string | null
          evidence_at?: string | null
          evidence_document_id?: string | null
          expires_at?: string | null
          id?: string | null
          note?: string | null
          person_id?: string | null
          reference?: string | null
          state?: never
          state_rank?: never
          updated_at?: string | null
          verification_method?: string | null
          verification_outcome?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mu_credentials_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "mu_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_credentials_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mu_credentials_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "mu_readiness_v"
            referencedColumns: ["person_id"]
          },
        ]
      }
      mu_cv_expiries: {
        Row: {
          confidence: number | null
          created_at: string | null
          document_id: string | null
          evidence: string | null
          expires_at: string | null
          issuer: string | null
          kind: string | null
          name: string | null
          parse_id: string | null
          person_id: string | null
        }
        Relationships: []
      }
      mu_readiness_v: {
        Row: {
          candidate_count: number | null
          office_count: number | null
          outstanding: Json | null
          outstanding_count: number | null
          person_id: string | null
          placement_ready: boolean | null
          verification_state: string | null
        }
        Relationships: []
      }
      seo_indexable_pages: {
        Row: {
          canonical_path: string | null
          id: string | null
          last_published_at: string | null
          meta_description: string | null
          page_key: string | null
          page_type: string | null
          path: string | null
          priority: number | null
          title: string | null
        }
        Insert: {
          canonical_path?: string | null
          id?: string | null
          last_published_at?: string | null
          meta_description?: string | null
          page_key?: string | null
          page_type?: string | null
          path?: string | null
          priority?: number | null
          title?: string | null
        }
        Update: {
          canonical_path?: string | null
          id?: string | null
          last_published_at?: string | null
          meta_description?: string | null
          page_key?: string | null
          page_type?: string | null
          path?: string | null
          priority?: number | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_job_key_log: {
        Args: { p_action: string; p_detail?: Json; p_name: string }
        Returns: undefined
      }
      admin_job_key_rotate: {
        Args: { p_name: string }
        Returns: {
          fingerprint: string
          name: string
          rotated_at: string
        }[]
      }
      admin_job_keys: {
        Args: never
        Returns: {
          created_at: string
          fingerprint: string
          name: string
          present: boolean
          rotated_at: string
        }[]
      }
      admin_metrics_audit_latest: {
        Args: never
        Returns: {
          check_key: string
          created_at: string
          dashboard_value: number | null
          delta: number | null
          detail: Json
          id: string
          metric: string
          note: string
          run_id: string
          scope: string
          scope_id: string | null
          severity: string
          source_value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "metrics_audit_findings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_metrics_audit_reconcile: {
        Args: never
        Returns: {
          action: string
          affected: number
          detail: string
        }[]
      }
      admin_metrics_audit_run: {
        Args: never
        Returns: {
          check_key: string
          created_at: string
          dashboard_value: number | null
          delta: number | null
          detail: Json
          id: string
          metric: string
          note: string
          run_id: string
          scope: string
          scope_id: string | null
          severity: string
          source_value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "metrics_audit_findings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      analytics_acquisition: {
        Args: never
        Returns: {
          campaign: string
          enquiries: number
          medium: string
          signups: number
          source: string
        }[]
      }
      analytics_campaigns: {
        Args: never
        Returns: {
          bounced: number
          campaign_id: string
          claimed: number
          clicked: number
          complained: number
          delivered: number
          opened: number
          sent: number
          sent_at: string
          status: string
          title: string
          tracking_enabled: boolean
        }[]
      }
      analytics_candidates: {
        Args: { _step?: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "analytics_candidate_journey"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      analytics_funnel: {
        Args: never
        Returns: {
          people: number
          stage: string
        }[]
      }
      analytics_invited_report: {
        Args: never
        Returns: {
          claimed_at: string
          email: string
          failure_at: string
          failure_reason: string
          invited_at: string
          state: string
        }[]
      }
      analytics_last_refreshed: { Args: never; Returns: string }
      analytics_refresh: { Args: never; Returns: string }
      analytics_signup_failure_summary: {
        Args: never
        Returns: {
          distinct_people: number
          failures: number
          last_seen: string
          reason: string
        }[]
      }
      analytics_stuck_breakdown: {
        Args: never
        Returns: {
          people: number
          stuck_step: string
        }[]
      }
      campaign_sync_stats: {
        Args: { _campaign_id: string }
        Returns: undefined
      }
      care_access_overview: {
        Args: { _client_id: string }
        Returns: {
          bases: Json
          clinical_basis_id: string
          clinical_scope: boolean
          contact_id: string
          email: string
          finance_basis_id: string
          finance_scope: boolean
          grant_id: string
          grant_reason: string
          grant_state: string
          granted_at: string
          invitation: Json
          is_payer: boolean
          is_primary: boolean
          journey_scope: boolean
          person_id: string
          person_name: string
          phone: string
          relationship: string
          revoked_reason: string
        }[]
      }
      care_age_years: { Args: { _dob: string }; Returns: number }
      care_amend_section: {
        Args: {
          _changes: Json
          _document_id: string
          _reason: string
          _section_id: string
        }
        Returns: Json
      }
      care_assessment_accept: {
        Args: { _id: string; _notes?: string }
        Returns: Json
      }
      care_assessment_assign: {
        Args: { _assessor_person_id: string; _id: string; _reason?: string }
        Returns: undefined
      }
      care_assessment_brief: { Args: { _id: string }; Returns: Json }
      care_assessment_cancel: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      care_assessment_capture: {
        Args: { _events: Json; _id: string }
        Returns: Json
      }
      care_assessment_due: { Args: { _appointment: string }; Returns: string }
      care_assessment_record: { Args: { _id: string }; Returns: Json }
      care_assessment_reroute: {
        Args: {
          _id: string
          _reason: string
          _recipient_group?: string
          _restart?: boolean
          _service?: string
        }
        Returns: Json
      }
      care_assessment_reschedule:
        | {
            Args: {
              _appointment_at: string
              _appointment_ends_at?: string
              _id: string
              _reason?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _appointment_at: string
              _appointment_ends_at?: string
              _id: string
              _location_kind?: string
              _notes?: string
              _reason?: string
            }
            Returns: undefined
          }
      care_assessment_return: {
        Args: {
          _category?: string
          _id: string
          _instructions?: string
          _priority?: string
          _reason: string
        }
        Returns: Json
      }
      care_assessment_schedule: {
        Args: {
          _appointment_at: string
          _appointment_ends_at?: string
          _client_id: string
          _location_kind?: string
          _notes?: string
        }
        Returns: string
      }
      care_assessment_service_request: {
        Args: { _note: string; _service_id: string; _work_id: string }
        Returns: Json
      }
      care_assessment_start: { Args: { _id: string }; Returns: string }
      care_assessment_submit: { Args: { _id: string }; Returns: Json }
      care_assessor_capability: { Args: { _person_id: string }; Returns: Json }
      care_assessor_capability_set: {
        Args: { _active: boolean; _person_id: string; _reason?: string }
        Returns: undefined
      }
      care_assessor_eligible: { Args: { _person_id: string }; Returns: boolean }
      care_assessor_live_assessments: {
        Args: { _person_id: string }
        Returns: number
      }
      care_assessor_options: {
        Args: never
        Returns: {
          full_name: string
          has_account: boolean
          person_id: string
          profession: string
        }[]
      }
      care_assignment_activate: {
        Args: { _assignment_id: string }
        Returns: undefined
      }
      care_assignment_cancel: {
        Args: { _assignment_id: string; _reason: string }
        Returns: undefined
      }
      care_assignment_end: {
        Args: {
          _assignment_id: string
          _effective_to?: string
          _reason: string
        }
        Returns: undefined
      }
      care_assignment_plan: {
        Args: {
          _capability_code: string
          _effective_from?: string
          _effective_to?: string
          _episode_id: string
          _person_id: string
        }
        Returns: string
      }
      care_basis_record: {
        Args: {
          _basis_kind: string
          _client_id: string
          _evidence_note?: string
          _evidence_sighted?: boolean
          _person_id: string
        }
        Returns: string
      }
      care_basis_withdraw: {
        Args: { _basis_id: string; _reason: string }
        Returns: undefined
      }
      care_can_administer_access: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      care_client_lifecycle: {
        Args: { _action: string; _client_id: string; _reason?: string }
        Returns: Json
      }
      care_client_links: { Args: { _client_id: string }; Returns: Json }
      care_client_onboarding_complete: {
        Args: {
          _expires_at: string
          _intake: Json
          _onboarding_hash: string
          _pre_assessment_hash: string
        }
        Returns: Json
      }
      care_contact_save:
        | {
            Args: {
              _contact_id: string
              _country?: string
              _email: string
              _full_name: string
              _is_primary: boolean
              _phone: string
              _relationship: string
              _whatsapp: string
            }
            Returns: string
          }
        | {
            Args: {
              _contact_id: string
              _country?: string
              _email: string
              _full_name: string
              _is_primary: boolean
              _phone: string
              _relationship: string
              _relationship_code?: string
              _relationship_other?: string
              _whatsapp: string
            }
            Returns: string
          }
      care_derive_stage: { Args: { _client_id: string }; Returns: string }
      care_enquiry_convert: {
        Args: {
          _client_group?: string
          _group_id?: string
          _person_id?: string
          _service_id?: string
          _submission_id: string
        }
        Returns: Json
      }
      care_enquiry_matches: { Args: { _submission_id: string }; Returns: Json }
      care_episode_activate: {
        Args: { _episode_id: string }
        Returns: undefined
      }
      care_episode_create: {
        Args: {
          _client_id: string
          _overrides?: Json
          _service_code: string
          _starts_at?: string
        }
        Returns: string
      }
      care_episode_modules: {
        Args: { _capability?: string; _episode_id: string }
        Returns: Json
      }
      care_episode_set_status: {
        Args: { _episode_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      care_family_amend: {
        Args: {
          _changes: Json
          _document_id: string
          _section_id: string
          _token_hash: string
        }
        Returns: Json
      }
      care_finance_adjust: {
        Args: {
          _amount: number
          _invoice_id: string
          _kind: string
          _reason: string
        }
        Returns: Json
      }
      care_geo_check: {
        Args: { _lga_code: string; _state_code: string }
        Returns: undefined
      }
      care_grant_reactivate: {
        Args: { _grant_id: string; _reason: string }
        Returns: undefined
      }
      care_grant_revoke: {
        Args: { _grant_id: string; _reason: string }
        Returns: undefined
      }
      care_grant_set: {
        Args: {
          _client_id: string
          _clinical_basis_id: string
          _finance_basis_id: string
          _journey: boolean
          _person_id: string
          _reason: string
        }
        Returns: string
      }
      care_grant_suspend: {
        Args: { _grant_id: string; _reason: string }
        Returns: undefined
      }
      care_group_ensure: { Args: { _client_id: string }; Returns: string }
      care_group_member_set: {
        Args: {
          _group_id: string
          _notes?: string
          _person_id: string
          _role: string
        }
        Returns: string
      }
      care_group_overview: { Args: { _group_id: string }; Returns: Json }
      care_group_save: {
        Args: {
          _address_line?: string
          _display_name: string
          _group_id: string
          _landmark?: string
          _lga_code?: string
          _state_code?: string
        }
        Returns: string
      }
      care_is_assigned_assessor: {
        Args: { _assessment_id: string }
        Returns: boolean
      }
      care_journey_grant: {
        Args: {
          _client_id: string
          _origin?: string
          _person_id: string
          _reason: string
        }
        Returns: {
          grant_id: string
          outcome: string
        }[]
      }
      care_languages_valid: { Args: { _codes: string[] }; Returns: boolean }
      care_my_clients: {
        Args: never
        Returns: {
          client_id: string
          client_reference: string
          display_name: string
        }[]
      }
      care_my_open_alert: { Args: never; Returns: Json }
      care_my_person_ids: { Args: never; Returns: string[] }
      care_my_visits: {
        Args: { _days?: number; _from?: string }
        Returns: Json
      }
      care_notification_attempt:
        | { Args: { _id: string }; Returns: number }
        | { Args: { _force?: boolean; _id: string }; Returns: number }
      care_notification_claim: {
        Args: {
          _channel: string
          _client_id?: string
          _contact_id?: string
          _dedupe_key: string
          _destination?: string
          _kind: string
          _origin?: string
          _person_id?: string
          _related_id?: string
          _related_table?: string
          _subject?: string
        }
        Returns: {
          attempt_count: number
          created: boolean
          id: string
          status: string
        }[]
      }
      care_notification_result: {
        Args: {
          _id: string
          _ok: boolean
          _provider_error?: string
          _provider_message_id?: string
        }
        Returns: undefined
      }
      care_onboarding_service_id: {
        Args: { _service_key: string }
        Returns: string
      }
      care_payer_set: {
        Args: { _client_id: string; _person_id: string }
        Returns: undefined
      }
      care_person_create: {
        Args: {
          _email?: string
          _full_name: string
          _phone?: string
          _preferred_name?: string
          _whatsapp?: string
        }
        Returns: string
      }
      care_plan_approve: {
        Args: { _decision?: string; _document_id: string; _reason?: string }
        Returns: Json
      }
      care_plan_is_approved: {
        Args: { _document_id: string }
        Returns: boolean
      }
      care_plan_item_remove: {
        Args: { _document_id: string; _id: string; _kind: string }
        Returns: undefined
      }
      care_plan_item_save: {
        Args: {
          _document_id: string
          _id: string
          _kind: string
          _payload: Json
        }
        Returns: string
      }
      care_plan_new_version: {
        Args: { _document_id: string; _reason: string }
        Returns: string
      }
      care_plan_save_section: {
        Args: { _document_id: string; _section_id: string; _value: Json }
        Returns: Json
      }
      care_plan_submit: { Args: { _document_id: string }; Returns: Json }
      care_pre_assessment_finalise: {
        Args: {
          _address_line?: string
          _document_id: string
          _flags?: Json
          _grant_person_id?: string
          _language_codes?: string[]
          _lga_code?: string
          _outstanding?: Json
          _state_code?: string
          _token_hash: string
        }
        Returns: Json
      }
      care_proposal_comment: {
        Args: { _body: string; _proposal_id: string }
        Returns: Json
      }
      care_proposal_draft: {
        Args: { _assessment_document_id?: string; _client_id: string }
        Returns: Json
      }
      care_proposal_recipients: {
        Args: { _client_id: string }
        Returns: {
          full_name: string
          person_id: string
        }[]
      }
      care_proposal_respond: {
        Args: { _comment?: string; _proposal_id: string; _response: string }
        Returns: Json
      }
      care_proposal_send: {
        Args: { _person_ids: string[]; _proposal_id: string }
        Returns: Json
      }
      care_proposal_status: { Args: { _client_id: string }; Returns: Json }
      care_proposal_withdraw: {
        Args: { _proposal_id: string; _reason: string }
        Returns: Json
      }
      care_quote_accept: { Args: { _quote_id: string }; Returns: Json }
      care_quote_issue: { Args: { _quote_id: string }; Returns: Json }
      care_quote_save: {
        Args: {
          _client_id: string
          _lines: Json
          _notes?: string
          _quote_id: string
          _recipient_contact_id: string
          _valid_until?: string
          _vat_rate?: number
        }
        Returns: Json
      }
      care_recipient_create: {
        Args: {
          _address_line?: string
          _age_years?: number
          _date_of_birth?: string
          _email?: string
          _full_name: string
          _landmark?: string
          _lga_code?: string
          _person_id?: string
          _phone?: string
          _preferred_name?: string
          _request_id: string
          _sex_code?: string
          _state_code?: string
        }
        Returns: Json
      }
      care_recipient_person_link: {
        Args: { _person_id: string; _recipient_id: string; _role?: string }
        Returns: undefined
      }
      care_reconcile_stages: { Args: never; Returns: number }
      care_refresh_stage: { Args: { _client_id: string }; Returns: string }
      care_relationship_remove: { Args: { _id: string }; Returns: undefined }
      care_relationship_set: {
        Args: {
          _from_person_id: string
          _group_id?: string
          _other_label?: string
          _relationship_code: string
          _to_person_id: string
        }
        Returns: string
      }
      care_request_coverage: { Args: { _request_id: string }; Returns: Json }
      care_request_lifecycle: {
        Args: { _action: string; _reason?: string; _request_id: string }
        Returns: Json
      }
      care_request_readiness: { Args: { _request_id: string }; Returns: Json }
      care_request_recipient_add: {
        Args: {
          _address_line?: string
          _client_id: string
          _display_order?: number
          _landmark?: string
          _lga_code?: string
          _person_id?: string
          _request_id: string
          _state_code?: string
        }
        Returns: string
      }
      care_request_recipient_remove: {
        Args: { _id: string }
        Returns: undefined
      }
      care_request_save: {
        Args: {
          _callback_at?: string
          _callback_phone?: string
          _enquirer_person_id?: string
          _enquiry_notes?: string
          _group_id: string
          _request_id: string
          _source?: string
          _status?: string
        }
        Returns: string
      }
      care_review_checklist_save: {
        Args: { _checklist: Json; _id: string }
        Returns: Json
      }
      care_review_record: { Args: { _work: string }; Returns: Json }
      care_service_config_draft: {
        Args: { _modules?: Json; _service_code: string }
        Returns: string
      }
      care_service_config_publish: { Args: { _id: string }; Returns: undefined }
      care_service_intention_remove: {
        Args: { _id: string }
        Returns: undefined
      }
      care_service_intention_set: {
        Args: {
          _intention_id: string
          _is_shared?: boolean
          _reason?: string
          _recipient_ids: string[]
          _request_id: string
          _service_id: string
          _source?: string
          _state?: string
        }
        Returns: string
      }
      care_token_address_save: {
        Args: {
          _address_line?: string
          _landmark?: string
          _lga_code?: string
          _state_code?: string
          _token_hash: string
        }
        Returns: string
      }
      care_visit_attach_work: {
        Args: { _visit_id: string; _work_id: string }
        Returns: undefined
      }
      care_visit_check_in: {
        Args: {
          _accuracy_m?: number
          _client_event_id: string
          _lat?: number
          _lng?: number
          _visit_id: string
        }
        Returns: Json
      }
      care_visit_check_out: {
        Args: {
          _accuracy_m?: number
          _client_event_id: string
          _lat?: number
          _lng?: number
          _note?: string
          _visit_id: string
        }
        Returns: Json
      }
      care_visit_set: {
        Args: {
          _address_line?: string
          _appointment_at?: string
          _appointment_ends_at?: string
          _assessor_person_id?: string
          _group_id: string
          _location_kind?: string
          _notes?: string
          _request_id?: string
          _status?: string
          _visit_id: string
        }
        Returns: string
      }
      care_work_assign: {
        Args: { _assignee_user_id?: string; _id: string; _team?: string }
        Returns: undefined
      }
      care_work_cancel: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      care_work_complete: {
        Args: { _id: string; _outcome?: string }
        Returns: undefined
      }
      care_work_create: {
        Args: {
          _assignee_user_id?: string
          _client_id: string
          _detail?: string
          _due_at?: string
          _is_blocker?: boolean
          _kind: string
          _priority?: string
          _source_key: string
          _team?: string
          _title: string
        }
        Returns: string
      }
      care_work_domain_managed: { Args: { _kind: string }; Returns: boolean }
      care_work_event: {
        Args: { _client_id: string; _event: string; _ref?: string }
        Returns: undefined
      }
      care_work_ranked: {
        Args: { _client_id?: string }
        Returns: {
          assignee_user_id: string
          blocked_by: string
          client_id: string
          created_at: string
          detail: string
          due_at: string
          id: string
          is_blocker: boolean
          kind: string
          priority: string
          rank_order: number
          rank_reason: string
          status: string
          team: string
          title: string
        }[]
      }
      care_work_reopen: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      care_work_set: {
        Args: {
          _assignee_user_id?: string
          _due_at?: string
          _id: string
          _team?: string
        }
        Returns: undefined
      }
      care_worker_alert_raise: {
        Args: {
          _accuracy_m?: number
          _client_event_id: string
          _lat?: number
          _lng?: number
          _note?: string
          _visit_id?: string
        }
        Returns: Json
      }
      care_worker_capability: { Args: { _person_id: string }; Returns: Json }
      care_worker_capability_set: {
        Args: { _active: boolean; _person_id: string; _reason?: string }
        Returns: undefined
      }
      care_worker_my_assignments: { Args: never; Returns: Json }
      care_working_due: {
        Args: { _days: number; _from: string }
        Returns: string
      }
      heard_bootstrap_volunteer: {
        Args: { p_first_name?: string; p_last_name?: string; p_role?: string }
        Returns: {
          adjustments: string | null
          adjustments_discuss_privately: boolean
          application_status: string
          city: string | null
          country_code: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          languages: Json
          last_name: string
          lga: string | null
          phone: string | null
          preferred_name: string | null
          role_interest: string
          subdivision_code: string | null
          subdivision_name: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "heard_volunteer_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      heard_join_waitlist: {
        Args: { _email: string; _purpose?: string; _source?: string }
        Returns: string
      }
      heard_public_letters: {
        Args: { _limit?: number }
        Returns: {
          content: string
          heading: string
          public_ref: string
          published_at: string
          sign_it_as: string
        }[]
      }
      heard_register_volunteer_profile: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_role_interest: string
        }
        Returns: {
          adjustments: string | null
          adjustments_discuss_privately: boolean
          application_status: string
          city: string | null
          country_code: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          languages: Json
          last_name: string
          lga: string | null
          phone: string | null
          preferred_name: string | null
          role_interest: string
          subdivision_code: string | null
          subdivision_name: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "heard_volunteer_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      heard_submit_letter: {
        Args: {
          _consent_version?: string
          _content: string
          _email?: string
          _heading?: string
          _sign_it_as?: string
        }
        Returns: string
      }
      heard_submit_message: {
        Args: { _content: string; _email?: string; _subject?: string }
        Returns: string
      }
      heard_submit_story: {
        Args: {
          _content: string
          _email?: string
          _sign_it_as?: string
          _subject?: string
        }
        Returns: string
      }
      heard_submit_volunteer: {
        Args: {
          _email: string
          _first_name: string
          _last_name: string
          _motivation?: string
          _role_interest: string
          _state: string
          _time_commitment?: string
        }
        Returns: string
      }
      heard_subscribe_letters: {
        Args: { _consent_version?: string; _email: string }
        Returns: string
      }
      heard_update_volunteer_profile: {
        Args: {
          p_adjustments: string
          p_adjustments_discuss_privately: boolean
          p_city: string
          p_country_code: string
          p_first_name: string
          p_languages: Json
          p_last_name: string
          p_lga: string
          p_phone: string
          p_preferred_name: string
          p_subdivision_code: string
          p_subdivision_name: string
          p_timezone: string
        }
        Returns: {
          adjustments: string | null
          adjustments_discuss_privately: boolean
          application_status: string
          city: string | null
          country_code: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          languages: Json
          last_name: string
          lga: string | null
          phone: string | null
          preferred_name: string | null
          role_interest: string
          subdivision_code: string | null
          subdivision_name: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "heard_volunteer_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      job_key_check: {
        Args: { p_name: string; p_value: string }
        Returns: boolean
      }
      job_key_value: { Args: { p_name: string }; Returns: string }
      mu_admin_upload_document: {
        Args: {
          _doc_type: string
          _expires_at?: string
          _label: string
          _person_id: string
          _source_note: string
          _url: string
        }
        Returns: Json
      }
      mu_applications_for_person: {
        Args: { _person_id: string }
        Returns: {
          applied_at: string
          can_withdraw: boolean
          id: string
          kind: string
          location: string
          opportunity_id: string
          slots: Json
          stage: string
          stage_at: string
          stage_note: string
          title: string
        }[]
      }
      mu_ask_candidate_parsed_field: {
        Args: { _id: string; _note?: string }
        Returns: Json
      }
      mu_ask_candidate_parsed_fields_bulk: {
        Args: { _ids: string[] }
        Returns: Json
      }
      mu_attach_credential_document: {
        Args: {
          _claim_source?: string
          _credential_type: string
          _document_id: string
          _person_id: string
        }
        Returns: Json
      }
      mu_autosettle_documents: { Args: { _limit?: number }; Returns: Json }
      mu_availability_freshness: {
        Args: { _limit?: number }
        Returns: {
          claimed: boolean
          days_since: number
          email: string
          full_name: string
          last_availability_update: string
          person_id: string
          profession: string
        }[]
      }
      mu_availability_state: {
        Args: { _from: string; _person_id: string; _to: string }
        Returns: string
      }
      mu_available_people: {
        Args: {
          _blocks?: string[]
          _from: string
          _lga?: string
          _limit?: number
          _profession?: string
          _state?: string
          _to: string
        }
        Returns: {
          availability: string
          busy_days: number
          free_dates: string[]
          free_days: number
          full_name: string
          last_availability_update: string
          lga: string
          person_id: string
          profession: string
          state: string
          verification_state: string
          years_experience: number
        }[]
      }
      mu_awaiting_candidate: {
        Args: { _limit?: number }
        Returns: {
          asked_at: string
          claimed: boolean
          created_at: string
          email: string
          field: string
          full_name: string
          id: string
          parsed_value: string
          person_id: string
          stored_value: string
        }[]
      }
      mu_become_workforce: {
        Args: { _payload?: Json; _person_id: string }
        Returns: Json
      }
      mu_bin_contract: {
        Args: { _bin?: boolean; _contract_id: string }
        Returns: Json
      }
      mu_bin_offer: {
        Args: { _bin?: boolean; _offer_id: string }
        Returns: Json
      }
      mu_block_hours: { Args: { _keys: string[] }; Returns: number[] }
      mu_book_interview_slot: { Args: { _slot_id: string }; Returns: undefined }
      mu_cancel_document_request: { Args: { _id: string }; Returns: Json }
      mu_candidate_gaps_row: {
        Args: { p: Database["public"]["Tables"]["mu_people"]["Row"] }
        Returns: Json
      }
      mu_candidate_update_profile: { Args: { _patch: Json }; Returns: Json }
      mu_claim_my_person: { Args: never; Returns: string }
      mu_conflict_to_candidate: {
        Args: { _actor?: string; _conflict_id: string }
        Returns: undefined
      }
      mu_contract_acknowledge_annex: {
        Args: { _acknowledged?: boolean; _code: string; _contract_id: string }
        Returns: Json
      }
      mu_contract_countersign: {
        Args: { _contract_id: string; _name: string; _signature_image?: string }
        Returns: Json
      }
      mu_contract_create_from_library: {
        Args: { _payload?: Json; _person_id: string }
        Returns: string
      }
      mu_contract_create_from_template: {
        Args: { _payload?: Json; _person_id: string; _template_id: string }
        Returns: string
      }
      mu_contract_create_variation: {
        Args: { _actor_name?: string; _contract_id: string }
        Returns: string
      }
      mu_contract_issue: {
        Args: { _actor_name?: string; _contract_id: string }
        Returns: string
      }
      mu_contract_log: {
        Args: {
          _actor_name?: string
          _actor_role?: string
          _contract_id: string
          _detail?: string
          _event_type: string
          _ip?: string
          _payload?: Json
          _user_agent?: string
        }
        Returns: string
      }
      mu_contract_public_row: {
        Args: { _row: Database["public"]["Tables"]["mu_contracts"]["Row"] }
        Returns: Json
      }
      mu_contract_required_annexes: {
        Args: { _contract: Database["public"]["Tables"]["mu_contracts"]["Row"] }
        Returns: string[]
      }
      mu_contract_save_draft: {
        Args: { _contract_id: string; _payload: Json }
        Returns: undefined
      }
      mu_contract_sign: {
        Args: {
          _contract_id: string
          _method?: string
          _signature_image?: string
          _signed_name: string
          _user_agent?: string
        }
        Returns: undefined
      }
      mu_contract_sign_annex: {
        Args: {
          _code: string
          _contract_id: string
          _method?: string
          _signature_image?: string
          _signed_name: string
        }
        Returns: Json
      }
      mu_contract_sign_by_token: {
        Args: {
          _ip?: string
          _method?: string
          _signature_image?: string
          _signed_name: string
          _token: string
          _user_agent?: string
        }
        Returns: string
      }
      mu_contract_sign_in_portal: {
        Args: {
          _contract_id: string
          _method: string
          _signature_image?: string
          _signed_name: string
        }
        Returns: Json
      }
      mu_contract_unsign_annex: {
        Args: { _code: string; _contract_id: string }
        Returns: Json
      }
      mu_contract_void: {
        Args: { _actor_name?: string; _contract_id: string; _reason?: string }
        Returns: undefined
      }
      mu_contracts_renewals_due: {
        Args: { _days?: number }
        Returns: {
          annex_acknowledgements: Json
          annex_signatures: Json
          annexes: Json
          clauses: Json
          contract_type: string
          countersignature_image: string | null
          countersigned_at: string | null
          countersigned_by: string | null
          countersigned_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          document_id: string | null
          document_url: string | null
          end_date: string | null
          ended_at: string | null
          fields: Json
          id: string
          is_clinical: boolean
          issued_annexes: Json | null
          issued_at: string | null
          issued_by: string | null
          issued_by_name: string | null
          issued_clauses: Json | null
          issued_fields: Json | null
          issued_hash: string | null
          job_title: string | null
          location: string | null
          notes: string | null
          notice_period: string | null
          offer_id: string | null
          pay_amount: number | null
          pay_currency: string
          pay_frequency: string
          pdf_path: string | null
          person_id: string
          probation_end: string | null
          sign_token: string | null
          signature_image: string | null
          signature_method: string | null
          signed_acknowledged_at: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_name: string | null
          signed_user_agent: string | null
          start_date: string | null
          status: string
          supersedes_id: string | null
          template_id: string | null
          token_expires_at: string | null
          updated_at: string
          withdrawn_at: string | null
          working_pattern: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mu_contracts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mu_convert_to_staff: {
        Args: { _payload?: Json; _person_id: string }
        Returns: undefined
      }
      mu_create_contract: {
        Args: { _payload: Json; _person_id: string }
        Returns: string
      }
      mu_credential_state: {
        Args: {
          _claim: string
          _evidence_document_id: string
          _expires_at: string
          _verification_outcome: string
        }
        Returns: string
      }
      mu_cv_was_read: {
        Args: { _document_id: string; _person_id: string }
        Returns: boolean
      }
      mu_decide_leave: {
        Args: { _action: string; _id: string; _note?: string }
        Returns: Json
      }
      mu_deployment_readiness: {
        Args: { _person_id: string; _types?: string[] }
        Returns: number
      }
      mu_derive_verification:
        | { Args: { _person_id: string }; Returns: string }
        | { Args: { _gaps: Json; _person_id: string }; Returns: string }
      mu_doc_kind_guess: {
        Args: { _label: string; _url?: string }
        Returns: string
      }
      mu_doc_type: { Args: { _label: string; _url?: string }; Returns: string }
      mu_document_reading_health: {
        Args: never
        Returns: {
          metric: string
          value: number
        }[]
      }
      mu_document_status: {
        Args: { _person_id: string }
        Returns: {
          conditional_reason: string
          conditional_until: string
          doc_type: string
          document_id: string
          document_label: string
          document_url: string
          expires_at: string
          helper: string
          label: string
          required: boolean
          review_reason: string
          reviewed_at: string
          source_note: string
          status: string
        }[]
      }
      mu_document_verdict: { Args: { _document_id: string }; Returns: Json }
      mu_end_engagement: { Args: { _end?: string; _id: string }; Returns: Json }
      mu_evidence_rank: { Args: { _state: string }; Returns: number }
      mu_expects_licence: { Args: { _profession: string }; Returns: boolean }
      mu_expire_documents: { Args: never; Returns: Json }
      mu_field_shape_problem: {
        Args: { _field: string; _value: string }
        Returns: string
      }
      mu_flag_profile_ambiguity: {
        Args: { _person_id: string }
        Returns: number
      }
      mu_fold_accents: { Args: { _t: string }; Returns: string }
      mu_guess_doc_kind: {
        Args: { _label: string; _url?: string }
        Returns: string
      }
      mu_has_capability: {
        Args: { _capability: string; _person_id: string }
        Returns: boolean
      }
      mu_hour_span: {
        Args: { _end: number; _start: number }
        Returns: number[]
      }
      mu_hours_of: { Args: { _blocks: Json }; Returns: number[] }
      mu_intake_health: { Args: never; Returns: Json }
      mu_issue_contract: { Args: { _contract_id: string }; Returns: undefined }
      mu_lga_states: { Args: { _lga: string }; Returns: string[] }
      mu_loc_key: { Args: { _v: string }; Returns: string }
      mu_loc_overlap: {
        Args: { _value: string; _wanted: string[] }
        Returns: boolean
      }
      mu_loc_tokens: { Args: { _value: string }; Returns: string[] }
      mu_loose_date: { Args: { _t: string }; Returns: string }
      mu_match_candidates: {
        Args: {
          _include_blocked?: boolean
          _limit?: number
          _opportunity_id: string
        }
        Returns: {
          blockers: string[]
          breakdown: Json
          full_name: string
          lga: string
          matched_desirable: string[]
          matched_required: string[]
          missing_required: string[]
          person_id: string
          profession: string
          score: number
          state: string
          years_experience: number
        }[]
      }
      mu_match_opportunities_for_person: {
        Args: {
          _include_blocked?: boolean
          _limit?: number
          _person_id: string
        }
        Returns: {
          blockers: string[]
          breakdown: Json
          location: string
          matched_desirable: string[]
          matched_required: string[]
          missing_required: string[]
          opportunity_id: string
          score: number
          title: string
        }[]
      }
      mu_match_report: {
        Args: { _limit?: number; _opportunity_id: string }
        Returns: Json
      }
      mu_my_applications: {
        Args: never
        Returns: {
          applied_at: string
          can_withdraw: boolean
          id: string
          kind: string
          location: string
          opportunity_id: string
          slots: Json
          stage: string
          stage_at: string
          stage_note: string
          title: string
        }[]
      }
      mu_my_contract: { Args: { _contract_id: string }; Returns: Json }
      mu_my_contracts: { Args: never; Returns: Json[] }
      mu_my_offers: {
        Args: never
        Returns: {
          created_at: string
          decline_reason: string
          engagement_type: string
          expires_at: string
          id: string
          kind: string
          location: string
          message: string
          parent_offer_id: string
          pattern: string
          rate_note: string
          responded_at: string
          shifts: Json
          start_date: string
          status: string
          terms: Json
          title: string
        }[]
      }
      mu_my_person_id: { Args: never; Returns: string }
      mu_name_agreement: { Args: { _a: string; _b: string }; Returns: boolean }
      mu_name_tokens: { Args: { _name: string }; Returns: string[] }
      mu_next_free_dates: {
        Args: {
          _after: string
          _blocks?: string[]
          _horizon_days?: number
          _lga?: string
          _limit?: number
          _profession?: string
          _state?: string
        }
        Returns: {
          days_away: number
          full_name: string
          last_availability_update: string
          lga: string
          next_free_date: string
          person_id: string
          profession: string
          state: string
        }[]
      }
      mu_norm_body: { Args: { _v: string }; Returns: string }
      mu_norm_email: { Args: { _e: string }; Returns: string }
      mu_norm_lga: { Args: { _state?: string; _v: string }; Returns: string }
      mu_norm_phone: { Args: { _p: string }; Returns: string }
      mu_norm_state: { Args: { _v: string }; Returns: string }
      mu_offer_interview_slots: {
        Args: { _application_id: string; _slots: Json }
        Returns: number
      }
      mu_open_field_conflicts: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          field: string
          full_name: string
          id: string
          parsed_value: string
          person_id: string
          precedence: string
          stored_value: string
        }[]
      }
      mu_parse_backlog: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          cv_document_id: string
          cv_label: string
          email: string
          full_name: string
          has_cv: boolean
          parse_status: string
          person_id: string
        }[]
      }
      mu_parsed_norm: {
        Args: { _field: string; _value: string }
        Returns: string
      }
      mu_parsed_vs_held: {
        Args: { _person_id: string }
        Returns: {
          asked_at: string
          confidence: number
          document_label: string
          evidence: string
          field: string
          held_value: string
          id: string
          note: string
          parsed_value: string
          status: string
        }[]
      }
      mu_person_gaps: { Args: { _person: string }; Returns: string[] }
      mu_portal_mode: { Args: never; Returns: Json }
      mu_profile_completeness: { Args: { _person_id: string }; Returns: number }
      mu_promote_application_answers: {
        Args: { _person_id?: string }
        Returns: Json
      }
      mu_promote_extra_parsed_fields: {
        Args: { _person_id?: string }
        Returns: Json
      }
      mu_promote_parsed_fields: { Args: { _person_id?: string }; Returns: Json }
      mu_query_field: {
        Args: {
          _field: string
          _note: string
          _person_id: string
          _value: string
        }
        Returns: undefined
      }
      mu_readiness_items: {
        Args: { _person_id: string }
        Returns: {
          action: string
          code: string
          owner: string
          route: string
          sentence: string
          sort_order: number
        }[]
      }
      mu_readiness_summary: {
        Args: never
        Returns: {
          candidate_items: number
          office_items: number
          person_id: string
        }[]
      }
      mu_rebuild_parsed_facets: { Args: { _person_id?: string }; Returns: Json }
      mu_reclassify_document: {
        Args: { _doc_type: string; _document_id: string; _reason?: string }
        Returns: Json
      }
      mu_request_documents: {
        Args: {
          _doc_types: string[]
          _due_by?: string
          _note?: string
          _person_id: string
        }
        Returns: Json
      }
      mu_request_leave: {
        Args: { _from: string; _reason?: string; _to: string }
        Returns: Json
      }
      mu_requeue_parse: { Args: { _person_id: string }; Returns: Json }
      mu_resolve_field_conflict: {
        Args: { _action: string; _conflict_id: string }
        Returns: Json
      }
      mu_resolve_person: {
        Args: {
          _email: string
          _name: string
          _phone: string
          _position: string
          _state: string
          _years: number
        }
        Returns: string
      }
      mu_respond_offer: {
        Args: { _action: string; _offer_id: string; _reason?: string }
        Returns: Json
      }
      mu_return_to_talent: {
        Args: { _person_id: string; _reason?: string }
        Returns: Json
      }
      mu_review_document: {
        Args: {
          _conditional_until?: string
          _document_id: string
          _expires_at?: string
          _outcome: string
          _reason?: string
        }
        Returns: Json
      }
      mu_review_parsed_field: {
        Args: { _action: string; _id: string }
        Returns: Json
      }
      mu_review_parsed_fields_bulk: {
        Args: { _action: string; _ids: string[] }
        Returns: Json
      }
      mu_review_pending_ids: { Args: never; Returns: string[] }
      mu_review_queue: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          credential_state: string
          credential_type: string
          doc_type: string
          document_id: string
          expires_at: string
          full_name: string
          hold_reason: string
          is_required: boolean
          label: string
          on_active_shortlist: boolean
          person_email: string
          person_id: string
          read_state: string
          review_outcome: string
          shortlist_count: number
          source_note: string
          source_table: string
          uploaded_by_name: string
          url: string
        }[]
      }
      mu_review_queue_count: { Args: never; Returns: number }
      mu_role_requirement: {
        Args: { _profession: string; _track: string }
        Returns: {
          active: boolean
          created_at: string
          expects_licence: boolean
          label: string
          min_references: number
          needs_availability: boolean
          needs_institution: boolean
          needs_nysc: boolean
          needs_preferences: boolean
          needs_right_to_work: boolean
          pattern: string | null
          role_key: string
          sort_order: number
          track_key: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mu_role_requirements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mu_scan_name_duplicates: { Args: never; Returns: Json }
      mu_self_register: {
        Args: {
          p_course_of_study?: string
          p_expected_graduation?: string
          p_full_name: string
          p_institution?: string
          p_phone: string
          p_track: string
          p_year_of_study?: string
        }
        Returns: string
      }
      mu_send_offer: { Args: { _payload: Json; _shifts?: Json }; Returns: Json }
      mu_set_application_stage: {
        Args: { _application_id: string; _note?: string; _stage: string }
        Returns: undefined
      }
      mu_set_contract_status: {
        Args: { _contract_id: string; _note?: string; _status: string }
        Returns: undefined
      }
      mu_settle_parsed_fields: {
        Args: { _person_id: string; _threshold?: number }
        Returns: Json
      }
      mu_shortlist_set_stage: {
        Args: { _id: string; _note?: string; _status: string }
        Returns: Json
      }
      mu_sign_contract: {
        Args: { _contract_id: string; _method?: string; _signed_name: string }
        Returns: undefined
      }
      mu_staff_list: {
        Args: never
        Returns: {
          auth_user_id: string
          contract_id: string
          contract_status: string
          department: string
          docs_accepted: number
          docs_missing: number
          docs_required: number
          email: string
          employment_type: string
          full_name: string
          id: string
          job_title: string
          phone: string
          staff_start_date: string
          staff_status: string
          work_email: string
        }[]
      }
      mu_system_blocks: {
        Args: { _from: string; _person_id: string; _to: string }
        Returns: {
          hours: number[]
          label: string
          reason: string
          slot_date: string
        }[]
      }
      mu_system_request_document: {
        Args: { _doc_type: string; _note: string; _person_id: string }
        Returns: undefined
      }
      mu_tidy_documents: { Args: { _apply?: boolean }; Returns: Json }
      mu_tidy_label: { Args: { _label: string }; Returns: string }
      mu_verification_queue: {
        Args: { _limit?: number }
        Returns: {
          claim_source: string
          credential_type: string
          document_label: string
          document_url: string
          evidence_at: string
          evidence_document_id: string
          full_name: string
          on_active_shortlist: boolean
          person_id: string
          shortlist_count: number
          state: string
        }[]
      }
      mu_verify_credential: {
        Args: {
          _credential_type: string
          _document_id?: string
          _expires_at?: string
          _method?: string
          _note?: string
          _outcome: string
          _person_id: string
        }
        Returns: Json
      }
      mu_withdraw_application: { Args: { _id: string }; Returns: Json }
      mu_withdraw_offer: {
        Args: { _offer_id: string; _reason?: string }
        Returns: Json
      }
      mu_workforce_blockers: { Args: { _person_id: string }; Returns: Json }
      mu_workforce_list: {
        Args: never
        Returns: {
          email: string
          end_date: string
          engagement_id: string
          full_name: string
          location: string
          pattern: string
          pending_leave: number
          person_id: string
          phone: string
          profession: string
          start_date: string
          status: string
          title: string
          upcoming_shifts: number
        }[]
      }
      seo_claim_effective_state: {
        Args: { p_state: string; p_valid_from: string; p_valid_until: string }
        Returns: string
      }
      seo_claim_save: {
        Args: { p_claim_id: string; p_patch: Json }
        Returns: string
      }
      seo_claims_refresh_stale: { Args: never; Returns: number }
      seo_fee_ref_add: {
        Args: {
          p_module_id: string
          p_page_id: string
          p_service_fee_id: string
          p_usage_key: string
        }
        Returns: string
      }
      seo_market_save: {
        Args: { p_market_id: string; p_patch: Json }
        Returns: string
      }
      seo_module_save: {
        Args: {
          p_change_note: string
          p_content: Json
          p_module_id: string
          p_review_state: string
          p_summary: string
        }
        Returns: string
      }
      seo_page_blockers: { Args: { p_page_id: string }; Returns: string[] }
      seo_page_create: {
        Args: {
          p_estate: string
          p_page_key: string
          p_page_type: string
          p_path: string
          p_title: string
        }
        Returns: string
      }
      seo_page_link: {
        Args: {
          p_key: string
          p_kind: string
          p_page_id: string
          p_required: boolean
          p_target_id: string
        }
        Returns: string
      }
      seo_page_publishable: { Args: { p_page_id: string }; Returns: boolean }
      seo_page_save: {
        Args: { p_page_id: string; p_patch: Json }
        Returns: string
      }
      seo_page_set_index_state: {
        Args: { p_page_id: string; p_state: string }
        Returns: string[]
      }
      seo_page_unlink: {
        Args: { p_kind: string; p_link_id: string }
        Returns: undefined
      }
      seo_public_fee_save: {
        Args: {
          p_amount: number
          p_billing_unit: string
          p_fee_type: string
          p_notes?: string
          p_price_treatment: string
          p_public_label: string
          p_public_visibility?: string
          p_service_slug: string
          p_sku: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
