export type EventType =
  | "meeting"
  | "task"
  | "personal"
  | "imported"
  | "journal"
  | "reminder";
export type EventSource = "manual" | "google" | "apple";
export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";
export type ParticipantType = "host" | "participant" | "guest";
export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type MoodLevel = "terrible" | "bad" | "neutral" | "good" | "great";
export type CalendarView = "day" | "week" | "month" | "agenda";
export type ThemeOption = "light" | "dark" | "system";
export type TimeFormat = "12h" | "24h";
export type WeekStartDay = "monday" | "sunday";
export type DefaultCalendarView = "day" | "week" | "month";
export type MeetingDuration = "15" | "30" | "45" | "60";
export type ReminderTiming = "5" | "10" | "15" | "30";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  timezone: string;
  time_format: TimeFormat;
  week_start_day: WeekStartDay;
  default_calendar_view: DefaultCalendarView;
  default_meeting_duration: MeetingDuration;
  email_notifications_enabled: boolean;
  default_reminder_timing: ReminderTiming;
  video_camera_on_join: boolean;
  video_mic_on_join: boolean;
  video_background_blur: boolean;
  work_hours_start: string;
  work_hours_end: string;
  work_days: number[];
  theme: ThemeOption;
  locale: string;
  onboarding_completed: boolean;
  created_at: string;
  auto_record_meetings: boolean;
  auto_transcribe: boolean;
  ai_summaries_enabled: boolean;
  notifications_enabled: {
    meeting_reminders: boolean;
    recording_ready: boolean;
    task_due: boolean;
    daily_journal_prompt: boolean;
    email_notifications: boolean;
  };
  updated_at: string;
}

export interface ProfileUpdate {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  timezone?: string;
  time_format?: TimeFormat;
  week_start_day?: WeekStartDay;
  default_calendar_view?: DefaultCalendarView;
  default_meeting_duration?: MeetingDuration;
  email_notifications_enabled?: boolean;
  default_reminder_timing?: ReminderTiming;
  video_camera_on_join?: boolean;
  video_mic_on_join?: boolean;
  video_background_blur?: boolean;
  work_hours_start?: string;
  work_hours_end?: string;
  work_days?: number[];
  theme?: ThemeOption;
  locale?: string;
  auto_record_meetings?: boolean;
  auto_transcribe?: boolean;
  ai_summaries_enabled?: boolean;
  notifications_enabled?: {
    meeting_reminders?: boolean;
    recording_ready?: boolean;
    task_due?: boolean;
    daily_journal_prompt?: boolean;
    email_notifications?: boolean;
  };
}

export interface UserSettings {
  user_id: string;
  calendar_view_default: CalendarView;
  work_hours_start: string;
  work_hours_end: string;
  work_days: number[];
  auto_record_meetings: boolean;
  auto_transcribe: boolean;
  ai_summaries_enabled: boolean;
  default_meeting_duration: number;
  notifications_enabled: {
    meeting_reminders: boolean;
    recording_ready: boolean;
    task_due: boolean;
    daily_journal_prompt: boolean;
    email_notifications: boolean;
  };
  theme: ThemeOption;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  timezone: string;
  event_type: EventType;
  source: EventSource;
  color_tag: string | null;
  tags: string[] | null;
  recurrence_rule: string | null;
  recurrence_exception_dates: string[] | null;
  parent_event_id: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  share_token: string | null;
  share_token_expires_at: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventInsert {
  user_id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  timezone?: string;
  event_type?: EventType;
  source?: EventSource;
  color_tag?: string | null;
  tags?: string[] | null;
  recurrence_rule?: string | null;
}

export interface GoogleCalendarConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  is_connected: boolean;
  google_email: string | null;
  selected_calendar_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  event_id: string | null;
  host_user_id: string;
  title: string;
  description: string | null;
  daily_room_name: string;
  daily_room_url: string;
  daily_room_config: Record<string, unknown> | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  status: MeetingStatus;
  recording_enabled: boolean;
  transcription_enabled: boolean;
  max_participants: number;
  require_authentication: boolean;
  guest_token: string | null;
  guest_token_expires_at: string | null;
  host_meeting_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingInsert {
  event_id?: string | null;
  host_user_id: string;
  title: string;
  description?: string | null;
  daily_room_name: string;
  daily_room_url: string;
  daily_room_config?: Record<string, unknown> | null;
  scheduled_start: string;
  scheduled_end: string;
  recording_enabled?: boolean;
  transcription_enabled?: boolean;
  max_participants?: number;
  require_authentication?: boolean;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  joined_at: string | null;
  left_at: string | null;
  duration_minutes: number | null;
  participant_type: ParticipantType;
  created_at: string;
}

export interface MeetingRecording {
  id: string;
  meeting_id: string;
  storage_path: string;
  storage_bucket: string;
  file_size_mb: string | null;
  duration_seconds: number | null;
  format: string;
  processing_status: ProcessingStatus;
  daily_recording_id: string | null;
  thumbnail_url: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface Transcription {
  id: string;
  recording_id: string;
  transcript_text: string;
  transcript_json: Record<string, unknown> | null;
  language: string | null;
  word_count: number | null;
  confidence_score: string | null;
  whisper_model_used: string;
  processing_time_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingSummary {
  id: string;
  meeting_id: string;
  transcription_id: string | null;
  summary_text: string;
  key_points: string[] | null;
  action_items: Array<{
    task: string;
    assignee?: string;
    due_date?: string;
  }> | null;
  topics_discussed: string[] | null;
  sentiment_analysis: Record<string, unknown> | null;
  participants_mentioned: string[] | null;
  gpt_model_used: string;
  tokens_used: number | null;
  processing_cost_usd: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventAttachment {
  id: string;
  event_id: string;
  file_name: string;
  storage_path: string;
  storage_bucket: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

export interface EventAttachmentInsert {
  event_id: string;
  file_name: string;
  storage_path: string;
  storage_bucket?: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  mood: MoodLevel | null;
  mood_score: number | null;
  entry_text: string | null;
  tags: string[] | null;
  is_private: boolean;
  ai_analysis: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryInsert {
  user_id: string;
  date: string;
  mood?: MoodLevel | null;
  mood_score?: number | null;
  entry_text?: string | null;
  tags?: string[] | null;
  is_private?: boolean;
}

export interface AiTaskExtracted {
  id: string;
  user_id: string;
  meeting_id: string | null;
  journal_entry_id: string | null;
  task_description: string;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  user_edited: boolean;
  user_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  related_type: string | null;
  action_url: string | null;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface OnboardingFormData {
  full_name: string;
  timezone: string;
  locale: string;
  work_hours_start: string;
  work_hours_end: string;
  work_days: string[];
  calendar_view_default: string;
}

export interface EventFormData {
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  all_day: boolean;
  event_type: EventType;
  color_tag: string;
  location: string;
  has_video_call: boolean;
  recording_enabled: boolean;
  transcription_enabled: boolean;
}
