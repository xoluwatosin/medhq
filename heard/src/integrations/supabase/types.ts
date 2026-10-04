export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Generated from the Medic Connect schema and trimmed to Heard's tables.
// Regenerate from the Heard project: npx supabase gen types typescript --project-id <ref>
export type Database = {
  public: {
    Tables: {
      heard_admins: {
        Row: {
          created_at: string
          permissions: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          permissions?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          permissions?: string[]
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
