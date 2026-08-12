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
      active_timers: {
        Row: {
          created_at: string
          description: string | null
          is_billable: boolean
          project_id: string
          started_at: string
          task_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_billable?: boolean
          project_id: string
          started_at?: string
          task_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_billable?: boolean
          project_id?: string
          started_at?: string
          task_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_timers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_timers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_timers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_action_approvals: {
        Row: {
          action_summary: string
          agent_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          execution_id: string | null
          id: string
          payload: Json
          status: string
          tool_name: string
          workspace_id: string
        }
        Insert: {
          action_summary: string
          agent_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          execution_id?: string | null
          id?: string
          payload?: Json
          status?: string
          tool_name: string
          workspace_id: string
        }
        Update: {
          action_summary?: string
          agent_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          execution_id?: string | null
          id?: string
          payload?: Json
          status?: string
          tool_name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_approvals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_approvals_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "agent_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_action_approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_event_log: {
        Row: {
          created_at: string
          dispatched_at: string | null
          event_name: string
          id: string
          payload: Json
          source: string
          triggers_matched: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dispatched_at?: string | null
          event_name: string
          id?: string
          payload?: Json
          source?: string
          triggers_matched?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          dispatched_at?: string | null
          event_name?: string
          id?: string
          payload?: Json
          source?: string
          triggers_matched?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_event_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_executions: {
        Row: {
          actions: Json
          agent_id: string
          completed_at: string | null
          context: Json
          cost: number
          error_message: string | null
          goal: string
          id: string
          parent_execution_id: string | null
          plan: Json
          requested_by: string | null
          result: Json | null
          review_status: string
          reviewed_by: string | null
          started_at: string
          status: string
          tokens_used: number
          trigger: string
          workspace_id: string
        }
        Insert: {
          actions?: Json
          agent_id: string
          completed_at?: string | null
          context?: Json
          cost?: number
          error_message?: string | null
          goal: string
          id?: string
          parent_execution_id?: string | null
          plan?: Json
          requested_by?: string | null
          result?: Json | null
          review_status?: string
          reviewed_by?: string | null
          started_at?: string
          status?: string
          tokens_used?: number
          trigger: string
          workspace_id: string
        }
        Update: {
          actions?: Json
          agent_id?: string
          completed_at?: string | null
          context?: Json
          cost?: number
          error_message?: string | null
          goal?: string
          id?: string
          parent_execution_id?: string | null
          plan?: Json
          requested_by?: string | null
          result?: Json | null
          review_status?: string
          reviewed_by?: string | null
          started_at?: string
          status?: string
          tokens_used?: number
          trigger?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_executions_parent_execution_id_fkey"
            columns: ["parent_execution_id"]
            isOneToOne: false
            referencedRelation: "agent_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          access_count: number
          agent_id: string
          confidence: number
          content: string
          context: Json
          created_at: string
          id: string
          last_accessed: string
          memory_type: string
          workspace_id: string
        }
        Insert: {
          access_count?: number
          agent_id: string
          confidence?: number
          content: string
          context?: Json
          created_at?: string
          id?: string
          last_accessed?: string
          memory_type: string
          workspace_id: string
        }
        Update: {
          access_count?: number
          agent_id?: string
          confidence?: number
          content?: string
          context?: Json
          created_at?: string
          id?: string
          last_accessed?: string
          memory_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_playbooks: {
        Row: {
          agent_id: string | null
          autonomy_override: string | null
          created_at: string
          created_by: string | null
          description: string | null
          goal_template: string
          id: string
          is_active: boolean
          is_seeded: boolean
          name: string
          slug: string
          sort_order: number
          stage: string
          target_kind: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          autonomy_override?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal_template: string
          id?: string
          is_active?: boolean
          is_seeded?: boolean
          name: string
          slug: string
          sort_order?: number
          stage: string
          target_kind: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          autonomy_override?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          goal_template?: string
          id?: string
          is_active?: boolean
          is_seeded?: boolean
          name?: string
          slug?: string
          sort_order?: number
          stage?: string
          target_kind?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_playbooks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          destination: Json
          error: string | null
          id: string
          kind: string
          mode: string
          progress: Json
          prompt: string
          result_id: string | null
          result_kind: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          destination?: Json
          error?: string | null
          id?: string
          kind: string
          mode: string
          progress?: Json
          prompt: string
          result_id?: string | null
          result_kind?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          destination?: Json
          error?: string | null
          id?: string
          kind?: string
          mode?: string
          progress?: Json
          prompt?: string
          result_id?: string | null
          result_kind?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_approval: boolean
          schema: Json
          tool_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_approval?: boolean
          schema?: Json
          tool_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_approval?: boolean
          schema?: Json
          tool_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tools_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_triggers: {
        Row: {
          agent_id: string
          config: Json
          created_at: string
          created_by: string
          goal_template: string
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_status: string | null
          name: string
          next_run_at: string | null
          trigger_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          config?: Json
          created_at?: string
          created_by: string
          goal_template: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          name: string
          next_run_at?: string | null
          trigger_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          config?: Json
          created_at?: string
          created_by?: string
          goal_template?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          name?: string
          next_run_at?: string | null
          trigger_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_triggers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          autonomy_level: string
          avatar_emoji: string | null
          avatar_url: string | null
          capabilities: string[]
          created_at: string
          created_by: string | null
          current_task_id: string | null
          description: string | null
          guardrails: Json
          handle: string | null
          id: string
          is_active: boolean
          max_tokens: number
          memory: Json
          model: string
          model_config: Json
          name: string
          status: string
          system_prompt: string
          temperature: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          autonomy_level?: string
          avatar_emoji?: string | null
          avatar_url?: string | null
          capabilities?: string[]
          created_at?: string
          created_by?: string | null
          current_task_id?: string | null
          description?: string | null
          guardrails?: Json
          handle?: string | null
          id?: string
          is_active?: boolean
          max_tokens?: number
          memory?: Json
          model?: string
          model_config?: Json
          name: string
          status?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          autonomy_level?: string
          avatar_emoji?: string | null
          avatar_url?: string | null
          capabilities?: string[]
          created_at?: string
          created_by?: string | null
          current_task_id?: string | null
          description?: string | null
          guardrails?: Json
          handle?: string | null
          id?: string
          is_active?: boolean
          max_tokens?: number
          memory?: Json
          model?: string
          model_config?: Json
          name?: string
          status?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_artifacts: {
        Row: {
          ai_confidence_score: number | null
          applied_at: string | null
          applied_to_id: string | null
          applied_to_type: string | null
          client_account_id: string | null
          contact_id: string | null
          content: Json
          content_edited: string | null
          content_raw: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          generation_cost: number | null
          human_edit_distance: number | null
          id: string
          kind: string
          model_version: string | null
          parent_artifact_id: string | null
          project_id: string | null
          prompt: string | null
          prompt_pack: Json | null
          prompt_pack_hash: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_run_id: string | null
          status: string
          title: string
          trigger_source: string
          updated_at: string
          version_number: number
          workspace_id: string
        }
        Insert: {
          ai_confidence_score?: number | null
          applied_at?: string | null
          applied_to_id?: string | null
          applied_to_type?: string | null
          client_account_id?: string | null
          contact_id?: string | null
          content?: Json
          content_edited?: string | null
          content_raw?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          generation_cost?: number | null
          human_edit_distance?: number | null
          id?: string
          kind: string
          model_version?: string | null
          parent_artifact_id?: string | null
          project_id?: string | null
          prompt?: string | null
          prompt_pack?: Json | null
          prompt_pack_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_run_id?: string | null
          status?: string
          title: string
          trigger_source?: string
          updated_at?: string
          version_number?: number
          workspace_id: string
        }
        Update: {
          ai_confidence_score?: number | null
          applied_at?: string | null
          applied_to_id?: string | null
          applied_to_type?: string | null
          client_account_id?: string | null
          contact_id?: string | null
          content?: Json
          content_edited?: string | null
          content_raw?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          generation_cost?: number | null
          human_edit_distance?: number | null
          id?: string
          kind?: string
          model_version?: string | null
          parent_artifact_id?: string | null
          project_id?: string | null
          prompt?: string | null
          prompt_pack?: Json | null
          prompt_pack_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_run_id?: string | null
          status?: string
          title?: string
          trigger_source?: string
          updated_at?: string
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_artifacts_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artifacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artifacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artifacts_parent_artifact_id_fkey"
            columns: ["parent_artifact_id"]
            isOneToOne: false
            referencedRelation: "ai_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artifacts_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_artifacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          output: string | null
          status: string
          task_id: string | null
          tokens_used: number | null
          trigger_event: string | null
          workspace_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          output?: string | null
          status?: string
          task_id?: string | null
          tokens_used?: number | null
          trigger_event?: string | null
          workspace_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          output?: string | null
          status?: string
          task_id?: string | null
          tokens_used?: number | null
          trigger_event?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      ai_automations: {
        Row: {
          action_config: Json
          agent_id: string | null
          apply_action: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          instructions_template: string | null
          is_active: boolean
          last_run_at: string | null
          name: string
          run_count: number
          trigger_event: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_config?: Json
          agent_id?: string | null
          apply_action?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instructions_template?: string | null
          is_active?: boolean
          last_run_at?: string | null
          name: string
          run_count?: number
          trigger_event?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_config?: Json
          agent_id?: string | null
          apply_action?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instructions_template?: string | null
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          run_count?: number
          trigger_event?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      ai_task_assignments: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          depth: number
          error_message: string | null
          id: string
          instructions: string | null
          iterations: number
          model_used: string | null
          output: string | null
          parent_assignment_id: string | null
          started_at: string | null
          status: string
          task_id: string
          tokens_used: number | null
          tool_calls: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          depth?: number
          error_message?: string | null
          id?: string
          instructions?: string | null
          iterations?: number
          model_used?: string | null
          output?: string | null
          parent_assignment_id?: string | null
          started_at?: string | null
          status?: string
          task_id: string
          tokens_used?: number | null
          tool_calls?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          depth?: number
          error_message?: string | null
          id?: string
          instructions?: string | null
          iterations?: number
          model_used?: string | null
          output?: string | null
          parent_assignment_id?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
          tokens_used?: number | null
          tool_calls?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_task_assignments_parent_assignment_id_fkey"
            columns: ["parent_assignment_id"]
            isOneToOne: false
            referencedRelation: "ai_task_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_task_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_task_threads: {
        Row: {
          created_at: string
          id: string
          messages: Json
          task_id: string
          tool_calls: Json
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          task_id: string
          tool_calls?: Json
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          task_id?: string
          tool_calls?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_threads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      audit_log_entries: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_label: string | null
          target_type: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          color: string
          created_at: string
          criteria: Json
          description: string
          icon: string
          key: string
          name: string
          sort_order: number
          tier: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          criteria?: Json
          description: string
          icon: string
          key: string
          name: string
          sort_order?: number
          tier?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          key?: string
          name?: string
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          accent_color: string | null
          client_account_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          font_body: string | null
          font_heading: string | null
          footer_text: string | null
          id: string
          is_default: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          text_color: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accent_color?: string | null
          client_account_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          font_body?: string | null
          font_heading?: string | null
          footer_text?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          text_color?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accent_color?: string | null
          client_account_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          font_body?: string | null
          font_heading?: string | null
          footer_text?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          text_color?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendees: Json
          auto_capture_enabled: boolean
          conference_kind: string | null
          conference_url: string | null
          connection_id: string
          created_at: string
          description: string | null
          end_at: string
          html_link: string | null
          ical_uid: string | null
          id: string
          linked_meeting_id: string | null
          linked_project_id: string | null
          location: string | null
          organizer_email: string | null
          provider: string
          provider_event_id: string
          raw: Json | null
          start_at: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          all_day?: boolean
          attendees?: Json
          auto_capture_enabled?: boolean
          conference_kind?: string | null
          conference_url?: string | null
          connection_id: string
          created_at?: string
          description?: string | null
          end_at: string
          html_link?: string | null
          ical_uid?: string | null
          id?: string
          linked_meeting_id?: string | null
          linked_project_id?: string | null
          location?: string | null
          organizer_email?: string | null
          provider: string
          provider_event_id: string
          raw?: Json | null
          start_at: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          all_day?: boolean
          attendees?: Json
          auto_capture_enabled?: boolean
          conference_kind?: string | null
          conference_url?: string | null
          connection_id?: string
          created_at?: string
          description?: string | null
          end_at?: string
          html_link?: string | null
          ical_uid?: string | null
          id?: string
          linked_meeting_id?: string | null
          linked_project_id?: string | null
          location?: string | null
          organizer_email?: string | null
          provider?: string
          provider_event_id?: string
          raw?: Json | null
          start_at?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "user_calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_linked_meeting_id_fkey"
            columns: ["linked_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          applied_at: string | null
          client_approved_at: string | null
          client_approved_by: string | null
          cost_impact: number
          created_at: string
          currency: string
          description: string | null
          id: string
          internal_approved_at: string | null
          internal_approved_by: string | null
          number: number
          project_id: string
          reason: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requested_by: string | null
          status: string
          timeline_impact_days: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          applied_at?: string | null
          client_approved_at?: string | null
          client_approved_by?: string | null
          cost_impact?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          internal_approved_at?: string | null
          internal_approved_by?: string | null
          number?: number
          project_id: string
          reason?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
          timeline_impact_days?: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          applied_at?: string | null
          client_approved_at?: string | null
          client_approved_by?: string | null
          cost_impact?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          internal_approved_at?: string | null
          internal_approved_by?: string | null
          number?: number
          project_id?: string
          reason?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
          timeline_impact_days?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      change_requests: {
        Row: {
          client_portal_access_id: string | null
          created_at: string
          description: string
          estimated_cost: number | null
          estimated_days: number | null
          id: string
          impact_areas: string[]
          project_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by_email: string | null
          submitted_by_name: string | null
          title: string
          updated_at: string
          urgency: string
          workspace_id: string
        }
        Insert: {
          client_portal_access_id?: string | null
          created_at?: string
          description: string
          estimated_cost?: number | null
          estimated_days?: number | null
          id?: string
          impact_areas?: string[]
          project_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          title: string
          updated_at?: string
          urgency?: string
          workspace_id: string
        }
        Update: {
          client_portal_access_id?: string | null
          created_at?: string
          description?: string
          estimated_cost?: number | null
          estimated_days?: number | null
          id?: string
          impact_areas?: string[]
          project_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          title?: string
          updated_at?: string
          urgency?: string
          workspace_id?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          body_json: Json | null
          body_md: string | null
          channel_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_system: boolean
          mentions: string[]
          metadata: Json
          parent_message_id: string | null
          thread_count: number
          thread_last_reply_at: string | null
          workspace_id: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          body_json?: Json | null
          body_md?: string | null
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_system?: boolean
          mentions?: string[]
          metadata?: Json
          parent_message_id?: string | null
          thread_count?: number
          thread_last_reply_at?: string | null
          workspace_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          body_json?: Json | null
          body_md?: string | null
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_system?: boolean
          mentions?: string[]
          metadata?: Json
          parent_message_id?: string | null
          thread_count?: number
          thread_last_reply_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_pins: {
        Row: {
          channel_id: string
          message_id: string
          pinned_at: string
          pinned_by: string | null
        }
        Insert: {
          channel_id: string
          message_id: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Update: {
          channel_id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_pins_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          is_default: boolean
          is_private: boolean
          name: string
          scope: Database["public"]["Enums"]["channel_scope"]
          scope_id: string | null
          slug: string
          topic: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          is_private?: boolean
          name: string
          scope: Database["public"]["Enums"]["channel_scope"]
          scope_id?: string | null
          slug: string
          topic?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          is_private?: boolean
          name?: string
          scope?: Database["public"]["Enums"]["channel_scope"]
          scope_id?: string | null
          slug?: string
          topic?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      client_account_contacts: {
        Row: {
          client_account_id: string
          contact_id: string
          created_at: string
          department: string | null
          id: string
          is_primary: boolean
          role: string
        }
        Insert: {
          client_account_id: string
          contact_id: string
          created_at?: string
          department?: string | null
          id?: string
          is_primary?: boolean
          role?: string
        }
        Update: {
          client_account_id?: string
          contact_id?: string
          created_at?: string
          department?: string | null
          id?: string
          is_primary?: boolean
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_account_contacts_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_account_members: {
        Row: {
          client_account_id: string
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          client_account_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          client_account_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_account_members_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_accounts: {
        Row: {
          account_owner_id: string | null
          address: Json | null
          billing_email: string | null
          created_at: string
          created_by: string | null
          default_folder_id: string | null
          default_template_id: string | null
          first_touch_at: string | null
          health: Database["public"]["Enums"]["client_account_health"]
          id: string
          industry: string | null
          is_private: boolean
          kind: string
          lead_source: string | null
          legal_name: string | null
          metadata: Json | null
          name: string
          notes: string | null
          owner_user_id: string | null
          primary_contact_id: string | null
          size: string | null
          source_detail: string | null
          status: Database["public"]["Enums"]["client_account_status"]
          tags: string[] | null
          tier: Database["public"]["Enums"]["client_account_tier"]
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          account_owner_id?: string | null
          address?: Json | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          default_folder_id?: string | null
          default_template_id?: string | null
          first_touch_at?: string | null
          health?: Database["public"]["Enums"]["client_account_health"]
          id?: string
          industry?: string | null
          is_private?: boolean
          kind?: string
          lead_source?: string | null
          legal_name?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          size?: string | null
          source_detail?: string | null
          status?: Database["public"]["Enums"]["client_account_status"]
          tags?: string[] | null
          tier?: Database["public"]["Enums"]["client_account_tier"]
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          account_owner_id?: string | null
          address?: Json | null
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          default_folder_id?: string | null
          default_template_id?: string | null
          first_touch_at?: string | null
          health?: Database["public"]["Enums"]["client_account_health"]
          id?: string
          industry?: string | null
          is_private?: boolean
          kind?: string
          lead_source?: string | null
          legal_name?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          size?: string | null
          source_detail?: string | null
          status?: Database["public"]["Enums"]["client_account_status"]
          tags?: string[] | null
          tier?: Database["public"]["Enums"]["client_account_tier"]
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_default_folder_id_fkey"
            columns: ["default_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accounts_default_template_id_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accounts_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_deliverables: {
        Row: {
          client_deadline: string | null
          client_instructions: string | null
          client_portal_access_id: string | null
          created_at: string
          deliverable_type: string
          downstream_task_ids: string[]
          id: string
          impact_description: string | null
          max_revisions: number
          project_id: string
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          revision_count: number
          submitted_at: string | null
          submitted_by: string | null
          submitted_content: Json | null
          task_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_deadline?: string | null
          client_instructions?: string | null
          client_portal_access_id?: string | null
          created_at?: string
          deliverable_type: string
          downstream_task_ids?: string[]
          id?: string
          impact_description?: string | null
          max_revisions?: number
          project_id: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_count?: number
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_content?: Json | null
          task_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_deadline?: string | null
          client_instructions?: string | null
          client_portal_access_id?: string | null
          created_at?: string
          deliverable_type?: string
          downstream_task_ids?: string[]
          id?: string
          impact_description?: string | null
          max_revisions?: number
          project_id?: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_count?: number
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_content?: Json | null
          task_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_deliverables_client_portal_access_id_fkey"
            columns: ["client_portal_access_id"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_deliverables_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
        ]
      }
      client_plans: {
        Row: {
          baseline: Json | null
          client_account_id: string
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_pinned: boolean
          layout: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          baseline?: Json | null
          client_account_id: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_pinned?: boolean
          layout?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          baseline?: Json | null
          client_account_id?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_pinned?: boolean
          layout?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_plans_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_access: {
        Row: {
          access_token: string
          avatar_url: string | null
          can_see_documents: boolean
          can_see_financials: boolean
          can_see_invoices: boolean
          can_see_team_names: boolean
          can_see_timeline: boolean
          company: string | null
          created_at: string
          custom_brand_color: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          is_active: boolean
          last_login_at: string | null
          name: string
          project_id: string
          role: string
          token_expires_at: string | null
          updated_at: string
          visible_task_types: string[]
          workspace_id: string
        }
        Insert: {
          access_token?: string
          avatar_url?: string | null
          can_see_documents?: boolean
          can_see_financials?: boolean
          can_see_invoices?: boolean
          can_see_team_names?: boolean
          can_see_timeline?: boolean
          company?: string | null
          created_at?: string
          custom_brand_color?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_active?: boolean
          last_login_at?: string | null
          name: string
          project_id: string
          role?: string
          token_expires_at?: string | null
          updated_at?: string
          visible_task_types?: string[]
          workspace_id: string
        }
        Update: {
          access_token?: string
          avatar_url?: string | null
          can_see_documents?: boolean
          can_see_financials?: boolean
          can_see_invoices?: boolean
          can_see_team_names?: boolean
          can_see_timeline?: boolean
          company?: string | null
          created_at?: string
          custom_brand_color?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_active?: boolean
          last_login_at?: string | null
          name?: string
          project_id?: string
          role?: string
          token_expires_at?: string | null
          updated_at?: string
          visible_task_types?: string[]
          workspace_id?: string
        }
        Relationships: []
      }
      client_portal_pulse: {
        Row: {
          avg_response_time_hrs: number | null
          client_account_id: string
          docs_uploaded_7d: number
          engagement_score: number
          last_activity_at: string | null
          last_login_at: string | null
          open_client_tasks: number
          score_breakdown: Json
          tasks_completed_7d: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avg_response_time_hrs?: number | null
          client_account_id: string
          docs_uploaded_7d?: number
          engagement_score?: number
          last_activity_at?: string | null
          last_login_at?: string | null
          open_client_tasks?: number
          score_breakdown?: Json
          tasks_completed_7d?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avg_response_time_hrs?: number | null
          client_account_id?: string
          docs_uploaded_7d?: number
          engagement_score?: number
          last_activity_at?: string | null
          last_login_at?: string | null
          open_client_tasks?: number
          score_breakdown?: Json
          tasks_completed_7d?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_pulse_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: true
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_pulse_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_request_activity: {
        Row: {
          actor_name: string | null
          actor_type: string
          bundle_id: string
          created_at: string
          detail: Json | null
          event: string
          id: string
          workspace_id: string
        }
        Insert: {
          actor_name?: string | null
          actor_type: string
          bundle_id: string
          created_at?: string
          detail?: Json | null
          event: string
          id?: string
          workspace_id: string
        }
        Update: {
          actor_name?: string | null
          actor_type?: string
          bundle_id?: string
          created_at?: string
          detail?: Json | null
          event?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_request_activity_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "client_request_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_request_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_request_bundles: {
        Row: {
          ai_summary: string | null
          client_account_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          instructions: string | null
          project_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          sent_at: string | null
          share_token: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_summary?: string | null
          client_account_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          project_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          share_token?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_summary?: string | null
          client_account_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          project_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          share_token?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_request_bundles_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_request_bundles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_request_bundles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_request_items: {
        Row: {
          bundle_id: string
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          item_type: string
          label: string
          response_decision: string | null
          response_files: Json
          response_link: string | null
          response_text: string | null
          sort_order: number
          status: string
          submitted_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bundle_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          item_type?: string
          label: string
          response_decision?: string | null
          response_files?: Json
          response_link?: string | null
          response_text?: string | null
          sort_order?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          item_type?: string
          label?: string
          response_decision?: string | null
          response_files?: Json
          response_link?: string | null
          response_text?: string | null
          sort_order?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_request_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "client_request_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_request_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: Json
          created_at: string
          id: string
          mentions: string[]
          parent_id: string | null
          reactions: Json
          resolved_at: string | null
          resolved_by: string | null
          task_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_id: string
          content: Json
          created_at?: string
          id?: string
          mentions?: string[]
          parent_id?: string | null
          reactions?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          task_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          content?: Json
          created_at?: string
          id?: string
          mentions?: string[]
          parent_id?: string | null
          reactions?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          task_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tags: string[]
          title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_account_id: string
          contract_type: string
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          effective_end: string | null
          effective_start: string | null
          file_url: string | null
          id: string
          metadata: Json
          notes: string | null
          project_id: string | null
          signed_date: string | null
          status: string
          title: string
          updated_at: string
          value: number | null
          workspace_id: string
        }
        Insert: {
          client_account_id: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          effective_end?: string | null
          effective_start?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          project_id?: string | null
          signed_date?: string | null
          status?: string
          title: string
          updated_at?: string
          value?: number | null
          workspace_id: string
        }
        Update: {
          client_account_id?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          effective_end?: string | null
          effective_start?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          project_id?: string | null
          signed_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_responses: {
        Row: {
          client_portal_access_id: string | null
          comment: string | null
          created_at: string
          id: string
          milestone_id: string | null
          project_id: string
          respondent_email: string | null
          respondent_name: string | null
          score: number
          source: string
          status_update_id: string | null
          workspace_id: string
        }
        Insert: {
          client_portal_access_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          milestone_id?: string | null
          project_id: string
          respondent_email?: string | null
          respondent_name?: string | null
          score: number
          source?: string
          status_update_id?: string | null
          workspace_id: string
        }
        Update: {
          client_portal_access_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          milestone_id?: string | null
          project_id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          score?: number
          source?: string
          status_update_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csat_responses_client_portal_access_id_fkey"
            columns: ["client_portal_access_id"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_responses_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_responses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_status_update_fkey"
            columns: ["status_update_id"]
            isOneToOne: false
            referencedRelation: "project_status_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_defs: {
        Row: {
          created_at: string
          default_value: Json | null
          field_type: Database["public"]["Enums"]["field_type"]
          formula_expr: string | null
          help_text: string | null
          id: string
          is_required: boolean
          is_visible_in_table: boolean
          lookup_config: Json | null
          name: string
          object_type_id: string | null
          options: Json | null
          order_index: number
          rollup_config: Json | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_value?: Json | null
          field_type: Database["public"]["Enums"]["field_type"]
          formula_expr?: string | null
          help_text?: string | null
          id?: string
          is_required?: boolean
          is_visible_in_table?: boolean
          lookup_config?: Json | null
          name: string
          object_type_id?: string | null
          options?: Json | null
          order_index?: number
          rollup_config?: Json | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_value?: Json | null
          field_type?: Database["public"]["Enums"]["field_type"]
          formula_expr?: string | null
          help_text?: string | null
          id?: string
          is_required?: boolean
          is_visible_in_table?: boolean
          lookup_config?: Json | null
          name?: string
          object_type_id?: string | null
          options?: Json | null
          order_index?: number
          rollup_config?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_defs_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_defs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_record_relations: {
        Row: {
          created_at: string
          created_by: string | null
          from_record_id: string
          id: string
          relation_key: string
          to_record_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_record_id: string
          id?: string
          relation_key?: string
          to_record_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_record_id?: string
          id?: string
          relation_key?: string
          to_record_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_record_relations_from_record_id_fkey"
            columns: ["from_record_id"]
            isOneToOne: false
            referencedRelation: "custom_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_record_relations_to_record_id_fkey"
            columns: ["to_record_id"]
            isOneToOne: false
            referencedRelation: "custom_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_record_relations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_records: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          object_type_id: string
          owner_id: string | null
          parent_record_id: string | null
          project_id: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          values: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          object_type_id: string
          owner_id?: string | null
          parent_record_id?: string | null
          project_id?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          values?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          object_type_id?: string
          owner_id?: string | null
          parent_record_id?: string | null
          project_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          values?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_records_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_records_parent_record_id_fkey"
            columns: ["parent_record_id"]
            isOneToOne: false
            referencedRelation: "custom_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          activity_type: string
          author_id: string | null
          content: string
          created_at: string
          deal_id: string
          id: string
          metadata: Json
          workspace_id: string
        }
        Insert: {
          activity_type?: string
          author_id?: string | null
          content: string
          created_at?: string
          deal_id: string
          id?: string
          metadata?: Json
          workspace_id: string
        }
        Update: {
          activity_type?: string
          author_id?: string | null
          content?: string
          created_at?: string
          deal_id?: string
          id?: string
          metadata?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_assumptions: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          text: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          text: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_assumptions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_assumptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          contact_id: string
          created_at: string
          deal_id: string
          id: string
          is_primary: boolean
          notes: string | null
          role: string
          stakeholder_role: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          deal_id: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string
          stakeholder_role?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string
          stakeholder_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          depends_on_deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          status: string
          title: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          depends_on_deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          depends_on_deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_dependencies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_dependencies_depends_on_deal_id_fkey"
            columns: ["depends_on_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_milestones: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          description: string | null
          id: string
          position: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          id?: string
          position?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          position?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_milestones_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_milestones_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_phases: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          description: string | null
          duration_weeks: number | null
          id: string
          name: string
          position: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          name: string
          position?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_phases_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_phases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_quote_options: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string
          id: string
          is_selected: boolean
          label: string
          notes: string | null
          pricing_model: string
          terms: string | null
          total_value: number | null
          updated_at: string
          win_probability: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id: string
          id?: string
          is_selected?: boolean
          label: string
          notes?: string | null
          pricing_model?: string
          terms?: string | null
          total_value?: number | null
          updated_at?: string
          win_probability?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string
          id?: string
          is_selected?: boolean
          label?: string
          notes?: string | null
          pricing_model?: string
          terms?: string | null
          total_value?: number | null
          updated_at?: string
          win_probability?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_quote_options_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_quote_options_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_requirements: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          description: string | null
          id: string
          owner_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_requirements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_resources: {
        Row: {
          assignee_user_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          hourly_rate: number | null
          hours: number | null
          id: string
          is_external: boolean
          notes: string | null
          role: string
          updated_at: string
          vendor_name: string | null
          workspace_id: string
        }
        Insert: {
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          is_external?: boolean
          notes?: string | null
          role: string
          updated_at?: string
          vendor_name?: string | null
          workspace_id: string
        }
        Update: {
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          is_external?: boolean
          notes?: string | null
          role?: string
          updated_at?: string
          vendor_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_resources_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_sprints: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          end_date: string | null
          goal: string | null
          id: string
          name: string
          position: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          end_date?: string | null
          goal?: string | null
          id?: string
          name: string
          position?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          name?: string
          position?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_sprints_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          auto_create_engagement: boolean
          color: string
          created_at: string
          default_probability: number
          id: string
          name: string
          order_index: number
          stage_type: string
          workspace_id: string
        }
        Insert: {
          auto_create_engagement?: boolean
          color?: string
          created_at?: string
          default_probability?: number
          id?: string
          name: string
          order_index?: number
          stage_type?: string
          workspace_id: string
        }
        Update: {
          auto_create_engagement?: boolean
          color?: string
          created_at?: string
          default_probability?: number
          id?: string
          name?: string
          order_index?: number
          stage_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_tasks: {
        Row: {
          assignee_user_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          description: string | null
          due_date: string | null
          estimate_hours: number | null
          id: string
          milestone_id: string | null
          phase_id: string | null
          position: number
          priority: string
          sprint_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          milestone_id?: string | null
          phase_id?: string | null
          position?: number
          priority?: string
          sprint_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          milestone_id?: string | null
          phase_id?: string | null
          position?: number
          priority?: string
          sprint_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "deal_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "deal_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "deal_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_account_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          expected_close_date: string | null
          handed_off_at: string | null
          handed_off_project_id: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          owner_id: string | null
          position: number
          probability: number
          source: string | null
          stage_id: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          value: number | null
          won_at: string | null
          workspace_id: string
        }
        Insert: {
          client_account_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          handed_off_at?: string | null
          handed_off_project_id?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_id?: string | null
          position?: number
          probability?: number
          source?: string | null
          stage_id: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          value?: number | null
          won_at?: string | null
          workspace_id: string
        }
        Update: {
          client_account_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          handed_off_at?: string | null
          handed_off_project_id?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_id?: string | null
          position?: number
          probability?: number
          source?: string | null
          stage_id?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          value?: number | null
          won_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_agent_runs: {
        Row: {
          cost_estimate: number | null
          created_at: string
          created_by: string | null
          deliverable_id: string | null
          deliverable_version_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          prompt: string | null
          section_key: string | null
          started_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          deliverable_id?: string | null
          deliverable_version_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          prompt?: string | null
          section_key?: string | null
          started_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string
          created_by?: string | null
          deliverable_id?: string | null
          deliverable_version_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          prompt?: string | null
          section_key?: string | null
          started_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_agent_runs_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_agent_runs_deliverable_version_id_fkey"
            columns: ["deliverable_version_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_comments: {
        Row: {
          author_id: string
          author_kind: string
          body: string
          created_at: string
          deliverable_id: string
          id: string
          parent_id: string | null
          range_end: number | null
          range_start: number | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          section_key: string | null
          updated_at: string
          version_id: string | null
          workspace_id: string
        }
        Insert: {
          author_id: string
          author_kind?: string
          body: string
          created_at?: string
          deliverable_id: string
          id?: string
          parent_id?: string | null
          range_end?: number | null
          range_start?: number | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          section_key?: string | null
          updated_at?: string
          version_id?: string | null
          workspace_id: string
        }
        Update: {
          author_id?: string
          author_kind?: string
          body?: string
          created_at?: string
          deliverable_id?: string
          id?: string
          parent_id?: string | null
          range_end?: number | null
          range_start?: number | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          section_key?: string | null
          updated_at?: string
          version_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_comments_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "deliverable_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_comments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_share_links: {
        Row: {
          access: string
          created_at: string
          created_by: string | null
          deliverable_id: string
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          recipient_email: string | null
          revoked_at: string | null
          token: string
          version_id: string | null
          view_count: number
          workspace_id: string
        }
        Insert: {
          access?: string
          created_at?: string
          created_by?: string | null
          deliverable_id: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token: string
          version_id?: string | null
          view_count?: number
          workspace_id: string
        }
        Update: {
          access?: string
          created_at?: string
          created_by?: string | null
          deliverable_id?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token?: string
          version_id?: string | null
          view_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_share_links_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_share_links_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_share_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_deliverable_agent_runs: {
        Row: {
          created_at: string
          created_by: string | null
          deliverable_id: string
          error: string | null
          id: string
          instruction: string | null
          model: string | null
          section_key: string | null
          status: string
          tokens_input: number | null
          tokens_output: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deliverable_id: string
          error?: string | null
          id?: string
          instruction?: string | null
          model?: string | null
          section_key?: string | null
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deliverable_id?: string
          error?: string | null
          id?: string
          instruction?: string | null
          model?: string | null
          section_key?: string | null
          status?: string
          tokens_input?: number | null
          tokens_output?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_deliverable_agent_runs_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverable_agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_deliverable_comments: {
        Row: {
          author_email: string | null
          author_name: string | null
          author_user_id: string | null
          body: string
          created_at: string
          deliverable_id: string
          id: string
          is_resolved: boolean
          parent_id: string | null
          section_key: string | null
          updated_at: string
          version_id: string | null
          workspace_id: string
        }
        Insert: {
          author_email?: string | null
          author_name?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          deliverable_id: string
          id?: string
          is_resolved?: boolean
          parent_id?: string | null
          section_key?: string | null
          updated_at?: string
          version_id?: string | null
          workspace_id: string
        }
        Update: {
          author_email?: string | null
          author_name?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          deliverable_id?: string
          id?: string
          is_resolved?: boolean
          parent_id?: string | null
          section_key?: string | null
          updated_at?: string
          version_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_deliverable_comments_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverable_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverable_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverable_comments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverable_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_deliverable_share_links: {
        Row: {
          access: string
          created_at: string
          created_by: string | null
          deliverable_id: string
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          recipient_email: string | null
          revoked_at: string | null
          token: string
          version_id: string | null
          view_count: number
          workspace_id: string
        }
        Insert: {
          access?: string
          created_at?: string
          created_by?: string | null
          deliverable_id: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token?: string
          version_id?: string | null
          view_count?: number
          workspace_id: string
        }
        Update: {
          access?: string
          created_at?: string
          created_by?: string | null
          deliverable_id?: string
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token?: string
          version_id?: string | null
          view_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_deliverable_share_links_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverable_share_links_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverable_share_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_deliverable_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_model: string | null
          description: string | null
          id: string
          is_default: boolean
          is_system: boolean
          kind: string
          name: string
          schema: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_model?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean
          kind: string
          name: string
          schema?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_model?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean
          kind?: string
          name?: string
          schema?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_deliverable_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_deliverable_versions: {
        Row: {
          ai_model: string | null
          content: Json
          created_at: string
          created_by: string | null
          deliverable_id: string
          id: string
          summary: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          ai_model?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          deliverable_id: string
          id?: string
          summary?: string | null
          version: number
          workspace_id: string
        }
        Update: {
          ai_model?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          deliverable_id?: string
          id?: string
          summary?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverable_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_deliverables: {
        Row: {
          created_at: string
          created_by: string | null
          current_version_id: string | null
          id: string
          kind: string
          owner_id: string | null
          project_id: string
          status: string
          template_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          kind: string
          owner_id?: string | null
          project_id: string
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          project_id?: string
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_deliverables_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "delivery_deliverable_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_deliverables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_briefs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
          business_goals: string | null
          citations: Json
          compliance_requirements: string | null
          constraints: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          deliverables: Json
          desired_launch_date: string | null
          desired_start_date: string | null
          generated_by_agent_run_id: string | null
          id: string
          integrations: string[]
          key_features: Json
          non_functional_requirements: string | null
          platforms: string[]
          risks: Json
          scope_summary: string | null
          source_document_ids: string[]
          stakeholders: Json
          status: string
          success_metrics: string | null
          target_users: string | null
          tech_preferences: string | null
          technical_requirements: string | null
          timeline_weeks: number | null
          unknowns: Json
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          business_goals?: string | null
          citations?: Json
          compliance_requirements?: string | null
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          deliverables?: Json
          desired_launch_date?: string | null
          desired_start_date?: string | null
          generated_by_agent_run_id?: string | null
          id?: string
          integrations?: string[]
          key_features?: Json
          non_functional_requirements?: string | null
          platforms?: string[]
          risks?: Json
          scope_summary?: string | null
          source_document_ids?: string[]
          stakeholders?: Json
          status?: string
          success_metrics?: string | null
          target_users?: string | null
          tech_preferences?: string | null
          technical_requirements?: string | null
          timeline_weeks?: number | null
          unknowns?: Json
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          business_goals?: string | null
          citations?: Json
          compliance_requirements?: string | null
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          deliverables?: Json
          desired_launch_date?: string | null
          desired_start_date?: string | null
          generated_by_agent_run_id?: string | null
          id?: string
          integrations?: string[]
          key_features?: Json
          non_functional_requirements?: string | null
          platforms?: string[]
          risks?: Json
          scope_summary?: string | null
          source_document_ids?: string[]
          stakeholders?: Json
          status?: string
          success_metrics?: string | null
          target_users?: string | null
          tech_preferences?: string | null
          technical_requirements?: string | null
          timeline_weeks?: number | null
          unknowns?: Json
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_briefs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_briefs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_handovers: {
        Row: {
          created_at: string
          created_by: string | null
          current_agent_run_id: string | null
          deal_id: string
          gate_history: Json
          id: string
          pending_approver_role: string | null
          project_id: string | null
          stage: Database["public"]["Enums"]["handover_stage"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_agent_run_id?: string | null
          deal_id: string
          gate_history?: Json
          id?: string
          pending_approver_role?: string | null
          project_id?: string | null
          stage?: Database["public"]["Enums"]["handover_stage"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_agent_run_id?: string | null
          deal_id?: string
          gate_history?: Json
          id?: string
          pending_approver_role?: string | null
          project_id?: string | null
          stage?: Database["public"]["Enums"]["handover_stage"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_handovers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_handovers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_handovers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_phases: {
        Row: {
          color: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          exit_criteria: Json
          icon: string | null
          id: string
          is_terminal: boolean
          key: string
          name: string
          order_index: number
          owner_role: string | null
          project_id: string
          started_at: string | null
          status: string
          target_days: number | null
          template_phase_id: string | null
          workspace_id: string
        }
        Insert: {
          color?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          exit_criteria?: Json
          icon?: string | null
          id?: string
          is_terminal?: boolean
          key: string
          name: string
          order_index?: number
          owner_role?: string | null
          project_id: string
          started_at?: string | null
          status?: string
          target_days?: number | null
          template_phase_id?: string | null
          workspace_id: string
        }
        Update: {
          color?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          exit_criteria?: Json
          icon?: string | null
          id?: string
          is_terminal?: boolean
          key?: string
          name?: string
          order_index?: number
          owner_role?: string | null
          project_id?: string
          started_at?: string | null
          status?: string
          target_days?: number | null
          template_phase_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_phases_template_phase_id_fkey"
            columns: ["template_phase_id"]
            isOneToOne: false
            referencedRelation: "template_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_phases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_links: {
        Row: {
          created_at: string
          created_by: string | null
          from_id: string
          from_kind: string
          id: string
          note: string | null
          relation: string | null
          to_id: string
          to_kind: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_id: string
          from_kind: string
          id?: string
          note?: string | null
          relation?: string | null
          to_id: string
          to_kind: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_id?: string
          from_kind?: string
          id?: string
          note?: string | null
          relation?: string | null
          to_id?: string
          to_kind?: string
          workspace_id?: string
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          route: string | null
          severity: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          route?: string | null
          severity?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          route?: string | null
          severity?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          actions: Json
          conditions: Json
          cooldown_hours: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          tier: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          tier: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tier?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      escalations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_plan: Json
          created_at: string
          created_task_id: string | null
          detail: string | null
          id: string
          impact: Json
          project_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string | null
          status: string
          tier: number
          title: string
          triggered_by: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_plan?: Json
          created_at?: string
          created_task_id?: string | null
          detail?: string | null
          id?: string
          impact?: Json
          project_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          status?: string
          tier: number
          title: string
          triggered_by?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_plan?: Json
          created_at?: string
          created_task_id?: string | null
          detail?: string | null
          id?: string
          impact?: Json
          project_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          status?: string
          tier?: number
          title?: string
          triggered_by?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          currency: string
          description: string
          id: string
          incurred_on: string
          invoice_id: string | null
          is_billable: boolean
          notes: string | null
          project_id: string
          receipt_url: string | null
          status: string
          submitted_by: string
          task_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          currency?: string
          description: string
          id?: string
          incurred_on?: string
          invoice_id?: string | null
          is_billable?: boolean
          notes?: string | null
          project_id: string
          receipt_url?: string | null
          status?: string
          submitted_by: string
          task_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          incurred_on?: string
          invoice_id?: string | null
          is_billable?: boolean
          notes?: string | null
          project_id?: string
          receipt_url?: string | null
          status?: string
          submitted_by?: string
          task_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      folder_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          folder_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["folder_role"]
          status: string
          token: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          folder_id: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["folder_role"]
          status?: string
          token?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          folder_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["folder_role"]
          status?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_invitations_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_members: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          role: Database["public"]["Enums"]["folder_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          role?: Database["public"]["Enums"]["folder_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          role?: Database["public"]["Enums"]["folder_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_members_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          archived_at: string | null
          client_account_id: string | null
          client_company: string | null
          client_email: string | null
          color: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          folder_type: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          parent_id: string | null
          portal_enabled: boolean
          sort_order: number
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          client_account_id?: string | null
          client_company?: string | null
          client_email?: string | null
          color?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          folder_type?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          parent_id?: string | null
          portal_enabled?: boolean
          sort_order?: number
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          client_account_id?: string | null
          client_company?: string | null
          client_email?: string | null
          color?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          folder_type?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          parent_id?: string | null
          portal_enabled?: boolean
          sort_order?: number
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_checklist_items: {
        Row: {
          artifact_url: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_complete: boolean
          is_required: boolean
          label: string
          notes: string | null
          order_index: number
          packet_id: string
        }
        Insert: {
          artifact_url?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          is_required?: boolean
          label: string
          notes?: string | null
          order_index?: number
          packet_id: string
        }
        Update: {
          artifact_url?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_complete?: boolean
          is_required?: boolean
          label?: string
          notes?: string | null
          order_index?: number
          packet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_checklist_items_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "handover_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_packets: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          artifacts: Json | null
          created_at: string
          created_by: string | null
          from_team: Database["public"]["Enums"]["handover_team"]
          id: string
          onboarding_id: string | null
          project_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          risks: string | null
          scope: string | null
          stakeholders: Json | null
          status: Database["public"]["Enums"]["handover_status"]
          submitted_at: string | null
          submitted_by: string | null
          summary: string | null
          to_team: Database["public"]["Enums"]["handover_team"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          artifacts?: Json | null
          created_at?: string
          created_by?: string | null
          from_team: Database["public"]["Enums"]["handover_team"]
          id?: string
          onboarding_id?: string | null
          project_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          risks?: string | null
          scope?: string | null
          stakeholders?: Json | null
          status?: Database["public"]["Enums"]["handover_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          to_team: Database["public"]["Enums"]["handover_team"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          artifacts?: Json | null
          created_at?: string
          created_by?: string | null
          from_team?: Database["public"]["Enums"]["handover_team"]
          id?: string
          onboarding_id?: string | null
          project_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          risks?: string | null
          scope?: string | null
          stakeholders?: Json | null
          status?: Database["public"]["Enums"]["handover_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          to_team?: Database["public"]["Enums"]["handover_team"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_packets_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "onboardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_packets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_packets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_form_responses: {
        Row: {
          answers: Json
          client_portal_access_id: string | null
          created_at: string
          form_id: string
          id: string
          project_id: string
          respondent_email: string | null
          respondent_name: string | null
          submitted_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          answers?: Json
          client_portal_access_id?: string | null
          created_at?: string
          form_id: string
          id?: string
          project_id: string
          respondent_email?: string | null
          respondent_name?: string | null
          submitted_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          answers?: Json
          client_portal_access_id?: string | null
          created_at?: string
          form_id?: string
          id?: string
          project_id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          submitted_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_form_responses_client_portal_access_id_fkey"
            columns: ["client_portal_access_id"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "intake_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_responses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_form_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_forms: {
        Row: {
          allow_anonymous: boolean
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          id: string
          project_id: string
          status: string
          title: string
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          allow_anonymous?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          allow_anonymous?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          source_id: string | null
          source_kind: string
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          source_id?: string | null
          source_kind?: string
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          source_id?: string | null
          source_kind?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          client_address: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          project_id: string
          sent_at: string | null
          share_token: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount_paid?: number
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          project_id: string
          sent_at?: string | null
          share_token?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount_paid?: number
          client_address?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          project_id?: string
          sent_at?: string | null
          share_token?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      meeting_action_items: {
        Row: {
          assigned_agent_id: string | null
          assignee_guess_name: string | null
          assignee_guess_user_id: string | null
          context_quote: string | null
          converted_task_id: string | null
          created_at: string
          due_guess: string | null
          id: string
          meeting_id: string
          original_text: string
          position: number
          priority_guess: string | null
          status: string
          summary: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assignee_guess_name?: string | null
          assignee_guess_user_id?: string | null
          context_quote?: string | null
          converted_task_id?: string | null
          created_at?: string
          due_guess?: string | null
          id?: string
          meeting_id: string
          original_text: string
          position?: number
          priority_guess?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          assignee_guess_name?: string | null
          assignee_guess_user_id?: string | null
          context_quote?: string | null
          converted_task_id?: string | null
          created_at?: string
          due_guess?: string | null
          id?: string
          meeting_id?: string
          original_text?: string
          position?: number
          priority_guess?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          email: string
          id: string
          meeting_id: string
          name: string | null
          role: string | null
          speaking_time_seconds: number | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          meeting_id: string
          name?: string | null
          role?: string | null
          speaking_time_seconds?: number | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          meeting_id?: string
          name?: string | null
          role?: string | null
          speaking_time_seconds?: number | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          action_items: Json
          actual_end: string | null
          actual_start: string | null
          ai_error: string | null
          ai_model: string | null
          ai_status: string
          audio_path: string | null
          auto_capture_enabled: boolean
          calendar_event_id: string | null
          conference_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          organizer_id: string | null
          participant_emails: string[]
          platform: string
          project_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          summary: Json | null
          title: string
          topics: Json
          transcript: Json | null
          transcript_raw_text: string | null
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          action_items?: Json
          actual_end?: string | null
          actual_start?: string | null
          ai_error?: string | null
          ai_model?: string | null
          ai_status?: string
          audio_path?: string | null
          auto_capture_enabled?: boolean
          calendar_event_id?: string | null
          conference_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          organizer_id?: string | null
          participant_emails?: string[]
          platform?: string
          project_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          summary?: Json | null
          title: string
          topics?: Json
          transcript?: Json | null
          transcript_raw_text?: string | null
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          action_items?: Json
          actual_end?: string | null
          actual_start?: string | null
          ai_error?: string | null
          ai_model?: string | null
          ai_status?: string
          audio_path?: string | null
          auto_capture_enabled?: boolean
          calendar_event_id?: string | null
          conference_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          organizer_id?: string | null
          participant_emails?: string[]
          platform?: string
          project_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          summary?: Json | null
          title?: string
          topics?: Json
          transcript?: Json | null
          transcript_raw_text?: string | null
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_signoffs: {
        Row: {
          action: string
          actor_user_id: string | null
          client_portal_access_id: string | null
          created_at: string
          id: string
          milestone_id: string
          notes: string | null
          project_id: string
          signature_text: string | null
          signed_name: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          client_portal_access_id?: string | null
          created_at?: string
          id?: string
          milestone_id: string
          notes?: string | null
          project_id: string
          signature_text?: string | null
          signed_name?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          client_portal_access_id?: string | null
          created_at?: string
          id?: string
          milestone_id?: string
          notes?: string | null
          project_id?: string
          signature_text?: string | null
          signed_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_signoffs_client_portal_access_id_fkey"
            columns: ["client_portal_access_id"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_signoffs_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          actual_date: string | null
          completion_criteria: string | null
          created_at: string
          created_by: string | null
          csat_requested_at: string | null
          depends_on_ids: string[]
          description: string | null
          id: string
          is_paid: boolean
          milestone_type: string
          name: string
          order_index: number
          payment_amount: number | null
          payment_currency: string | null
          project_id: string
          request_csat: boolean
          requires_signoff: boolean
          signoff_notes: string | null
          signoff_rejection_reason: string | null
          signoff_requested_at: string | null
          signoff_requested_by: string | null
          signoff_signature_text: string | null
          signoff_signed_at: string | null
          signoff_signed_by_portal_access_id: string | null
          signoff_signed_name: string | null
          signoff_status: string
          status: string
          target_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_date?: string | null
          completion_criteria?: string | null
          created_at?: string
          created_by?: string | null
          csat_requested_at?: string | null
          depends_on_ids?: string[]
          description?: string | null
          id?: string
          is_paid?: boolean
          milestone_type?: string
          name: string
          order_index?: number
          payment_amount?: number | null
          payment_currency?: string | null
          project_id: string
          request_csat?: boolean
          requires_signoff?: boolean
          signoff_notes?: string | null
          signoff_rejection_reason?: string | null
          signoff_requested_at?: string | null
          signoff_requested_by?: string | null
          signoff_signature_text?: string | null
          signoff_signed_at?: string | null
          signoff_signed_by_portal_access_id?: string | null
          signoff_signed_name?: string | null
          signoff_status?: string
          status?: string
          target_date: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_date?: string | null
          completion_criteria?: string | null
          created_at?: string
          created_by?: string | null
          csat_requested_at?: string | null
          depends_on_ids?: string[]
          description?: string | null
          id?: string
          is_paid?: boolean
          milestone_type?: string
          name?: string
          order_index?: number
          payment_amount?: number | null
          payment_currency?: string | null
          project_id?: string
          request_csat?: boolean
          requires_signoff?: boolean
          signoff_notes?: string | null
          signoff_rejection_reason?: string | null
          signoff_requested_at?: string | null
          signoff_requested_by?: string | null
          signoff_signature_text?: string | null
          signoff_signed_at?: string | null
          signoff_signed_by_portal_access_id?: string | null
          signoff_signed_name?: string | null
          signoff_status?: string
          status?: string
          target_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_signoff_signed_by_portal_access_id_fkey"
            columns: ["signoff_signed_by_portal_access_id"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          background_color: string
          collaborator_ids: string[]
          content: Json
          converted_task_id: string | null
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          manual_order: number
          note_type: string
          pin_order: number
          project_id: string | null
          reminder_at: string | null
          title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          background_color?: string
          collaborator_ids?: string[]
          content?: Json
          converted_task_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          manual_order?: number
          note_type?: string
          pin_order?: number
          project_id?: string | null
          reminder_at?: string | null
          title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          background_color?: string
          collaborator_ids?: string[]
          content?: Json
          converted_task_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          manual_order?: number
          note_type?: string
          pin_order?: number
          project_id?: string | null
          reminder_at?: string | null
          title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          archived_at: string | null
          body: string | null
          comment_id: string | null
          created_at: string
          id: string
          link: string | null
          project_id: string | null
          read_at: string | null
          recipient_id: string
          snoozed_until: string | null
          task_id: string | null
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          archived_at?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          recipient_id: string
          snoozed_until?: string | null
          task_id?: string | null
          title: string
          type: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          archived_at?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          recipient_id?: string
          snoozed_until?: string | null
          task_id?: string | null
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: []
      }
      object_types: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          default_view_id: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          is_system: boolean
          key: string
          label: string
          plural_label: string
          sort_order: number
          system_kind: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_view_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          key: string
          label: string
          plural_label: string
          sort_order?: number
          system_kind?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_view_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          key?: string
          label?: string
          plural_label?: string
          sort_order?: number
          system_kind?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          artifact_url: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          is_blocking: boolean
          onboarding_id: string
          order_index: number
          owner_role: string | null
          owner_user_id: string | null
          status: Database["public"]["Enums"]["onboarding_step_status"]
          step_key: string
          title: string
          updated_at: string
        }
        Insert: {
          artifact_url?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_blocking?: boolean
          onboarding_id: string
          order_index?: number
          owner_role?: string | null
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["onboarding_step_status"]
          step_key: string
          title: string
          updated_at?: string
        }
        Update: {
          artifact_url?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_blocking?: boolean
          onboarding_id?: string
          order_index?: number
          owner_role?: string | null
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["onboarding_step_status"]
          step_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "onboardings"
            referencedColumns: ["id"]
          },
        ]
      }
      onboardings: {
        Row: {
          client_account_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          owner_id: string | null
          progress: number
          project_id: string | null
          stage: Database["public"]["Enums"]["onboarding_stage"]
          started_at: string
          target_go_live: string | null
          template_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_account_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          owner_id?: string | null
          progress?: number
          project_id?: string | null
          stage?: Database["public"]["Enums"]["onboarding_stage"]
          started_at?: string
          target_go_live?: string | null
          template_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_account_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          progress?: number
          project_id?: string | null
          stage?: Database["public"]["Enums"]["onboarding_stage"]
          started_at?: string
          target_go_live?: string | null
          template_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboardings_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboardings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboardings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboardings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboardings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      page_ai_suggestions: {
        Row: {
          created_at: string
          created_by: string | null
          explanation: string | null
          id: string
          original_text: string | null
          page_id: string
          position_path: string | null
          proposed_content: Json | null
          proposed_text: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          suggestion_type: string
          version_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          explanation?: string | null
          id?: string
          original_text?: string | null
          page_id: string
          position_path?: string | null
          proposed_content?: Json | null
          proposed_text?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggestion_type: string
          version_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          explanation?: string | null
          id?: string
          original_text?: string | null
          page_id?: string
          position_path?: string | null
          proposed_content?: Json | null
          proposed_text?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggestion_type?: string
          version_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_ai_suggestions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_ai_suggestions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "page_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      page_ai_threads: {
        Row: {
          created_at: string
          id: string
          messages: Json
          page_id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          page_id: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          page_id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_ai_threads_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_block_attributions: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          block_id: string
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          page_id: string
          prompt: string | null
          reasoning: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          block_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          page_id: string
          prompt?: string | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          block_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          page_id?: string
          prompt?: string | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_block_attributions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_links: {
        Row: {
          created_at: string
          id: string
          link_type: string
          source_block_id: string | null
          source_page_id: string
          target_page_id: string | null
          target_project_id: string | null
          target_task_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_type?: string
          source_block_id?: string | null
          source_page_id: string
          target_page_id?: string | null
          target_project_id?: string | null
          target_task_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: string
          source_block_id?: string | null
          source_page_id?: string
          target_page_id?: string | null
          target_project_id?: string | null
          target_task_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_links_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_links_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_revisions: {
        Row: {
          ai_model: string | null
          ai_prompt: string | null
          changes_summary: string | null
          content: Json
          created_at: string
          edited_by: string | null
          generated_by_ai: boolean
          id: string
          page_id: string
          parent_version_id: string | null
          status: string
          title: string
          version_label: string | null
          version_number: number | null
          workspace_id: string
        }
        Insert: {
          ai_model?: string | null
          ai_prompt?: string | null
          changes_summary?: string | null
          content: Json
          created_at?: string
          edited_by?: string | null
          generated_by_ai?: boolean
          id?: string
          page_id: string
          parent_version_id?: string | null
          status?: string
          title: string
          version_label?: string | null
          version_number?: number | null
          workspace_id: string
        }
        Update: {
          ai_model?: string | null
          ai_prompt?: string | null
          changes_summary?: string | null
          content?: Json
          created_at?: string
          edited_by?: string | null
          generated_by_ai?: boolean
          id?: string
          page_id?: string
          parent_version_id?: string | null
          status?: string
          title?: string
          version_label?: string | null
          version_number?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_revisions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_revisions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "page_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          ai_last_summarized_at: string | null
          ai_managed: boolean
          brand_kit_id: string | null
          client_account_id: string | null
          content: Json
          content_text: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          doc_kind: string | null
          doc_status: string
          icon: string | null
          id: string
          is_archived: boolean
          is_pinned: boolean
          is_portal_published: boolean
          is_template: boolean
          page_type: string
          parent_page_id: string | null
          portal_published_at: string | null
          portal_published_by: string | null
          scope: string
          scope_id: string | null
          sort_order: number
          template_source_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          ai_last_summarized_at?: string | null
          ai_managed?: boolean
          brand_kit_id?: string | null
          client_account_id?: string | null
          content?: Json
          content_text?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          doc_kind?: string | null
          doc_status?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          is_portal_published?: boolean
          is_template?: boolean
          page_type?: string
          parent_page_id?: string | null
          portal_published_at?: string | null
          portal_published_by?: string | null
          scope?: string
          scope_id?: string | null
          sort_order?: number
          template_source_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          ai_last_summarized_at?: string | null
          ai_managed?: boolean
          brand_kit_id?: string | null
          client_account_id?: string | null
          content?: Json
          content_text?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          doc_kind?: string | null
          doc_status?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          is_portal_published?: boolean
          is_template?: boolean
          page_type?: string
          parent_page_id?: string | null
          portal_published_at?: string | null
          portal_published_by?: string | null
          scope?: string
          scope_id?: string | null
          sort_order?: number
          template_source_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_brand_kit_fk"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_page_id_fkey"
            columns: ["parent_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_template_source_id_fkey"
            columns: ["template_source_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_milestones: {
        Row: {
          created_at: string
          day_offset: number
          description: string | null
          id: string
          milestone_type: string
          name: string
          order_index: number
          playbook_id: string
          requires_signoff: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          day_offset?: number
          description?: string | null
          id?: string
          milestone_type?: string
          name: string
          order_index?: number
          playbook_id: string
          requires_signoff?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          day_offset?: number
          description?: string | null
          id?: string
          milestone_type?: string
          name?: string
          order_index?: number
          playbook_id?: string
          requires_signoff?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_milestones_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "project_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_milestones_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_tasks: {
        Row: {
          assignee_role_hint: string | null
          created_at: string
          day_offset_due: number | null
          day_offset_start: number | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_customer_task: boolean
          order_index: number
          playbook_id: string
          playbook_milestone_id: string | null
          priority: string
          tags: string[] | null
          task_type: string
          title: string
          workspace_id: string
        }
        Insert: {
          assignee_role_hint?: string | null
          created_at?: string
          day_offset_due?: number | null
          day_offset_start?: number | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_customer_task?: boolean
          order_index?: number
          playbook_id: string
          playbook_milestone_id?: string | null
          priority?: string
          tags?: string[] | null
          task_type?: string
          title: string
          workspace_id: string
        }
        Update: {
          assignee_role_hint?: string | null
          created_at?: string
          day_offset_due?: number | null
          day_offset_start?: number | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_customer_task?: boolean
          order_index?: number
          playbook_id?: string
          playbook_milestone_id?: string | null
          priority?: string
          tags?: string[] | null
          task_type?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_tasks_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "project_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_tasks_playbook_milestone_id_fkey"
            columns: ["playbook_milestone_id"]
            isOneToOne: false
            referencedRelation: "playbook_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_activity_log: {
        Row: {
          activity_type: string
          client_account_id: string | null
          client_ip: unknown
          client_portal_access_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          metadata: Json
          portal_session_id: string | null
          project_id: string | null
          requires_response: boolean
          responded_at: string | null
          routed_to_user_id: string | null
          seen_by_user_ids: string[]
          unblocks_internal: boolean
          workspace_id: string
        }
        Insert: {
          activity_type: string
          client_account_id?: string | null
          client_ip?: unknown
          client_portal_access_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          portal_session_id?: string | null
          project_id?: string | null
          requires_response?: boolean
          responded_at?: string | null
          routed_to_user_id?: string | null
          seen_by_user_ids?: string[]
          unblocks_internal?: boolean
          workspace_id: string
        }
        Update: {
          activity_type?: string
          client_account_id?: string | null
          client_ip?: unknown
          client_portal_access_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          portal_session_id?: string | null
          project_id?: string | null
          requires_response?: boolean
          responded_at?: string | null
          routed_to_user_id?: string | null
          seen_by_user_ids?: string[]
          unblocks_internal?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_activity_log_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_activity_log_client_portal_access_id_fkey"
            columns: ["client_portal_access_id"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_deliverable_comments: {
        Row: {
          author_kind: string
          author_name: string
          author_portal_access_id: string | null
          author_user_id: string | null
          body: string
          created_at: string
          deliverable_id: string
          id: string
          project_id: string
          workspace_id: string
        }
        Insert: {
          author_kind: string
          author_name: string
          author_portal_access_id?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          deliverable_id: string
          id?: string
          project_id: string
          workspace_id: string
        }
        Update: {
          author_kind?: string
          author_name?: string
          author_portal_access_id?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          deliverable_id?: string
          id?: string
          project_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_deliverable_comments_author_portal_access_id_fkey"
            columns: ["author_portal_access_id"]
            isOneToOne: false
            referencedRelation: "client_portal_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_deliverable_comments_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string | null
          accomplishments: Json
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          default_landing: string | null
          display_name: string | null
          headline: string | null
          id: string
          links: Json
          location: string | null
          primary_role: Database["public"]["Enums"]["user_primary_role"]
          pronouns: string | null
          skills: string[]
          theme_preference: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          accomplishments?: Json
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          default_landing?: string | null
          display_name?: string | null
          headline?: string | null
          id: string
          links?: Json
          location?: string | null
          primary_role?: Database["public"]["Enums"]["user_primary_role"]
          pronouns?: string | null
          skills?: string[]
          theme_preference?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          accomplishments?: Json
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          default_landing?: string | null
          display_name?: string | null
          headline?: string | null
          id?: string
          links?: Json
          location?: string | null
          primary_role?: Database["public"]["Enums"]["user_primary_role"]
          pronouns?: string | null
          skills?: string[]
          theme_preference?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_baselines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          milestones_snapshot: Json
          name: string
          notes: string | null
          project_id: string
          start_date: string | null
          target_end_date: string | null
          tasks_snapshot: Json
          total_budget_amount: number | null
          total_budget_hours: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          milestones_snapshot?: Json
          name?: string
          notes?: string | null
          project_id: string
          start_date?: string | null
          target_end_date?: string | null
          tasks_snapshot?: Json
          total_budget_amount?: number | null
          total_budget_hours?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          milestones_snapshot?: Json
          name?: string
          notes?: string | null
          project_id?: string
          start_date?: string | null
          target_end_date?: string | null
          tasks_snapshot?: Json
          total_budget_amount?: number | null
          total_budget_hours?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_baselines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_canvases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          project_id: string
          scene: Json
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          project_id: string
          scene?: Json
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          project_id?: string
          scene?: Json
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_canvases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_canvases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          depends_on_deal_id: string | null
          depends_on_project_id: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          status: string
          title: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          depends_on_deal_id?: string | null
          depends_on_project_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          status?: string
          title: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          depends_on_deal_id?: string | null
          depends_on_project_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_dependencies_depends_on_deal_id_fkey"
            columns: ["depends_on_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_dependencies_depends_on_project_id_fkey"
            columns: ["depends_on_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          contract_value: number | null
          created_at: string
          currency: string | null
          description: string | null
          document_type: string
          effective_date: string | null
          expiration_date: string | null
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          name: string
          previous_version_id: string | null
          project_id: string | null
          requires_nda: boolean
          signature_status: string
          signed_at: string | null
          signed_by: string | null
          updated_at: string
          uploaded_by: string | null
          version: number
          visibility: string
          workspace_id: string
        }
        Insert: {
          contract_value?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          document_type?: string
          effective_date?: string | null
          expiration_date?: string | null
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          name: string
          previous_version_id?: string | null
          project_id?: string | null
          requires_nda?: boolean
          signature_status?: string
          signed_at?: string | null
          signed_by?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          visibility?: string
          workspace_id: string
        }
        Update: {
          contract_value?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          document_type?: string
          effective_date?: string | null
          expiration_date?: string | null
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          previous_version_id?: string | null
          project_id?: string | null
          requires_nda?: boolean
          signature_status?: string
          signed_at?: string | null
          signed_by?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          visibility?: string
          workspace_id?: string
        }
        Relationships: []
      }
      project_financials: {
        Row: {
          budget_alert_thresholds: number[]
          budget_amount: number | null
          budget_hours: number | null
          contract_value: number | null
          created_at: string
          currency: string
          default_bill_rate: number | null
          default_cost_rate: number | null
          last_alerted_threshold: number | null
          notes: string | null
          project_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget_alert_thresholds?: number[]
          budget_amount?: number | null
          budget_hours?: number | null
          contract_value?: number | null
          created_at?: string
          currency?: string
          default_bill_rate?: number | null
          default_cost_rate?: number | null
          last_alerted_threshold?: number | null
          notes?: string | null
          project_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget_alert_thresholds?: number[]
          budget_amount?: number | null
          budget_hours?: number | null
          contract_value?: number | null
          created_at?: string
          currency?: string
          default_bill_rate?: number | null
          default_cost_rate?: number | null
          last_alerted_threshold?: number | null
          notes?: string | null
          project_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_overview_snapshots: {
        Row: {
          ai_model: string | null
          generated_at: string
          generated_by: string | null
          health: string | null
          id: string
          overview_id: string
          project_id: string
          sections: Json
          summary: string | null
          workspace_id: string
        }
        Insert: {
          ai_model?: string | null
          generated_at?: string
          generated_by?: string | null
          health?: string | null
          id?: string
          overview_id: string
          project_id: string
          sections?: Json
          summary?: string | null
          workspace_id: string
        }
        Update: {
          ai_model?: string | null
          generated_at?: string
          generated_by?: string | null
          health?: string | null
          id?: string
          overview_id?: string
          project_id?: string
          sections?: Json
          summary?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      project_overviews: {
        Row: {
          created_at: string
          id: string
          last_refreshed_at: string | null
          next_refresh_at: string | null
          project_id: string
          refresh_cadence: string
          refresh_error: string | null
          refresh_status: string
          sections_override: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_refreshed_at?: string | null
          next_refresh_at?: string | null
          project_id: string
          refresh_cadence?: string
          refresh_error?: string | null
          refresh_status?: string
          sections_override?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_refreshed_at?: string | null
          next_refresh_at?: string | null
          project_id?: string
          refresh_cadence?: string
          refresh_error?: string | null
          refresh_status?: string
          sections_override?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      project_playbooks: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          default_duration_days: number
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          kind: string
          name: string
          updated_at: string
          usage_count: number
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_duration_days?: number
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name: string
          updated_at?: string
          usage_count?: number
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_duration_days?: number
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name?: string
          updated_at?: string
          usage_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_raid_items: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          description: string | null
          due_date: string | null
          id: string
          impact: Database["public"]["Enums"]["raid_impact"] | null
          is_client_visible: boolean
          item_type: Database["public"]["Enums"]["raid_item_type"]
          likelihood: Database["public"]["Enums"]["raid_likelihood"] | null
          mitigation: string | null
          owner_id: string | null
          project_id: string
          status: Database["public"]["Enums"]["raid_status"]
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["raid_impact"] | null
          is_client_visible?: boolean
          item_type: Database["public"]["Enums"]["raid_item_type"]
          likelihood?: Database["public"]["Enums"]["raid_likelihood"] | null
          mitigation?: string | null
          owner_id?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["raid_status"]
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["raid_impact"] | null
          is_client_visible?: boolean
          item_type?: Database["public"]["Enums"]["raid_item_type"]
          likelihood?: Database["public"]["Enums"]["raid_likelihood"] | null
          mitigation?: string | null
          owner_id?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["raid_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_raid_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_raid_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requirements: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          owner_id: string | null
          priority: string
          project_id: string
          source: string
          source_deal_id: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          project_id: string
          source?: string
          source_deal_id?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          priority?: string
          project_id?: string
          source?: string
          source_deal_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_updates: {
        Row: {
          accomplishments: string | null
          ai_generated: boolean
          ai_model: string | null
          asks: string | null
          created_at: string
          created_by: string | null
          headline: string | null
          health: string
          id: string
          metrics: Json
          next_period: string | null
          period_end: string | null
          period_start: string | null
          project_id: string
          published_at: string | null
          published_by: string | null
          risks: string | null
          source_snapshot: Json | null
          status: string
          summary: string | null
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          accomplishments?: string | null
          ai_generated?: boolean
          ai_model?: string | null
          asks?: string | null
          created_at?: string
          created_by?: string | null
          headline?: string | null
          health?: string
          id?: string
          metrics?: Json
          next_period?: string | null
          period_end?: string | null
          period_start?: string | null
          project_id: string
          published_at?: string | null
          published_by?: string | null
          risks?: string | null
          source_snapshot?: Json | null
          status?: string
          summary?: string | null
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          accomplishments?: string | null
          ai_generated?: boolean
          ai_model?: string | null
          asks?: string | null
          created_at?: string
          created_by?: string | null
          headline?: string | null
          health?: string
          id?: string
          metrics?: Json
          next_period?: string | null
          period_end?: string | null
          period_start?: string | null
          project_id?: string
          published_at?: string | null
          published_by?: string | null
          risks?: string | null
          source_snapshot?: Json | null
          status?: string
          summary?: string | null
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_items: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["template_item_kind"]
          order_index: number
          parent_item_id: string | null
          payload: Json
          phase_key: string | null
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["template_item_kind"]
          order_index?: number
          parent_item_id?: string | null
          payload?: Json
          phase_key?: string | null
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["template_item_kind"]
          order_index?: number
          parent_item_id?: string | null
          payload?: Json
          phase_key?: string | null
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_template_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "project_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          category: Database["public"]["Enums"]["template_category"]
          created_at: string
          created_by: string | null
          default_duration_days: number | null
          default_team_shape: Json | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string
          created_by?: string | null
          default_duration_days?: number | null
          default_team_shape?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string
          created_by?: string | null
          default_duration_days?: number | null
          default_team_shape?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          billing_model: Database["public"]["Enums"]["billing_model"]
          client_account_id: string | null
          client_name: string | null
          color: string
          contract_type: string
          created_at: string
          created_by: string | null
          current_phase_id: string | null
          description: string | null
          enabled_tabs: string[] | null
          folder_id: string | null
          health: string
          icon: string
          id: string
          is_archived: boolean
          is_client_project: boolean
          is_private: boolean
          key: string | null
          lifecycle: string
          name: string
          onboarding_id: string | null
          parent_id: string | null
          phase: string
          portal_branding: Json
          position: number
          rate_card_id: string | null
          retainer_amount: number | null
          retainer_period: string | null
          settings: Json
          start_date: string | null
          target_end_date: string | null
          target_margin_pct: number | null
          template_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_model?: Database["public"]["Enums"]["billing_model"]
          client_account_id?: string | null
          client_name?: string | null
          color?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          current_phase_id?: string | null
          description?: string | null
          enabled_tabs?: string[] | null
          folder_id?: string | null
          health?: string
          icon?: string
          id?: string
          is_archived?: boolean
          is_client_project?: boolean
          is_private?: boolean
          key?: string | null
          lifecycle?: string
          name: string
          onboarding_id?: string | null
          parent_id?: string | null
          phase?: string
          portal_branding?: Json
          position?: number
          rate_card_id?: string | null
          retainer_amount?: number | null
          retainer_period?: string | null
          settings?: Json
          start_date?: string | null
          target_end_date?: string | null
          target_margin_pct?: number | null
          template_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          billing_model?: Database["public"]["Enums"]["billing_model"]
          client_account_id?: string | null
          client_name?: string | null
          color?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          current_phase_id?: string | null
          description?: string | null
          enabled_tabs?: string[] | null
          folder_id?: string | null
          health?: string
          icon?: string
          id?: string
          is_archived?: boolean
          is_client_project?: boolean
          is_private?: boolean
          key?: string | null
          lifecycle?: string
          name?: string
          onboarding_id?: string | null
          parent_id?: string | null
          phase?: string
          portal_branding?: Json
          position?: number
          rate_card_id?: string | null
          retainer_amount?: number | null
          retainer_period?: string | null
          settings?: Json
          start_date?: string | null
          target_end_date?: string | null
          target_margin_pct?: number | null
          template_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_current_phase_id_fkey"
            columns: ["current_phase_id"]
            isOneToOne: false
            referencedRelation: "engagement_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "onboardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          ai_model: string | null
          ai_prompt: string | null
          converted_at: string | null
          converted_project_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          deliverables: Json
          generated_by_ai: boolean
          id: string
          milestones: Json
          pricing: Json
          rejected_at: string | null
          scope: string | null
          sent_at: string | null
          status: string
          summary: string | null
          title: string
          total_value: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          ai_model?: string | null
          ai_prompt?: string | null
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deliverables?: Json
          generated_by_ai?: boolean
          id?: string
          milestones?: Json
          pricing?: Json
          rejected_at?: string | null
          scope?: string | null
          sent_at?: string | null
          status?: string
          summary?: string | null
          title: string
          total_value?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          ai_model?: string | null
          ai_prompt?: string | null
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deliverables?: Json
          generated_by_ai?: boolean
          id?: string
          milestones?: Json
          pricing?: Json
          rejected_at?: string | null
          scope?: string | null
          sent_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          total_value?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_entries: {
        Row: {
          bill_rate: number
          cost_rate: number
          created_at: string
          id: string
          notes: string | null
          rate_card_id: string
          role_name: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          bill_rate?: number
          cost_rate?: number
          created_at?: string
          id?: string
          notes?: string | null
          rate_card_id: string
          role_name?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          bill_rate?: number
          cost_rate?: number
          created_at?: string
          id?: string
          notes?: string | null
          rate_card_id?: string
          role_name?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_entries_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_card_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_cards: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          is_archived: boolean
          is_default: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_allocations: {
        Row: {
          actual_hours_logged: number
          allocation_type: string
          bill_rate_override: number | null
          billable: boolean
          cost_rate_override: number | null
          created_at: string
          created_by: string | null
          end_date: string | null
          fixed_hours: number | null
          id: string
          notes: string | null
          percentage: number | null
          project_id: string
          resource_id: string | null
          scheduled_hours: Json | null
          start_date: string
          status: string
          team_member_user_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_hours_logged?: number
          allocation_type?: string
          bill_rate_override?: number | null
          billable?: boolean
          cost_rate_override?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          fixed_hours?: number | null
          id?: string
          notes?: string | null
          percentage?: number | null
          project_id: string
          resource_id?: string | null
          scheduled_hours?: Json | null
          start_date: string
          status?: string
          team_member_user_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_hours_logged?: number
          allocation_type?: string
          bill_rate_override?: number | null
          billable?: boolean
          cost_rate_override?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          fixed_hours?: number | null
          id?: string
          notes?: string | null
          percentage?: number | null
          project_id?: string
          resource_id?: string | null
          scheduled_hours?: Json | null
          start_date?: string
          status?: string
          team_member_user_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      resource_unavailability: {
        Row: {
          approved_by: string | null
          created_at: string
          end_date: string
          hours_per_day: number
          id: string
          notes: string | null
          resource_id: string | null
          start_date: string
          team_member_user_id: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          end_date: string
          hours_per_day?: number
          id?: string
          notes?: string | null
          resource_id?: string | null
          start_date: string
          team_member_user_id?: string | null
          type?: string
          workspace_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          end_date?: string
          hours_per_day?: number
          id?: string
          notes?: string | null
          resource_id?: string | null
          start_date?: string
          team_member_user_id?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          avatar_url: string | null
          bill_rate_amount: number | null
          bill_rate_currency: string
          bill_rate_period: string | null
          billable: boolean
          cost_rate_amount: number | null
          cost_rate_currency: string
          cost_rate_period: string | null
          created_at: string
          created_by: string | null
          daily_capacity_hours: number
          department: string | null
          email: string | null
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          role: string | null
          skills: string[]
          start_date: string | null
          tags: string[]
          timezone: string | null
          type: string
          updated_at: string
          user_id: string | null
          weekly_capacity_hours: number
          work_schedule: Json
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          bill_rate_amount?: number | null
          bill_rate_currency?: string
          bill_rate_period?: string | null
          billable?: boolean
          cost_rate_amount?: number | null
          cost_rate_currency?: string
          cost_rate_period?: string | null
          created_at?: string
          created_by?: string | null
          daily_capacity_hours?: number
          department?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          role?: string | null
          skills?: string[]
          start_date?: string | null
          tags?: string[]
          timezone?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
          weekly_capacity_hours?: number
          work_schedule?: Json
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          bill_rate_amount?: number | null
          bill_rate_currency?: string
          bill_rate_period?: string | null
          billable?: boolean
          cost_rate_amount?: number | null
          cost_rate_currency?: string
          cost_rate_period?: string | null
          created_at?: string
          created_by?: string | null
          daily_capacity_hours?: number
          department?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          role?: string | null
          skills?: string[]
          start_date?: string | null
          tags?: string[]
          timezone?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
          weekly_capacity_hours?: number
          work_schedule?: Json
          workspace_id?: string
        }
        Relationships: []
      }
      role_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_guest_role: boolean
          is_system: boolean
          name: string
          slug: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_guest_role?: boolean
          is_system?: boolean
          name: string
          slug: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_guest_role?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_deliverable_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_model: string | null
          description: string | null
          id: string
          is_default: boolean
          is_system: boolean
          kind: string
          name: string
          schema: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_model?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean
          kind: string
          name: string
          schema?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_model?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_system?: boolean
          kind?: string
          name?: string
          schema?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_deliverable_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_deliverable_versions: {
        Row: {
          ai_generated_at: string | null
          ai_model: string | null
          ai_prompt_hash: string | null
          change_summary: string | null
          citations: Json
          created_at: string
          created_by: string | null
          deliverable_id: string
          diff_against_prev: Json
          id: string
          label: string | null
          sections: Json
          source_brief_id: string | null
          source_document_ids: string[]
          status: string
          superseded_at: string | null
          superseded_by: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_model?: string | null
          ai_prompt_hash?: string | null
          change_summary?: string | null
          citations?: Json
          created_at?: string
          created_by?: string | null
          deliverable_id: string
          diff_against_prev?: Json
          id?: string
          label?: string | null
          sections?: Json
          source_brief_id?: string | null
          source_document_ids?: string[]
          status?: string
          superseded_at?: string | null
          superseded_by?: string | null
          version: number
          workspace_id: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_model?: string | null
          ai_prompt_hash?: string | null
          change_summary?: string | null
          citations?: Json
          created_at?: string
          created_by?: string | null
          deliverable_id?: string
          diff_against_prev?: Json
          id?: string
          label?: string | null
          sections?: Json
          source_brief_id?: string | null
          source_document_ids?: string[]
          status?: string
          superseded_at?: string | null
          superseded_by?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deliverable_versions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "sales_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deliverable_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_deliverables: {
        Row: {
          created_at: string
          created_by: string | null
          current_version_id: string | null
          deal_id: string
          id: string
          kind: string
          owner_id: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          deal_id: string
          id?: string
          kind: string
          owner_id?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          deal_id?: string
          id?: string
          kind?: string
          owner_id?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_deliverables_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverable_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deliverables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sales_deliverable_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deliverables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_document_scans: {
        Row: {
          ai_extracted: Json
          ai_summary: string | null
          completion_tokens: number | null
          confidence: Json
          created_at: string
          diff: Json
          document_id: string
          id: string
          model: string | null
          overall_confidence: number | null
          prompt_tokens: number | null
          scanned_by: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          ai_extracted?: Json
          ai_summary?: string | null
          completion_tokens?: number | null
          confidence?: Json
          created_at?: string
          diff?: Json
          document_id: string
          id?: string
          model?: string | null
          overall_confidence?: number | null
          prompt_tokens?: number | null
          scanned_by?: string | null
          version: number
          workspace_id: string
        }
        Update: {
          ai_extracted?: Json
          ai_summary?: string | null
          completion_tokens?: number | null
          confidence?: Json
          created_at?: string
          diff?: Json
          document_id?: string
          id?: string
          model?: string | null
          overall_confidence?: number | null
          prompt_tokens?: number | null
          scanned_by?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_document_scans_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_scans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_documents: {
        Row: {
          ai_extracted: Json
          ai_scanned_at: string | null
          ai_summary: string | null
          created_at: string
          deal_id: string
          description: string | null
          document_type: string
          external_url: string | null
          file_size_bytes: number | null
          id: string
          last_scan_confidence: number | null
          mime_type: string | null
          name: string
          raw_text: string | null
          scan_version: number
          source: string
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          ai_extracted?: Json
          ai_scanned_at?: string | null
          ai_summary?: string | null
          created_at?: string
          deal_id: string
          description?: string | null
          document_type?: string
          external_url?: string | null
          file_size_bytes?: number | null
          id?: string
          last_scan_confidence?: number | null
          mime_type?: string | null
          name: string
          raw_text?: string | null
          scan_version?: number
          source?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          ai_extracted?: Json
          ai_scanned_at?: string | null
          ai_summary?: string | null
          created_at?: string
          deal_id?: string
          description?: string | null
          document_type?: string
          external_url?: string | null
          file_size_bytes?: number | null
          id?: string
          last_scan_confidence?: number | null
          mime_type?: string | null
          name?: string
          raw_text?: string | null
          scan_version?: number
          source?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_checklist_items: {
        Row: {
          ai_generated: boolean
          applied_to_sow_at: string | null
          area: string
          brief_id: string | null
          confidence: number | null
          created_at: string
          created_by: string
          deal_id: string
          details: string | null
          id: string
          position: number
          priority: string
          requirement: string
          source_document_id: string | null
          source_snippet: string | null
          sow_id: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_generated?: boolean
          applied_to_sow_at?: string | null
          area: string
          brief_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by: string
          deal_id: string
          details?: string | null
          id?: string
          position?: number
          priority?: string
          requirement: string
          source_document_id?: string | null
          source_snippet?: string | null
          sow_id?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_generated?: boolean
          applied_to_sow_at?: string | null
          area?: string
          brief_id?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string
          deal_id?: string
          details?: string | null
          id?: string
          position?: number
          priority?: string
          requirement?: string
          source_document_id?: string | null
          source_snippet?: string | null
          sow_id?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_checklist_items_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "discovery_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_checklist_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_checklist_items_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_checklist_items_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "sow_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_checklist_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_links: {
        Row: {
          allow_comments: boolean
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          label: string | null
          last_viewed_at: string | null
          max_views: number | null
          password_hash: string | null
          permissions: Json
          resource_id: string
          resource_type: string
          revoked_at: string | null
          token: string
          updated_at: string
          view_count: number
          workspace_id: string
        }
        Insert: {
          allow_comments?: boolean
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          max_views?: number | null
          password_hash?: string | null
          permissions?: Json
          resource_id: string
          resource_type: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
          view_count?: number
          workspace_id: string
        }
        Update: {
          allow_comments?: boolean
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          max_views?: number | null
          password_hash?: string | null
          permissions?: Json
          resource_id?: string
          resource_type?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
          view_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sidebar_favorites: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          sort_order: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          sort_order?: number
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          sort_order?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidebar_favorites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sidebar_pins: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          target_id: string
          target_type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          target_id: string
          target_type: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          target_id?: string
          target_type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidebar_pins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sow_drafts: {
        Row: {
          ai_generated_at: string | null
          approved_at: string | null
          approved_by: string | null
          assumptions: Json
          brief_id: string | null
          client_name: string | null
          created_at: string
          created_by: string
          deal_id: string
          deliverables: Json
          executive_summary: string | null
          financials: Json
          id: string
          integrations_approach: string | null
          next_steps: string | null
          out_of_scope: string | null
          positioning: string | null
          risks: Json
          scope: string | null
          section_meta: Json
          status: string
          strategy: string | null
          success_criteria: Json
          team_composition: Json
          technical_architecture: string | null
          terms_conditions: string | null
          timeline: Json
          title: string
          updated_at: string
          value_proposition: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          ai_generated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: Json
          brief_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by: string
          deal_id: string
          deliverables?: Json
          executive_summary?: string | null
          financials?: Json
          id?: string
          integrations_approach?: string | null
          next_steps?: string | null
          out_of_scope?: string | null
          positioning?: string | null
          risks?: Json
          scope?: string | null
          section_meta?: Json
          status?: string
          strategy?: string | null
          success_criteria?: Json
          team_composition?: Json
          technical_architecture?: string | null
          terms_conditions?: string | null
          timeline?: Json
          title?: string
          updated_at?: string
          value_proposition?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          ai_generated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: Json
          brief_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string
          deliverables?: Json
          executive_summary?: string | null
          financials?: Json
          id?: string
          integrations_approach?: string | null
          next_steps?: string | null
          out_of_scope?: string | null
          positioning?: string | null
          risks?: Json
          scope?: string | null
          section_meta?: Json
          status?: string
          strategy?: string | null
          success_criteria?: Json
          team_composition?: Json
          technical_architecture?: string | null
          terms_conditions?: string | null
          timeline?: Json
          title?: string
          updated_at?: string
          value_proposition?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sow_drafts_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "discovery_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_drafts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sow_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_burndown: {
        Row: {
          completed_tasks: number | null
          created_at: string
          id: string
          ideal_remaining: number | null
          remaining_hours: number | null
          remaining_points: number | null
          snapshot_date: string
          sprint_id: string
          total_tasks: number | null
          workspace_id: string
        }
        Insert: {
          completed_tasks?: number | null
          created_at?: string
          id?: string
          ideal_remaining?: number | null
          remaining_hours?: number | null
          remaining_points?: number | null
          snapshot_date: string
          sprint_id: string
          total_tasks?: number | null
          workspace_id: string
        }
        Update: {
          completed_tasks?: number | null
          created_at?: string
          id?: string
          ideal_remaining?: number | null
          remaining_hours?: number | null
          remaining_points?: number | null
          snapshot_date?: string
          sprint_id?: string
          total_tasks?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_burndown_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_tasks: {
        Row: {
          added_at: string
          added_by: string | null
          is_committed: boolean
          original_estimate: number | null
          sprint_id: string
          task_id: string
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          is_committed?: boolean
          original_estimate?: number | null
          sprint_id: string
          task_id: string
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          is_committed?: boolean
          original_estimate?: number | null
          sprint_id?: string
          task_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          budget_allocated: number | null
          budget_spent: number
          capacity_hours: number | null
          capacity_points: number | null
          completed_points: number
          created_at: string
          created_by: string | null
          end_date: string
          goal: string | null
          health_score: number | null
          id: string
          logged_hours: number
          name: string
          planned_hours: number
          planned_points: number
          project_id: string
          risk_flags: string[]
          start_date: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget_allocated?: number | null
          budget_spent?: number
          capacity_hours?: number | null
          capacity_points?: number | null
          completed_points?: number
          created_at?: string
          created_by?: string | null
          end_date: string
          goal?: string | null
          health_score?: number | null
          id?: string
          logged_hours?: number
          name: string
          planned_hours?: number
          planned_points?: number
          project_id: string
          risk_flags?: string[]
          start_date: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget_allocated?: number | null
          budget_spent?: number
          capacity_hours?: number | null
          capacity_points?: number | null
          completed_points?: number
          created_at?: string
          created_by?: string | null
          end_date?: string
          goal?: string | null
          health_score?: number | null
          id?: string
          logged_hours?: number
          name?: string
          planned_hours?: number
          planned_points?: number
          project_id?: string
          risk_flags?: string[]
          start_date?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      status_report_schedules: {
        Row: {
          active: boolean
          auto_publish: boolean
          cadence: string
          created_at: string
          created_by: string | null
          day_of_week: number
          hour_utc: number
          id: string
          last_error: string | null
          last_run_at: string | null
          last_status_update_id: string | null
          next_run_at: string | null
          project_id: string
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          auto_publish?: boolean
          cadence?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          hour_utc?: number
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status_update_id?: string | null
          next_run_at?: string | null
          project_id: string
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          auto_publish?: boolean
          cadence?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          hour_utc?: number
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status_update_id?: string | null
          next_run_at?: string | null
          project_id?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_report_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_report_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          link_kind: string
          target_id: string
          task_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          link_kind: string
          target_id: string
          task_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          link_kind?: string
          target_id?: string
          task_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_relations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lag_days: number
          relation_type: string
          source_task_id: string
          target_task_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lag_days?: number
          relation_type: string
          source_task_id: string
          target_task_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lag_days?: number
          relation_type?: string
          source_task_id?: string
          target_task_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      task_status_history: {
        Row: {
          entered_at: string
          from_status_id: string | null
          from_status_name: string | null
          id: string
          left_at: string | null
          task_id: string
          to_status_id: string | null
          to_status_name: string | null
          transition_id: string | null
          triggered_by: Json
          workspace_id: string
        }
        Insert: {
          entered_at?: string
          from_status_id?: string | null
          from_status_name?: string | null
          id?: string
          left_at?: string | null
          task_id: string
          to_status_id?: string | null
          to_status_name?: string | null
          transition_id?: string | null
          triggered_by?: Json
          workspace_id: string
        }
        Update: {
          entered_at?: string
          from_status_id?: string | null
          from_status_name?: string | null
          id?: string
          left_at?: string | null
          task_id?: string
          to_status_id?: string | null
          to_status_name?: string | null
          transition_id?: string | null
          triggered_by?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "workflow_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_ids: string[]
          child_count: number
          completed_at: string | null
          completed_child_count: number
          created_at: string
          created_by: string | null
          custom_values: Json
          description: Json | null
          due_date: string | null
          estimated_hours: number | null
          hierarchy_path: string[]
          id: string
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          recurrence: Json | null
          recurrence_parent_id: string | null
          rollup_progress: number | null
          start_date: string | null
          status: string
          tags: string[]
          task_number: number | null
          task_type: string
          title: string
          updated_at: string
          workflow_status_id: string | null
          workspace_id: string
        }
        Insert: {
          assignee_ids?: string[]
          child_count?: number
          completed_at?: string | null
          completed_child_count?: number
          created_at?: string
          created_by?: string | null
          custom_values?: Json
          description?: Json | null
          due_date?: string | null
          estimated_hours?: number | null
          hierarchy_path?: string[]
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          recurrence?: Json | null
          recurrence_parent_id?: string | null
          rollup_progress?: number | null
          start_date?: string | null
          status?: string
          tags?: string[]
          task_number?: number | null
          task_type?: string
          title: string
          updated_at?: string
          workflow_status_id?: string | null
          workspace_id: string
        }
        Update: {
          assignee_ids?: string[]
          child_count?: number
          completed_at?: string | null
          completed_child_count?: number
          created_at?: string
          created_by?: string | null
          custom_values?: Json
          description?: Json | null
          due_date?: string | null
          estimated_hours?: number | null
          hierarchy_path?: string[]
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          recurrence?: Json | null
          recurrence_parent_id?: string | null
          rollup_progress?: number | null
          start_date?: string | null
          status?: string
          tags?: string[]
          task_number?: number | null
          task_type?: string
          title?: string
          updated_at?: string
          workflow_status_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workflow_status_id_fkey"
            columns: ["workflow_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          hourly_bill_rate: number | null
          hourly_cost: number | null
          id: string
          is_active: boolean
          notes: string | null
          role: string
          seniority: string | null
          skills: string[]
          updated_at: string
          user_id: string
          weekly_capacity_hours: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          hourly_bill_rate?: number | null
          hourly_cost?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          role?: string
          seniority?: string | null
          skills?: string[]
          updated_at?: string
          user_id: string
          weekly_capacity_hours?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          hourly_bill_rate?: number | null
          hourly_cost?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          role?: string
          seniority?: string | null
          skills?: string[]
          updated_at?: string
          user_id?: string
          weekly_capacity_hours?: number
          workspace_id?: string
        }
        Relationships: []
      }
      template_phases: {
        Row: {
          ai_bindings: Json
          color: string | null
          created_at: string
          entry_criteria: Json
          exit_criteria: Json
          icon: string | null
          id: string
          is_terminal: boolean
          key: string
          name: string
          order_index: number
          owner_role: string | null
          target_days: number | null
          template_id: string
        }
        Insert: {
          ai_bindings?: Json
          color?: string | null
          created_at?: string
          entry_criteria?: Json
          exit_criteria?: Json
          icon?: string | null
          id?: string
          is_terminal?: boolean
          key: string
          name: string
          order_index?: number
          owner_role?: string | null
          target_days?: number | null
          template_id: string
        }
        Update: {
          ai_bindings?: Json
          color?: string | null
          created_at?: string
          entry_criteria?: Json
          exit_criteria?: Json
          icon?: string | null
          id?: string
          is_terminal?: boolean
          key?: string
          name?: string
          order_index?: number
          owner_role?: string | null
          target_days?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          created_at: string
          description: string | null
          hourly_rate_snapshot: number | null
          hours: number
          id: string
          is_billable: boolean
          log_date: string
          project_id: string
          sprint_id: string | null
          task_id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hourly_rate_snapshot?: number | null
          hours: number
          id?: string
          is_billable?: boolean
          log_date?: string
          project_id: string
          sprint_id?: string | null
          task_id: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hourly_rate_snapshot?: number | null
          hours?: number
          id?: string
          is_billable?: boolean
          log_date?: string
          project_id?: string
          sprint_id?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      timesheet_submissions: {
        Row: {
          billable_hours: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          submitted_at: string
          submitter_notes: string | null
          total_hours: number
          updated_at: string
          user_id: string
          week_start: string
          workspace_id: string
        }
        Insert: {
          billable_hours?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          submitter_notes?: string | null
          total_hours?: number
          updated_at?: string
          user_id: string
          week_start: string
          workspace_id: string
        }
        Update: {
          billable_hours?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          submitter_notes?: string | null
          total_hours?: number
          updated_at?: string
          user_id?: string
          week_start?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transition_approvals: {
        Row: {
          approver_id: string
          comment: string | null
          decided_at: string | null
          id: string
          requested_at: string
          requested_by: string
          status: string
          task_id: string
          transition_id: string
          workspace_id: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          decided_at?: string | null
          id?: string
          requested_at?: string
          requested_by: string
          status?: string
          task_id: string
          transition_id: string
          workspace_id: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          decided_at?: string | null
          id?: string
          requested_at?: string
          requested_by?: string
          status?: string
          task_id?: string
          transition_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transition_approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transition_approvals_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "workflow_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_key: string
          id: string
          meta: Json
          pinned: boolean
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          awarded_at?: string
          badge_key: string
          id?: string
          meta?: Json
          pinned?: boolean
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          awarded_at?: string
          badge_key?: string
          id?: string
          meta?: Json
          pinned?: boolean
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["key"]
          },
        ]
      }
      user_calendar_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: string
          provider_account_email: string | null
          refresh_token: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider: string
          provider_account_email?: string | null
          refresh_token?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_account_email?: string | null
          refresh_token?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_calendar_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          accent_preference: string
          confirm_deletes: string
          created_at: string
          default_landing: string
          default_view_type: string
          density: string
          font_size: string
          hidden_nav_items: string[]
          high_contrast: boolean
          id: string
          reduced_motion: boolean
          theme: string
          updated_at: string
          user_id: string
          work_mode: string | null
        }
        Insert: {
          accent_preference?: string
          confirm_deletes?: string
          created_at?: string
          default_landing?: string
          default_view_type?: string
          density?: string
          font_size?: string
          hidden_nav_items?: string[]
          high_contrast?: boolean
          id?: string
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id: string
          work_mode?: string | null
        }
        Update: {
          accent_preference?: string
          confirm_deletes?: string
          created_at?: string
          default_landing?: string
          default_view_type?: string
          density?: string
          font_size?: string
          hidden_nav_items?: string[]
          high_contrast?: boolean
          id?: string
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          position: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          role_definition_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          role_definition_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          role_definition_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_views: {
        Row: {
          created_at: string
          description: string | null
          filters: Json
          group_by: string | null
          icon: string | null
          id: string
          is_pinned: boolean
          is_shared: boolean
          name: string
          object_type_id: string | null
          scope: string
          sort_order: number
          sorts: Json
          updated_at: string
          user_id: string
          view_kind: string
          visible_fields: string[] | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json
          group_by?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean
          is_shared?: boolean
          name: string
          object_type_id?: string | null
          scope?: string
          sort_order?: number
          sorts?: Json
          updated_at?: string
          user_id: string
          view_kind?: string
          visible_fields?: string[] | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json
          group_by?: string | null
          icon?: string | null
          id?: string
          is_pinned?: boolean
          is_shared?: boolean
          name?: string
          object_type_id?: string | null
          scope?: string
          sort_order?: number
          sorts?: Json
          updated_at?: string
          user_id?: string
          view_kind?: string
          visible_fields?: string[] | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_views_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_status: {
        Row: {
          clear_at: string | null
          dnd_until: string | null
          emoji: string | null
          ooo_delegate_id: string | null
          ooo_message: string | null
          ooo_until: string | null
          text: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          clear_at?: string | null
          dnd_until?: string | null
          emoji?: string | null
          ooo_delegate_id?: string | null
          ooo_message?: string | null
          ooo_until?: string | null
          text?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          clear_at?: string | null
          dnd_until?: string | null
          emoji?: string | null
          ooo_delegate_id?: string | null
          ooo_message?: string | null
          ooo_until?: string | null
          text?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      views: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          filters: Json
          group_by: string | null
          id: string
          is_default: boolean
          name: string
          position: number
          project_id: string
          sorts: Json
          view_type: Database["public"]["Enums"]["view_type"]
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          filters?: Json
          group_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          position?: number
          project_id: string
          sorts?: Json
          view_type?: Database["public"]["Enums"]["view_type"]
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          filters?: Json
          group_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          project_id?: string
          sorts?: Json
          view_type?: Database["public"]["Enums"]["view_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_statuses: {
        Row: {
          auto_assign_to: Json | null
          category: string
          color: string
          created_at: string
          entry_criteria: Json
          exit_criteria: Json
          icon: string
          id: string
          is_start: boolean
          is_terminal: boolean
          name: string
          order_index: number
          project_id: string
          sla_hours: number | null
          updated_at: string
          wip_limit: number | null
          workspace_id: string
        }
        Insert: {
          auto_assign_to?: Json | null
          category: string
          color?: string
          created_at?: string
          entry_criteria?: Json
          exit_criteria?: Json
          icon?: string
          id?: string
          is_start?: boolean
          is_terminal?: boolean
          name: string
          order_index?: number
          project_id: string
          sla_hours?: number | null
          updated_at?: string
          wip_limit?: number | null
          workspace_id: string
        }
        Update: {
          auto_assign_to?: Json | null
          category?: string
          color?: string
          created_at?: string
          entry_criteria?: Json
          exit_criteria?: Json
          icon?: string
          id?: string
          is_start?: boolean
          is_terminal?: boolean
          name?: string
          order_index?: number
          project_id?: string
          sla_hours?: number | null
          updated_at?: string
          wip_limit?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          actions: Json
          allowed_role: string | null
          button_label: string | null
          confirmation_message: string | null
          created_at: string
          from_status_id: string
          gates: Json
          id: string
          permission: string
          project_id: string
          to_status_id: string
          workspace_id: string
        }
        Insert: {
          actions?: Json
          allowed_role?: string | null
          button_label?: string | null
          confirmation_message?: string | null
          created_at?: string
          from_status_id: string
          gates?: Json
          id?: string
          permission?: string
          project_id: string
          to_status_id: string
          workspace_id: string
        }
        Update: {
          actions?: Json
          allowed_role?: string | null
          button_label?: string | null
          confirmation_message?: string | null
          created_at?: string
          from_status_id?: string
          gates?: Json
          id?: string
          permission?: string
          project_id?: string
          to_status_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          pinned: boolean
          scope_target_id: string | null
          scope_type: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          pinned?: boolean
          scope_target_id?: string | null
          scope_type?: string
          title?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          pinned?: boolean
          scope_target_id?: string | null
          scope_type?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_ai_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_ai_memory: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          pinned: boolean
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          pinned?: boolean
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          pinned?: boolean
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_ai_memory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_ai_secrets: {
        Row: {
          openrouter_api_key: string | null
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          openrouter_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          openrouter_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_ai_secrets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          invited_email: string | null
          is_suspended: boolean
          joined_at: string
          last_active_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_email?: string | null
          is_suspended?: boolean
          joined_at?: string
          last_active_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_email?: string | null
          is_suspended?: boolean
          joined_at?: string
          last_active_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_overview_templates: {
        Row: {
          created_at: string
          sections: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          sections?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          sections?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          auto_join_domains: string[]
          branding: Json
          created_at: string
          id: string
          kind: string
          linked_delivery_workspace_id: string | null
          logo_url: string | null
          name: string
          nav_visibility: Json
          owner_id: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
          workspace_mode: string
        }
        Insert: {
          auto_join_domains?: string[]
          branding?: Json
          created_at?: string
          id?: string
          kind?: string
          linked_delivery_workspace_id?: string | null
          logo_url?: string | null
          name: string
          nav_visibility?: Json
          owner_id: string
          plan?: string
          settings?: Json
          slug: string
          updated_at?: string
          workspace_mode?: string
        }
        Update: {
          auto_join_domains?: string[]
          branding?: Json
          created_at?: string
          id?: string
          kind?: string
          linked_delivery_workspace_id?: string | null
          logo_url?: string | null
          name?: string
          nav_visibility?: Json
          owner_id?: string
          plan?: string
          settings?: Json
          slug?: string
          updated_at?: string
          workspace_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_linked_delivery_workspace_id_fkey"
            columns: ["linked_delivery_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_workspace_invitation: { Args: { _token: string }; Returns: string }
      backfill_workspace_channel_members: {
        Args: { _channel_id: string }
        Returns: undefined
      }
      can_access_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_member: {
        Args: { _caller: string; _target: string }
        Returns: boolean
      }
      channel_unread_counts: {
        Args: { _workspace_id: string }
        Returns: {
          channel_id: string
          has_mention: boolean
          unread_count: number
        }[]
      }
      compute_next_status_run: {
        Args: {
          _cadence: string
          _day_of_week: number
          _from: string
          _hour_utc: number
        }
        Returns: string
      }
      compute_user_stats: { Args: { _user_id: string }; Returns: Json }
      consume_share_token: {
        Args: { _password?: string; _token: string }
        Returns: {
          allow_comments: boolean
          id: string
          label: string
          permissions: Json
          resource_id: string
          resource_type: string
          workspace_id: string
        }[]
      }
      emit_agent_event: {
        Args: { _event_name: string; _payload: Json; _workspace_id: string }
        Returns: undefined
      }
      evaluate_badges_for: {
        Args: { _user_id: string }
        Returns: {
          awarded_at: string
          badge_key: string
          id: string
          meta: Json
          pinned: boolean
          user_id: string
          workspace_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_badges"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_workspace_for_email: {
        Args: { _email: string }
        Returns: {
          id: string
          logo_url: string
          matched_domain: string
          name: string
          slug: string
        }[]
      }
      get_client_request_bundle_by_token: {
        Args: { _token: string }
        Returns: {
          account_name: string
          client_account_id: string
          completed_at: string
          due_date: string
          id: string
          instructions: string
          items: Json
          project_id: string
          recipient_email: string
          recipient_name: string
          sent_at: string
          status: string
          title: string
          workspace_id: string
        }[]
      }
      global_search:
        | {
            Args: { _limit?: number; _q: string; _workspace_id: string }
            Returns: {
              id: string
              kind: string
              project_id: string
              rank: number
              snippet: string
              title: string
            }[]
          }
        | {
            Args: {
              _limit?: number
              _project_id?: string
              _q: string
              _workspace_id: string
            }
            Returns: {
              id: string
              kind: string
              project_id: string
              rank: number
              snippet: string
              title: string
            }[]
          }
      has_folder_access: {
        Args: {
          _folder_id: string
          _min_level?: Database["public"]["Enums"]["folder_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["workspace_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_personal_email_domain: { Args: { _domain: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      join_workspace_by_email_domain: {
        Args: { _workspace_id: string }
        Returns: string
      }
      log_audit_event: {
        Args: {
          _action: string
          _metadata?: Json
          _target_id?: string
          _target_label?: string
          _target_type?: string
          _workspace_id: string
        }
        Returns: string
      }
      lookup_workspace_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          role: string
          status: string
          workspace_id: string
          workspace_name: string
          workspace_slug: string
        }[]
      }
      mark_channel_read: { Args: { _channel_id: string }; Returns: undefined }
      mark_portal_event_seen: {
        Args: { _event_id: string; _user_id: string }
        Returns: undefined
      }
      realtime_topic_authorized: { Args: { _topic: string }; Returns: boolean }
      recalc_task_rollup: { Args: { _parent_id: string }; Returns: undefined }
      recalculate_client_engagement_score: {
        Args: { _client_account_id: string }
        Returns: number
      }
      seed_default_deal_stages: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      seed_default_object_types: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
      seed_default_workflow: {
        Args: { _project_id: string; _workspace_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_client_request_item: {
        Args: {
          _item_id: string
          _response_decision?: string
          _response_files?: Json
          _response_link?: string
          _response_text?: string
          _token: string
        }
        Returns: boolean
      }
      touch_last_active: { Args: { _workspace_id: string }; Returns: undefined }
      user_is_dnd: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      billing_model:
        | "time_and_materials"
        | "fixed_fee"
        | "milestone"
        | "retainer"
        | "non_billable"
      channel_scope: "workspace" | "section" | "project" | "dm"
      client_account_health: "green" | "yellow" | "red" | "unknown"
      client_account_status: "prospect" | "active" | "paused" | "churned"
      client_account_tier: "standard" | "premium" | "strategic"
      field_type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "multi_select"
        | "user"
        | "checkbox"
        | "url"
        | "email"
        | "effort"
      folder_role: "viewer" | "editor" | "owner"
      handover_stage:
        | "discovery"
        | "sow_draft"
        | "sow_internal_review"
        | "sow_customer_review"
        | "signed"
        | "plan_draft"
        | "plan_review"
        | "executing"
        | "delivered"
      handover_status: "draft" | "sent" | "accepted" | "rejected"
      handover_team: "sales" | "delivery" | "ops" | "support" | "finance"
      onboarding_stage:
        | "kickoff_pending"
        | "intake"
        | "setup"
        | "handover"
        | "active"
        | "cancelled"
      onboarding_step_status:
        | "pending"
        | "in_progress"
        | "complete"
        | "skipped"
        | "blocked"
      raid_impact: "low" | "medium" | "high" | "critical"
      raid_item_type: "risk" | "assumption" | "issue" | "decision"
      raid_likelihood: "unlikely" | "possible" | "likely" | "almost_certain"
      raid_status:
        | "open"
        | "monitoring"
        | "mitigated"
        | "closed"
        | "accepted"
        | "rejected"
      task_priority: "low" | "medium" | "high" | "urgent"
      template_category:
        | "web_build"
        | "retainer"
        | "consulting"
        | "implementation"
        | "custom"
      template_item_kind:
        | "milestone"
        | "task"
        | "raid"
        | "doc_folder"
        | "channel"
        | "meeting"
        | "automation"
        | "intake_form"
        | "role_slot"
      user_primary_role:
        | "partner"
        | "sales"
        | "account_manager"
        | "pm"
        | "delivery"
        | "client_user"
      view_type:
        | "table"
        | "kanban"
        | "canvas"
        | "calendar"
        | "timeline"
        | "sprint"
      workspace_role:
        | "owner"
        | "member"
        | "manager"
        | "admin"
        | "viewer"
        | "guest"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      billing_model: [
        "time_and_materials",
        "fixed_fee",
        "milestone",
        "retainer",
        "non_billable",
      ],
      channel_scope: ["workspace", "section", "project", "dm"],
      client_account_health: ["green", "yellow", "red", "unknown"],
      client_account_status: ["prospect", "active", "paused", "churned"],
      client_account_tier: ["standard", "premium", "strategic"],
      field_type: [
        "text",
        "number",
        "date",
        "select",
        "multi_select",
        "user",
        "checkbox",
        "url",
        "email",
        "effort",
      ],
      folder_role: ["viewer", "editor", "owner"],
      handover_stage: [
        "discovery",
        "sow_draft",
        "sow_internal_review",
        "sow_customer_review",
        "signed",
        "plan_draft",
        "plan_review",
        "executing",
        "delivered",
      ],
      handover_status: ["draft", "sent", "accepted", "rejected"],
      handover_team: ["sales", "delivery", "ops", "support", "finance"],
      onboarding_stage: [
        "kickoff_pending",
        "intake",
        "setup",
        "handover",
        "active",
        "cancelled",
      ],
      onboarding_step_status: [
        "pending",
        "in_progress",
        "complete",
        "skipped",
        "blocked",
      ],
      raid_impact: ["low", "medium", "high", "critical"],
      raid_item_type: ["risk", "assumption", "issue", "decision"],
      raid_likelihood: ["unlikely", "possible", "likely", "almost_certain"],
      raid_status: [
        "open",
        "monitoring",
        "mitigated",
        "closed",
        "accepted",
        "rejected",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      template_category: [
        "web_build",
        "retainer",
        "consulting",
        "implementation",
        "custom",
      ],
      template_item_kind: [
        "milestone",
        "task",
        "raid",
        "doc_folder",
        "channel",
        "meeting",
        "automation",
        "intake_form",
        "role_slot",
      ],
      user_primary_role: [
        "partner",
        "sales",
        "account_manager",
        "pm",
        "delivery",
        "client_user",
      ],
      view_type: [
        "table",
        "kanban",
        "canvas",
        "calendar",
        "timeline",
        "sprint",
      ],
      workspace_role: [
        "owner",
        "member",
        "manager",
        "admin",
        "viewer",
        "guest",
      ],
    },
  },
} as const
