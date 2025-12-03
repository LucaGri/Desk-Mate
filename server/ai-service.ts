import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// the newest OpenAI model is "gpt-4o-mini" as requested by the user
// Using user's own API key for GPT-4o-mini and Whisper
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getServiceRoleClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key");
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
}

// Types for AI features
export interface AIConversation {
  id: string;
  user_id: string;
  title: string | null;
  context_sources: {
    calendar: boolean;
    journal: boolean;
    meetings: boolean;
    analytics: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  context_used: object | null;
  created_at: string;
}

export interface AISettings {
  id: string;
  user_id: string;
  context_calendar: boolean;
  context_journal: boolean;
  context_meetings: boolean;
  context_analytics: boolean;
  preferred_language: string;
  summary_style: "concise" | "detailed" | "bullet_points";
  created_at: string;
  updated_at: string;
}

// Transcription interface matching existing transcriptions table
// Note: transcriptions table uses recording_id -> meeting_recordings -> meetings
export interface Transcription {
  id: string;
  recording_id: string;
  transcript_text: string;
  transcript_json: object | null;
  language: string | null;
  word_count: number | null;
  confidence_score: number | null;
  whisper_model_used: string;
  processing_time_seconds: number | null;
  created_at: string;
  updated_at: string;
}

// Meeting summary interface matching existing meeting_summaries table
export interface MeetingSummary {
  id: string;
  meeting_id: string;
  transcription_id: string | null;
  summary_text: string;
  key_points: string[] | null;
  action_items: string[] | null;
  topics_discussed: string[] | null;
  sentiment_analysis: object | null;
  participants_mentioned: string[] | null;
  gpt_model_used: string;
  tokens_used: number | null;
  processing_cost_usd: number | null;
  created_at: string;
  updated_at: string;
}

// For backward compatibility with existing code
export interface MeetingTranscription {
  id: string;
  meeting_id: string;
  transcription: string | null;
  status: string;
}

// Context gathering for AI chat
export interface UserContext {
  calendar_events?: any[];
  journal_entries?: any[];
  meetings?: any[];
  analytics?: {
    mood_average?: number;
    total_events?: number;
    total_meetings?: number;
    journal_count?: number;
  };
}

// Get user's AI settings
export async function getAISettings(userId: string): Promise<AISettings | null> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("ai_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  
  if (error && error.code !== "PGRST116") {
    console.error("Error fetching AI settings:", error);
    return null;
  }
  
  return data;
}

// Create or update AI settings
export async function upsertAISettings(
  userId: string,
  settings: Partial<AISettings>
): Promise<AISettings | null> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("ai_settings")
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error upserting AI settings:", error);
    return null;
  }
  
  return data;
}

// Gather context based on user settings
export async function gatherUserContext(
  userId: string,
  settings: AISettings | null
): Promise<UserContext> {
  const serviceClient = getServiceRoleClient();
  const context: UserContext = {};
  
  const effectiveSettings = settings || {
    context_calendar: true,
    context_journal: true,
    context_meetings: true,
    context_analytics: true,
  };
  
  // Get date range - last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  // Gather calendar events
  if (effectiveSettings.context_calendar) {
    const { data: events } = await serviceClient
      .from("calendar_events")
      .select("id, title, description, start_time, end_time, event_type, location")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .gte("start_time", startDate.toISOString())
      .lte("start_time", endDate.toISOString())
      .order("start_time", { ascending: false })
      .limit(50);
    
    context.calendar_events = events || [];
  }
  
  // Gather journal entries
  if (effectiveSettings.context_journal) {
    const { data: entries } = await serviceClient
      .from("journal_entries")
      .select("id, date, mood, mood_score, entry_text, tags")
      .eq("user_id", userId)
      .gte("date", startDate.toISOString().split("T")[0])
      .lte("date", endDate.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(30);
    
    context.journal_entries = entries || [];
  }
  
  // Gather meetings with summaries
  if (effectiveSettings.context_meetings) {
    const { data: meetings } = await serviceClient
      .from("meetings")
      .select(`
        id, 
        status, 
        started_at, 
        ended_at,
        calendar_events!inner(title, description, start_time)
      `)
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    
    // Also get summaries for these meetings
    if (meetings && meetings.length > 0) {
      const meetingIds = meetings.map(m => m.id);
      const { data: summaries } = await serviceClient
        .from("meeting_summaries")
        .select("meeting_id, summary, key_points, action_items")
        .in("meeting_id", meetingIds)
        .eq("status", "completed");
      
      // Attach summaries to meetings
      const summaryMap = new Map((summaries || []).map(s => [s.meeting_id, s]));
      context.meetings = meetings.map(m => ({
        ...m,
        summary: summaryMap.get(m.id),
      }));
    } else {
      context.meetings = [];
    }
  }
  
  // Gather analytics summary
  if (effectiveSettings.context_analytics) {
    // Calculate mood average
    const { data: moodData } = await serviceClient
      .from("journal_entries")
      .select("mood_score")
      .eq("user_id", userId)
      .not("mood_score", "is", null)
      .gte("date", startDate.toISOString().split("T")[0]);
    
    const moodScores = (moodData || []).map(d => d.mood_score).filter(Boolean);
    const moodAverage = moodScores.length > 0 
      ? moodScores.reduce((a, b) => a + b, 0) / moodScores.length 
      : null;
    
    // Count events
    const { count: eventCount } = await serviceClient
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .gte("start_time", startDate.toISOString());
    
    // Count meetings
    const { count: meetingCount } = await serviceClient
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());
    
    context.analytics = {
      mood_average: moodAverage || undefined,
      total_events: eventCount || 0,
      total_meetings: meetingCount || 0,
      journal_count: moodScores.length,
    };
  }
  
  return context;
}

// Build system prompt with context
function buildSystemPrompt(context: UserContext, language: string = "en"): string {
  const languageNames: Record<string, string> = {
    en: "English",
    it: "Italian",
    de: "German",
    fr: "French",
    es: "Spanish",
  };
  
  let prompt = `You are Desk Mate AI, a helpful productivity assistant. You help users manage their time, understand their meetings, reflect on their journal entries, and gain insights from their productivity data.

Always respond in ${languageNames[language] || "English"}.
Be concise but helpful. Use a friendly, professional tone.
When referencing user data, be specific about dates and details.
If asked about data you don't have, be honest about it.

`;

  if (context.analytics) {
    prompt += `\n## User's Productivity Summary (Last 30 Days)
- Total calendar events: ${context.analytics.total_events}
- Total meetings: ${context.analytics.total_meetings}
- Journal entries: ${context.analytics.journal_count}
${context.analytics.mood_average ? `- Average mood score: ${context.analytics.mood_average.toFixed(1)}/5` : ""}
`;
  }

  if (context.calendar_events && context.calendar_events.length > 0) {
    prompt += `\n## Recent Calendar Events (Last 30 Days)
`;
    context.calendar_events.slice(0, 10).forEach(event => {
      const startDate = new Date(event.start_time).toLocaleDateString();
      prompt += `- ${startDate}: "${event.title}" (${event.event_type})${event.location ? ` at ${event.location}` : ""}\n`;
    });
  }

  if (context.journal_entries && context.journal_entries.length > 0) {
    prompt += `\n## Recent Journal Entries
`;
    context.journal_entries.slice(0, 5).forEach(entry => {
      const mood = entry.mood ? ` - Mood: ${entry.mood}` : "";
      const tags = entry.tags?.length ? ` [${entry.tags.join(", ")}]` : "";
      const preview = entry.entry_text 
        ? entry.entry_text.substring(0, 100) + (entry.entry_text.length > 100 ? "..." : "")
        : "";
      prompt += `- ${entry.date}${mood}${tags}: ${preview}\n`;
    });
  }

  if (context.meetings && context.meetings.length > 0) {
    const completedMeetings = context.meetings.filter(m => m.summary);
    if (completedMeetings.length > 0) {
      prompt += `\n## Recent Meeting Summaries
`;
      completedMeetings.slice(0, 5).forEach(meeting => {
        const title = meeting.calendar_events?.title || "Untitled Meeting";
        prompt += `- "${title}": ${meeting.summary?.summary || "No summary"}\n`;
        if (meeting.summary?.key_points?.length) {
          prompt += `  Key points: ${meeting.summary.key_points.join("; ")}\n`;
        }
      });
    }
  }

  return prompt;
}

// Chat with AI
export async function chatWithAI(
  userId: string,
  conversationId: string,
  userMessage: string,
  context: UserContext,
  settings: AISettings | null
): Promise<{ response: string; contextUsed: object }> {
  const serviceClient = getServiceRoleClient();
  
  // Get conversation history
  const { data: messages } = await serviceClient
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);
  
  const systemPrompt = buildSystemPrompt(context, settings?.preferred_language || "en");
  
  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(messages || []).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: chatMessages,
    max_tokens: 1024,
    temperature: 0.7,
  });
  
  const assistantMessage = response.choices[0].message.content || "I apologize, but I couldn't generate a response.";
  
  return {
    response: assistantMessage,
    contextUsed: {
      calendar_events_count: context.calendar_events?.length || 0,
      journal_entries_count: context.journal_entries?.length || 0,
      meetings_count: context.meetings?.length || 0,
      has_analytics: !!context.analytics,
    },
  };
}

// Transcribe audio using Whisper
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<{ text: string; duration: number }> {
  // Write buffer to temp file (Whisper API requires a file)
  const tempDir = "/tmp";
  const tempFilePath = path.join(tempDir, `whisper_${Date.now()}_${fileName}`);
  
  try {
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    const audioFile = fs.createReadStream(tempFilePath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
    });
    
    return {
      text: transcription.text,
      duration: (transcription as any).duration || 0,
    };
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

// Generate meeting summary from transcription
export async function generateMeetingSummary(
  transcription: string,
  meetingTitle: string,
  language: string = "en"
): Promise<{
  summary: string;
  key_points: string[];
  action_items: string[];
  decisions: string[];
}> {
  const languageNames: Record<string, string> = {
    en: "English",
    it: "Italian",
    de: "German",
    fr: "French",
    es: "Spanish",
  };
  
  const prompt = `You are analyzing a meeting transcript. The meeting was titled "${meetingTitle}".

Please provide in ${languageNames[language] || "English"}:
1. A concise summary (2-3 paragraphs)
2. Key points discussed (as a JSON array of strings)
3. Action items identified (as a JSON array of strings)
4. Decisions made (as a JSON array of strings)

Respond with JSON in this exact format:
{
  "summary": "...",
  "key_points": ["point 1", "point 2", ...],
  "action_items": ["action 1", "action 2", ...],
  "decisions": ["decision 1", "decision 2", ...]
}

Meeting Transcript:
${transcription}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 2048,
    temperature: 0.3,
  });
  
  const result = JSON.parse(response.choices[0].message.content || "{}");
  
  return {
    summary: result.summary || "No summary available",
    key_points: result.key_points || [],
    action_items: result.action_items || [],
    decisions: result.decisions || [],
  };
}

// Conversations CRUD
export async function createConversation(
  userId: string,
  title?: string,
  contextSources?: AIConversation["context_sources"]
): Promise<AIConversation | null> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("ai_conversations")
    .insert({
      user_id: userId,
      title: title || null,
      context_sources: contextSources || {
        calendar: true,
        journal: true,
        meetings: true,
        analytics: true,
      },
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating conversation:", error);
    return null;
  }
  
  return data;
}

export async function getConversations(userId: string): Promise<AIConversation[]> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
  
  return data || [];
}

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<AIConversation | null> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();
  
  if (error) {
    console.error("Error fetching conversation:", error);
    return null;
  }
  
  return data;
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const serviceClient = getServiceRoleClient();
  
  const { error } = await serviceClient
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  
  if (error) {
    console.error("Error deleting conversation:", error);
    return false;
  }
  
  return true;
}

// Messages CRUD
export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  contextUsed?: object
): Promise<AIMessage | null> {
  const serviceClient = getServiceRoleClient();
  
  // Update conversation's updated_at
  await serviceClient
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  
  const { data, error } = await serviceClient
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      context_used: contextUsed || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error adding message:", error);
    return null;
  }
  
  return data;
}

export async function getMessages(conversationId: string): Promise<AIMessage[]> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  
  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
  
  return data || [];
}

// Meeting transcription and summary management
// Note: Uses existing database tables with their column structures

// Get transcription for a meeting (via meeting_recordings)
export async function getTranscriptionForMeeting(meetingId: string): Promise<Transcription | null> {
  const serviceClient = getServiceRoleClient();
  
  // First get the recording for this meeting
  const { data: recording, error: recordingError } = await serviceClient
    .from("meeting_recordings")
    .select("id")
    .eq("meeting_id", meetingId)
    .single();
  
  if (recordingError || !recording) {
    return null;
  }
  
  // Then get the transcription for that recording
  const { data, error } = await serviceClient
    .from("transcriptions")
    .select("*")
    .eq("recording_id", recording.id)
    .single();
  
  if (error && error.code !== "PGRST116") {
    console.error("Error fetching transcription:", error);
  }
  
  return data || null;
}

// For backward compatibility - simple version that returns transcription text
export async function getTranscription(meetingId: string): Promise<MeetingTranscription | null> {
  const transcription = await getTranscriptionForMeeting(meetingId);
  if (!transcription) return null;
  
  return {
    id: transcription.id,
    meeting_id: meetingId,
    transcription: transcription.transcript_text,
    status: "completed",
  };
}

// Create a meeting summary with the correct column names
export async function createMeetingSummary(
  meetingId: string,
  summaryData: {
    summary_text: string;
    key_points?: string[];
    action_items?: string[];
    topics_discussed?: string[];
    transcription_id?: string;
    tokens_used?: number;
  }
): Promise<MeetingSummary | null> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("meeting_summaries")
    .insert({
      meeting_id: meetingId,
      summary_text: summaryData.summary_text,
      key_points: summaryData.key_points || [],
      action_items: summaryData.action_items || [],
      topics_discussed: summaryData.topics_discussed || [],
      transcription_id: summaryData.transcription_id || null,
      gpt_model_used: "gpt-4o-mini",
      tokens_used: summaryData.tokens_used || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating meeting summary:", error);
    return null;
  }
  
  return data;
}

// Update an existing meeting summary
export async function updateMeetingSummary(
  summaryId: string,
  updates: Partial<{
    summary_text: string;
    key_points: string[];
    action_items: string[];
    topics_discussed: string[];
    tokens_used: number;
  }>
): Promise<MeetingSummary | null> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("meeting_summaries")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating meeting summary:", error);
    return null;
  }
  
  return data;
}

// Get meeting summary by meeting ID
export async function getMeetingSummary(meetingId: string): Promise<MeetingSummary | null> {
  const serviceClient = getServiceRoleClient();
  
  const { data, error } = await serviceClient
    .from("meeting_summaries")
    .select("*")
    .eq("meeting_id", meetingId)
    .single();
  
  if (error && error.code !== "PGRST116") {
    console.error("Error fetching meeting summary:", error);
  }
  
  return data || null;
}

// Generate a title for a conversation based on first message
export async function generateConversationTitle(
  firstMessage: string,
  language: string = "en"
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Generate a very short title (3-5 words max) for a conversation that starts with this message. Respond in ${language === "en" ? "English" : language}. Only output the title, nothing else.`,
        },
        { role: "user", content: firstMessage },
      ],
      max_tokens: 20,
      temperature: 0.7,
    });
    
    return response.choices[0].message.content?.trim() || "New Conversation";
  } catch (error) {
    console.error("Error generating title:", error);
    return "New Conversation";
  }
}
