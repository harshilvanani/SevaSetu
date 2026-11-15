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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          reason: string | null
          target_id: string
          target_label: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id: string
          target_label?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string
          target_label?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          cancelled_at: string | null
          claimed_qty: number
          completed_at: string | null
          id: string
          joined_at: string
          reminded_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          task_id: string
          volunteer_id: string
        }
        Insert: {
          cancelled_at?: string | null
          claimed_qty: number
          completed_at?: string | null
          id?: string
          joined_at?: string
          reminded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          task_id: string
          volunteer_id: string
        }
        Update: {
          cancelled_at?: string | null
          claimed_qty?: number
          completed_at?: string | null
          id?: string
          joined_at?: string
          reminded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          task_id?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "seva_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          period: Database["public"]["Enums"]["day_period"]
          user_id: string
          weekday: number
        }
        Insert: {
          period: Database["public"]["Enums"]["day_period"]
          user_id: string
          weekday: number
        }
        Update: {
          period?: Database["public"]["Enums"]["day_period"]
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_accounts: {
        Row: {
          email: string
          password: string
          persona: string
          user_id: string
        }
        Insert: {
          email: string
          password: string
          persona: string
          user_id: string
        }
        Update: {
          email?: string
          password?: string
          persona?: string
          user_id?: string
        }
        Relationships: []
      }
      donation_campaigns: {
        Row: {
          allow_cover_fees: boolean
          allow_monthly: boolean
          created_at: string
          created_by: string | null
          currency: string
          description: string
          donors_count: number
          event_id: string | null
          goal_cents: number | null
          id: string
          image_url: string | null
          org_id: string
          presets: number[]
          raised_cents: number
          status: string
          title: string
        }
        Insert: {
          allow_cover_fees?: boolean
          allow_monthly?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          donors_count?: number
          event_id?: string | null
          goal_cents?: number | null
          id?: string
          image_url?: string | null
          org_id: string
          presets?: number[]
          raised_cents?: number
          status?: string
          title: string
        }
        Update: {
          allow_cover_fees?: boolean
          allow_monthly?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          donors_count?: number
          event_id?: string | null
          goal_cents?: number | null
          id?: string
          image_url?: string | null
          org_id?: string
          presets?: number[]
          raised_cents?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount_cents: number
          campaign_id: string
          created_at: string
          currency: string
          donor_email: string | null
          donor_id: string | null
          donor_name: string | null
          fee_cents: number
          id: string
          interval: string
          org_id: string
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          amount_cents: number
          campaign_id: string
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_id?: string | null
          donor_name?: string | null
          fee_cents?: number
          id?: string
          interval?: string
          org_id: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_id?: string | null
          donor_name?: string | null
          fee_cents?: number
          id?: string
          interval?: string
          org_id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "donation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_access: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string | null
          invited_by: string | null
          note: string | null
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at?: string | null
          invited_by?: string | null
          note?: string | null
          responded_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string | null
          invited_by?: string | null
          note?: string | null
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_access_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_access_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_hours: {
        Row: {
          assignment_id: string
          hours: number
          logged_at: string
          logged_by: string | null
        }
        Insert: {
          assignment_id: string
          hours: number
          logged_at?: string
          logged_by?: string | null
        }
        Update: {
          assignment_id?: string
          hours?: number
          logged_at?: string
          logged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_hours_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hours_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hours_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_private_details: {
        Row: {
          contact_info: string | null
          event_id: string
          online_details: string | null
        }
        Insert: {
          contact_info?: string | null
          event_id: string
          online_details?: string | null
        }
        Update: {
          contact_info?: string | null
          event_id?: string
          online_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_private_details_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_template_tasks: {
        Row: {
          id: string
          name: string
          name_i18n: Json
          sort: number
          template_id: string
        }
        Insert: {
          id?: string
          name: string
          name_i18n?: Json
          sort?: number
          template_id: string
        }
        Update: {
          id?: string
          name?: string
          name_i18n?: Json
          sort?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          name_i18n: Json
          org_id: string | null
          sort: number
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          name_i18n?: Json
          org_id?: string | null
          sort?: number
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          name_i18n?: Json
          org_id?: string | null
          sort?: number
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "event_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          city: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          id: string
          latitude: number | null
          longitude: number | null
          mode: Database["public"]["Enums"]["participation_mode"]
          org_id: string
          published_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          template_id: string | null
          title: string
          updated_at: string
          venue_name: string | null
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          address?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mode?: Database["public"]["Enums"]["participation_mode"]
          org_id: string
          published_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          venue_name?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          address?: string | null
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mode?: Database["public"]["Enums"]["participation_mode"]
          org_id?: string
          published_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          venue_name?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_payments: {
        Row: {
          charges_enabled: boolean
          details_submitted: boolean
          org_id: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          details_submitted?: boolean
          org_id: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          details_submitted?: boolean
          org_id?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["org_status"]
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["org_status"]
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["org_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked_at: string | null
          blocked_reason: string | null
          city: string | null
          courses: string[]
          created_at: string
          email: string | null
          full_name: string
          hours_per_week: string | null
          id: string
          interests: string[]
          is_demo: boolean
          is_platform_admin: boolean
          latitude: number | null
          locale: string
          longitude: number | null
          onboarded_at: string | null
          radius_km: number
          serve_mode: Database["public"]["Enums"]["serve_mode"]
          skills: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          courses?: string[]
          created_at?: string
          email?: string | null
          full_name?: string
          hours_per_week?: string | null
          id: string
          interests?: string[]
          is_demo?: boolean
          is_platform_admin?: boolean
          latitude?: number | null
          locale?: string
          longitude?: number | null
          onboarded_at?: string | null
          radius_km?: number
          serve_mode?: Database["public"]["Enums"]["serve_mode"]
          skills?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          courses?: string[]
          created_at?: string
          email?: string | null
          full_name?: string
          hours_per_week?: string | null
          id?: string
          interests?: string[]
          is_demo?: boolean
          is_platform_admin?: boolean
          latitude?: number | null
          locale?: string
          longitude?: number | null
          onboarded_at?: string | null
          radius_km?: number
          serve_mode?: Database["public"]["Enums"]["serve_mode"]
          skills?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      progress_reports: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          note: string | null
          reported_qty: number
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          verified_qty: number | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          note?: string | null
          reported_qty: number
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          verified_qty?: number | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          note?: string | null
          reported_qty?: number
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          verified_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seva_tasks: {
        Row: {
          category: string | null
          claimed_total: number
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          event_id: string
          id: string
          instructions: string
          max_per_volunteer: number | null
          max_volunteers: number | null
          minutes_per_unit: number | null
          mode: Database["public"]["Enums"]["participation_mode"]
          pending_total: number
          positions: number | null
          required_courses: string[]
          signup_deadline: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          steps: string[]
          target_qty: number | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          unit: string | null
          updated_at: string
          verified_total: number
          visibility: Database["public"]["Enums"]["visibility"]
          volunteers_count: number
        }
        Insert: {
          category?: string | null
          claimed_total?: number
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          event_id: string
          id?: string
          instructions?: string
          max_per_volunteer?: number | null
          max_volunteers?: number | null
          minutes_per_unit?: number | null
          mode?: Database["public"]["Enums"]["participation_mode"]
          pending_total?: number
          positions?: number | null
          required_courses?: string[]
          signup_deadline?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          steps?: string[]
          target_qty?: number | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          unit?: string | null
          updated_at?: string
          verified_total?: number
          visibility?: Database["public"]["Enums"]["visibility"]
          volunteers_count?: number
        }
        Update: {
          category?: string | null
          claimed_total?: number
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          event_id?: string
          id?: string
          instructions?: string
          max_per_volunteer?: number | null
          max_volunteers?: number | null
          minutes_per_unit?: number | null
          mode?: Database["public"]["Enums"]["participation_mode"]
          pending_total?: number
          positions?: number | null
          required_courses?: string[]
          signup_deadline?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          steps?: string[]
          target_qty?: number | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          unit?: string | null
          updated_at?: string
          verified_total?: number
          visibility?: Database["public"]["Enums"]["visibility"]
          volunteers_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seva_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seva_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seva_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      task_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invited_by: string | null
          invitee_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          task_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          invitee_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          task_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          invitee_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_invitations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "seva_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_org_member: {
        Args: { p_email: string; p_org: string }
        Returns: string
      }
      admin_cancel_event: {
        Args: { p_event: string; p_reason: string }
        Returns: undefined
      }
      admin_demo_accounts: {
        Args: never
        Returns: {
          email: string
          full_name: string
          password: string
          persona: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: { p_query?: string }
        Returns: {
          assignment_count: number
          blocked_at: string
          blocked_reason: string
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_demo: boolean
          is_platform_admin: boolean
          last_sign_in_at: string
          onboarded: boolean
          org_count: number
          providers: string[]
        }[]
      }
      admin_overview: { Args: never; Returns: Json }
      admin_reset_demo: { Args: never; Returns: undefined }
      admin_review_organization: {
        Args: { p_action: string; p_org: string; p_reason?: string }
        Returns: undefined
      }
      admin_set_platform_admin: {
        Args: { p_admin: boolean; p_user: string }
        Returns: undefined
      }
      admin_set_user_blocked: {
        Args: { p_blocked: boolean; p_reason?: string; p_user: string }
        Returns: Json
      }
      assert_not_blocked: { Args: never; Returns: undefined }
      assert_platform_admin: { Args: never; Returns: undefined }
      can_edit_template: { Args: { p_template: string }; Returns: boolean }
      can_manage_org: { Args: { p_org: string }; Returns: boolean }
      can_see_profile: { Args: { p_user: string }; Returns: boolean }
      can_view_event: { Args: { p_event: string }; Returns: boolean }
      can_view_task: { Args: { p_task: string }; Returns: boolean }
      complete_assignment: {
        Args: { p_assignment: string }
        Returns: undefined
      }
      complete_event: {
        Args: { p_event: string; p_hours: Json }
        Returns: undefined
      }
      create_organization: {
        Args: { p_city?: string; p_description?: string; p_name: string }
        Returns: string
      }
      decline_event_invitation: {
        Args: { p_event: string }
        Returns: undefined
      }
      decline_invitation: { Args: { p_invitation: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      effective_hours: { Args: { p_assignment: string }; Returns: number }
      estimate_hours: { Args: { p_assignment: string }; Returns: number }
      event_access_people: {
        Args: { p_event: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      event_hours_candidates: {
        Args: { p_event: string }
        Returns: {
          assignment_id: string
          estimate: number
          logged: number
          task_id: string
          task_title: string
          volunteer_id: string
          volunteer_name: string
        }[]
      }
      event_org: { Args: { p_event: string }; Returns: string }
      expire_invitations: { Args: never; Returns: number }
      find_volunteers: {
        Args: {
          p_courses?: string[]
          p_event: string
          p_only_available?: boolean
          p_only_near?: boolean
          p_skills?: string[]
          p_task?: string
          p_tz?: string
        }
        Returns: {
          availability: Json
          city: string
          courses: string[]
          distance_km: number
          full_name: string
          id: string
          interests: string[]
          onboarded: boolean
          reasons: string[]
          score: number
          serve_mode: Database["public"]["Enums"]["serve_mode"]
          skills: string[]
        }[]
      }
      has_event_access: { Args: { p_event: string }; Returns: boolean }
      has_task_access: { Args: { p_task: string }; Returns: boolean }
      invite_to_event: {
        Args: { p_days?: number; p_event: string; p_users: string[] }
        Returns: number
      }
      invite_to_task: {
        Args: { p_days?: number; p_task: string; p_users: string[] }
        Returns: number
      }
      is_blocked: { Args: { p_user?: string }; Returns: boolean }
      is_demo_user: { Args: { p_user?: string }; Returns: boolean }
      is_event_participant: { Args: { p_event: string }; Returns: boolean }
      is_org_member: { Args: { p_org: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      join_task: { Args: { p_qty?: number; p_task: string }; Returns: Json }
      leave_task: { Args: { p_assignment: string }; Returns: Json }
      list_private_events: {
        Args: never
        Returns: {
          access: string
          id: string
          org_id: string
          org_name: string
          starts_at: string
          title: string
        }[]
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_label: string
          p_reason: string
          p_target: string
          p_type: string
        }
        Returns: undefined
      }
      notify: {
        Args: {
          p_body?: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user: string
        }
        Returns: undefined
      }
      org_accepts_donations: { Args: { p_org: string }; Returns: boolean }
      publish_event: { Args: { p_event: string }; Returns: undefined }
      refresh_task_counters: { Args: { p_task: string }; Returns: undefined }
      reopen_event: { Args: { p_event: string }; Returns: undefined }
      request_event_access: {
        Args: { p_event: string; p_note?: string }
        Returns: string
      }
      reset_demo_data: { Args: never; Returns: undefined }
      respond_event_request: {
        Args: { p_approve: boolean; p_event: string; p_user: string }
        Returns: undefined
      }
      resubmit_organization: {
        Args: {
          p_city?: string
          p_description?: string
          p_name: string
          p_org: string
        }
        Returns: undefined
      }
      review_progress: {
        Args: {
          p_decision: string
          p_reason?: string
          p_report: string
          p_verified_qty?: number
        }
        Returns: undefined
      }
      revoke_event_access: {
        Args: { p_event: string; p_user: string }
        Returns: undefined
      }
      search_volunteers: {
        Args: { p_org: string; p_query: string }
        Returns: {
          city: string
          email: string
          full_name: string
          id: string
        }[]
      }
      send_seva_reminders: { Args: never; Returns: number }
      submit_progress: {
        Args: { p_assignment: string; p_note?: string; p_qty: number }
        Returns: string
      }
      task_org: { Args: { p_task: string }; Returns: string }
      task_remaining: {
        Args: { t: Database["public"]["Tables"]["seva_tasks"]["Row"] }
        Returns: number
      }
      update_claim: {
        Args: { p_assignment: string; p_qty: number }
        Returns: Json
      }
      volunteer_stats: {
        Args: { p_user?: string }
        Returns: {
          active_count: number
          completed_count: number
          verified_hours: number
        }[]
      }
    }
    Enums: {
      assignment_status: "active" | "completed" | "cancelled"
      day_period: "morning" | "afternoon" | "evening"
      event_status: "draft" | "published" | "completed" | "cancelled"
      invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "revoked"
      org_role: "owner" | "organizer"
      org_status: "pending" | "approved" | "rejected" | "suspended"
      participation_mode: "onsite" | "virtual" | "hybrid"
      report_status: "pending" | "approved" | "rejected"
      serve_mode: "onsite" | "virtual" | "either"
      task_status: "draft" | "open" | "full" | "closed" | "completed"
      task_type: "quantity" | "role"
      visibility: "public" | "private"
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
      assignment_status: ["active", "completed", "cancelled"],
      day_period: ["morning", "afternoon", "evening"],
      event_status: ["draft", "published", "completed", "cancelled"],
      invitation_status: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "revoked",
      ],
      org_role: ["owner", "organizer"],
      org_status: ["pending", "approved", "rejected", "suspended"],
      participation_mode: ["onsite", "virtual", "hybrid"],
      report_status: ["pending", "approved", "rejected"],
      serve_mode: ["onsite", "virtual", "either"],
      task_status: ["draft", "open", "full", "closed", "completed"],
      task_type: ["quantity", "role"],
      visibility: ["public", "private"],
    },
  },
} as const
