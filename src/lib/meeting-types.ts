export interface MeetingSummary {
  overview?: string;
  key_points?: string[];
  decisions?: string[];
  risks?: string[];
  questions_unanswered?: string[];
  sentiment?: string;
}

export interface MeetingTopic {
  name: string;
  start_time?: number;
  end_time?: number;
  sentiment?: string;
}

export interface ExtractedActionItem {
  text: string;
  assignee?: string | null;
  due?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  context_quote?: string | null;
}

export interface Meeting {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  platform: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  duration_seconds: number | null;
  transcript_raw_text: string | null;
  transcript: unknown;
  summary: MeetingSummary | null;
  action_items: ExtractedActionItem[];
  topics: MeetingTopic[];
  ai_status: "pending" | "processing" | "completed" | "failed";
  ai_model: string | null;
  ai_error: string | null;
  visibility: "private" | "attendees" | "workspace";
  organizer_id: string | null;
  participant_emails: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingActionItem {
  id: string;
  workspace_id: string;
  meeting_id: string;
  original_text: string;
  summary: string | null;
  context_quote: string | null;
  assignee_guess_name: string | null;
  assignee_guess_user_id: string | null;
  due_guess: string | null;
  priority_guess: "low" | "medium" | "high" | "urgent" | null;
  status: "pending" | "converted" | "assigned_to_ai" | "dismissed" | "completed";
  converted_task_id: string | null;
  assigned_agent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}
