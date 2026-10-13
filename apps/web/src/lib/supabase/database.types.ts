export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deploy_confidence: {
        Row: {
          breakdown: Json
          created_at: string
          deploy_id: string
          id: string
          project_id: string
          score: number | null
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          deploy_id: string
          id?: string
          project_id: string
          score?: number | null
        }
        Update: {
          breakdown?: Json
          created_at?: string
          deploy_id?: string
          id?: string
          project_id?: string
          score?: number | null
        }
        Relationships: []
      }
      deploys: {
        Row: {
          branch: string
          commit_sha: string
          created_at: string
          full_failed: number | null
          full_flaky: number | null
          full_total: number | null
          id: string
          org_id: string
          pr_number: number | null
          project_id: string
        }
        Insert: {
          branch: string
          commit_sha: string
          created_at?: string
          full_failed?: number | null
          full_flaky?: number | null
          full_total?: number | null
          id?: string
          org_id: string
          pr_number?: number | null
          project_id: string
        }
        Update: {
          branch?: string
          commit_sha?: string
          created_at?: string
          full_failed?: number | null
          full_flaky?: number | null
          full_total?: number | null
          id?: string
          org_id?: string
          pr_number?: number | null
          project_id?: string
        }
        Relationships: []
      }
      flake_stats: {
        Row: {
          flaky_total: number
          last_flaky_at: string | null
          project_id: string
          runs_total: number
          test_id: string
          updated_at: string
        }
        Insert: {
          flaky_total?: number
          last_flaky_at?: string | null
          project_id: string
          runs_total?: number
          test_id: string
          updated_at?: string
        }
        Update: {
          flaky_total?: number
          last_flaky_at?: string | null
          project_id?: string
          runs_total?: number
          test_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      github_installations: {
        Row: {
          account_login: string
          account_type: string | null
          created_at: string
          id: string
          installation_id: number
          org_id: string | null
          suspended: boolean
          target_type: string | null
          updated_at: string
        }
        Insert: {
          account_login: string
          account_type?: string | null
          created_at?: string
          id?: string
          installation_id: number
          org_id?: string | null
          suspended?: boolean
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          account_login?: string
          account_type?: string | null
          created_at?: string
          id?: string
          installation_id?: number
          org_id?: string | null
          suspended?: boolean
          target_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      healing_events: {
        Row: {
          confidence: number | null
          created_at: string
          dom_context: string | null
          id: string
          new_selector: string
          old_selector: string
          project_id: string
          run_id: string | null
          status: Database["public"]["Enums"]["healing_status"]
          test_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          dom_context?: string | null
          id?: string
          new_selector: string
          old_selector: string
          project_id: string
          run_id?: string | null
          status?: Database["public"]["Enums"]["healing_status"]
          test_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          dom_context?: string | null
          id?: string
          new_selector?: string
          old_selector?: string
          project_id?: string
          run_id?: string | null
          status?: Database["public"]["Enums"]["healing_status"]
          test_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: []
      }
      org_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
        }
        Relationships: []
      }
      orgs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan: Database["public"]["Enums"]["plan_tier"]
          slug: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          slug?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          slug?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          default_branch: string
          github_installation_id: number | null
          id: string
          ingest_token: string
          name: string
          org_id: string
          regression_threshold: number
          repo: string | null
          repo_provider: string
          rerun_count: number
          visibility: Database["public"]["Enums"]["project_visibility"]
        }
        Insert: {
          created_at?: string
          default_branch?: string
          github_installation_id?: number | null
          id?: string
          ingest_token?: string
          name: string
          org_id: string
          regression_threshold?: number
          repo?: string | null
          repo_provider?: string
          rerun_count?: number
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Update: {
          created_at?: string
          default_branch?: string
          github_installation_id?: number | null
          id?: string
          ingest_token?: string
          name?: string
          org_id?: string
          regression_threshold?: number
          repo?: string | null
          repo_provider?: string
          rerun_count?: number
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Relationships: []
      }
      regression_stats: {
        Row: {
          changes_total: number
          file_path: string
          id: string
          last_regression_at: string | null
          project_id: string
          regressions_total: number
          updated_at: string
        }
        Insert: {
          changes_total?: number
          file_path: string
          id?: string
          last_regression_at?: string | null
          project_id: string
          regressions_total?: number
          updated_at?: string
        }
        Update: {
          changes_total?: number
          file_path?: string
          id?: string
          last_regression_at?: string | null
          project_id?: string
          regressions_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          org_id: string
          provider: string
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id: string
          provider?: string
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id?: string
          provider?: string
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          attempts: number
          created_at: string
          discipline: string
          name: string | null
          spec_path: string | null
          duration_ms: number | null
          endpoint: string | null
          engine: string | null
          error_message: string | null
          failing_selector: string | null
          id: string
          layer: string | null
          meaning: string | null
          project_id: string
          run_id: string
          status: Database["public"]["Enums"]["result_status"]
          test_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          discipline?: string
          duration_ms?: number | null
          endpoint?: string | null
          engine?: string | null
          error_message?: string | null
          failing_selector?: string | null
          id?: string
          layer?: string | null
          meaning?: string | null
          name?: string | null
          spec_path?: string | null
          project_id: string
          run_id: string
          status: Database["public"]["Enums"]["result_status"]
          test_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          discipline?: string
          duration_ms?: number | null
          endpoint?: string | null
          engine?: string | null
          error_message?: string | null
          failing_selector?: string | null
          id?: string
          layer?: string | null
          meaning?: string | null
          name?: string | null
          spec_path?: string | null
          project_id?: string
          run_id?: string
          status?: Database["public"]["Enums"]["result_status"]
          test_id?: string | null
        }
        Relationships: []
      }
      security_findings: {
        Row: {
          count: number
          created_at: string
          cwe: string | null
          engine: string
          file_path: string | null
          id: string
          line: number | null
          message: string | null
          org_id: string
          project_id: string
          rule_id: string
          run_id: string
          severity: string
          title: string
          url: string | null
        }
        Insert: {
          count?: number
          created_at?: string
          cwe?: string | null
          engine: string
          file_path?: string | null
          id?: string
          line?: number | null
          message?: string | null
          org_id: string
          project_id: string
          rule_id: string
          run_id: string
          severity: string
          title: string
          url?: string | null
        }
        Update: {
          count?: number
          created_at?: string
          cwe?: string | null
          engine?: string
          file_path?: string | null
          id?: string
          line?: number | null
          message?: string | null
          org_id?: string
          project_id?: string
          rule_id?: string
          run_id?: string
          severity?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      perf_reports: {
        Row: {
          aggregate: Json
          created_at: string
          engine: string
          id: string
          org_id: string
          profile: string | null
          project_id: string
          run_id: string
          scenarios: Json | null
          tier: Database["public"]["Enums"]["run_tier"]
          web_vitals: Json | null
        }
        Insert: {
          aggregate: Json
          created_at?: string
          engine: string
          id?: string
          org_id: string
          profile?: string | null
          project_id: string
          run_id: string
          scenarios?: Json | null
          tier: Database["public"]["Enums"]["run_tier"]
          web_vitals?: Json | null
        }
        Update: {
          aggregate?: Json
          created_at?: string
          engine?: string
          id?: string
          org_id?: string
          profile?: string | null
          project_id?: string
          run_id?: string
          scenarios?: Json | null
          tier?: Database["public"]["Enums"]["run_tier"]
          web_vitals?: Json | null
        }
        Relationships: []
      }
      test_runs: {
        Row: {
          branch: string | null
          commit_sha: string | null
          completed_at: string | null
          created_at: string
          deploy_id: string | null
          discipline: string
          duration_ms: number | null
          failed: number
          flaky: number
          healed: number
          id: string
          org_id: string
          passed: number
          pr_number: number | null
          project_id: string
          selected_count: number | null
          skipped: number
          status: Database["public"]["Enums"]["run_status"]
          tier: Database["public"]["Enums"]["run_tier"]
          total: number
          trigger: Database["public"]["Enums"]["run_trigger"]
        }
        Insert: {
          branch?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string
          deploy_id?: string | null
          discipline?: string
          duration_ms?: number | null
          failed?: number
          flaky?: number
          healed?: number
          id?: string
          org_id: string
          passed?: number
          pr_number?: number | null
          project_id: string
          selected_count?: number | null
          skipped?: number
          status?: Database["public"]["Enums"]["run_status"]
          tier: Database["public"]["Enums"]["run_tier"]
          total?: number
          trigger: Database["public"]["Enums"]["run_trigger"]
        }
        Update: {
          branch?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string
          deploy_id?: string | null
          discipline?: string
          duration_ms?: number | null
          failed?: number
          flaky?: number
          healed?: number
          id?: string
          org_id?: string
          passed?: number
          pr_number?: number | null
          project_id?: string
          selected_count?: number | null
          skipped?: number
          status?: Database["public"]["Enums"]["run_status"]
          tier?: Database["public"]["Enums"]["run_tier"]
          total?: number
          trigger?: Database["public"]["Enums"]["run_trigger"]
        }
        Relationships: []
      }
      tests: {
        Row: {
          confidence: number | null
          created_at: string
          critical_path: boolean
          description: string | null
          generated_model: string | null
          id: string
          is_pom: boolean
          kind: string
          name: string
          org_id: string
          origin: string
          plan: Json
          project_id: string
          source_files: string[]
          source_url: string | null
          spec_content: string
          spec_path: string
          status: Database["public"]["Enums"]["test_status"]
          suite: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          critical_path?: boolean
          description?: string | null
          generated_model?: string | null
          id?: string
          is_pom?: boolean
          kind?: string
          name: string
          org_id: string
          origin?: string
          plan?: Json
          project_id: string
          source_files?: string[]
          source_url?: string | null
          spec_content: string
          spec_path: string
          status?: Database["public"]["Enums"]["test_status"]
          suite?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          critical_path?: boolean
          description?: string | null
          generated_model?: string | null
          id?: string
          is_pom?: boolean
          kind?: string
          name?: string
          org_id?: string
          origin?: string
          plan?: Json
          project_id?: string
          source_files?: string[]
          source_url?: string | null
          spec_content?: string
          spec_path?: string
          status?: Database["public"]["Enums"]["test_status"]
          suite?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      explorations: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          org_id: string
          project_id: string
          status: string
          steps: Json
          test_id: string | null
          url: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          org_id: string
          project_id: string
          status?: string
          steps?: Json
          test_id?: string | null
          url: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          org_id?: string
          project_id?: string
          status?: string
          steps?: Json
          test_id?: string | null
          url?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_personal_org: { Args: { p_name: string }; Returns: string }
      is_org_admin: { Args: { target_org: string }; Returns: boolean }
      is_org_member: { Args: { target_org: string }; Returns: boolean }
      resolve_org_invites: { Args: { p_user_id: string; p_email: string }; Returns: number }
    }
    Enums: {
      healing_status: "suggested" | "applied" | "rejected"
      member_role: "owner" | "admin" | "member"
      plan_tier: "free" | "solo" | "pro" | "team" | "starter" | "growth" | "scale" | "enterprise"
      project_visibility: "private" | "public"
      result_status: "passed" | "failed" | "flaky" | "skipped" | "healed"
      run_status: "queued" | "running" | "completed" | "failed" | "cancelled"
      run_tier: "fast" | "full"
      run_trigger: "pr" | "merge" | "schedule" | "predeploy" | "manual"
      subscription_status: "created" | "active" | "halted" | "cancelled" | "paused"
      test_status: "draft" | "active" | "quarantined" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Update"]

export type Enums<
  T extends keyof DefaultSchema["Enums"],
> = DefaultSchema["Enums"][T]
