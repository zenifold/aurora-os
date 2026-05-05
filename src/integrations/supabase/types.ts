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
      ai_agents: {
        Row: {
          avatar_emoji: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          max_tokens: number
          model: string
          name: string
          system_prompt: string
          temperature: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_emoji?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_tokens?: number
          model?: string
          name: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_emoji?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_tokens?: number
          model?: string
          name?: string
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
          agent_id: string
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
          agent_id: string
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
          agent_id?: string
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
          error_message: string | null
          id: string
          instructions: string | null
          iterations: number
          model_used: string | null
          output: string | null
          started_at: string | null
          status: string
          task_id: string
          tokens_used: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          instructions?: string | null
          iterations?: number
          model_used?: string | null
          output?: string | null
          started_at?: string | null
          status?: string
          task_id: string
          tokens_used?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          instructions?: string | null
          iterations?: number
          model_used?: string | null
          output?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
          tokens_used?: number | null
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
      custom_field_defs: {
        Row: {
          created_at: string
          default_value: Json | null
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          is_required: boolean
          name: string
          options: Json | null
          order_index: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_value?: Json | null
          field_type: Database["public"]["Enums"]["field_type"]
          id?: string
          is_required?: boolean
          name: string
          options?: Json | null
          order_index?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_value?: Json | null
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          is_required?: boolean
          name?: string
          options?: Json | null
          order_index?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_defs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
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
          body: string | null
          comment_id: string | null
          created_at: string
          id: string
          link: string | null
          project_id: string | null
          read_at: string | null
          recipient_id: string
          task_id: string | null
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          recipient_id: string
          task_id?: string | null
          title: string
          type: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          recipient_id?: string
          task_id?: string | null
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          theme_preference: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          theme_preference?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          theme_preference?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string
          id: string
          is_archived: boolean
          name: string
          parent_id: string | null
          position: number
          settings: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_archived?: boolean
          name: string
          parent_id?: string | null
          position?: number
          settings?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_archived?: boolean
          name?: string
          parent_id?: string | null
          position?: number
          settings?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      user_preferences: {
        Row: {
          accent_preference: string
          confirm_deletes: string
          created_at: string
          default_landing: string
          default_view_type: string
          density: string
          font_size: string
          high_contrast: boolean
          id: string
          reduced_motion: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_preference?: string
          confirm_deletes?: string
          created_at?: string
          default_landing?: string
          default_view_type?: string
          density?: string
          font_size?: string
          high_contrast?: boolean
          id?: string
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_preference?: string
          confirm_deletes?: string
          created_at?: string
          default_landing?: string
          default_view_type?: string
          density?: string
          font_size?: string
          high_contrast?: boolean
          id?: string
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          joined_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_email?: string | null
          joined_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_email?: string | null
          joined_at?: string
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
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["workspace_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      recalc_task_rollup: { Args: { _parent_id: string }; Returns: undefined }
      seed_default_workflow: {
        Args: { _project_id: string; _workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
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
      task_priority: "low" | "medium" | "high" | "urgent"
      view_type: "table" | "kanban" | "canvas" | "calendar" | "timeline"
      workspace_role: "owner" | "member"
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
      task_priority: ["low", "medium", "high", "urgent"],
      view_type: ["table", "kanban", "canvas", "calendar", "timeline"],
      workspace_role: ["owner", "member"],
    },
  },
} as const
