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
      tasks: {
        Row: {
          assignee_ids: string[]
          completed_at: string | null
          created_at: string
          created_by: string | null
          custom_values: Json
          description: Json | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          start_date: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_ids?: string[]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_values?: Json
          description?: Json | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          start_date?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_ids?: string[]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_values?: Json
          description?: Json | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          start_date?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
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
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      view_type: ["table", "kanban", "canvas", "calendar", "timeline"],
      workspace_role: ["owner", "member"],
    },
  },
} as const
