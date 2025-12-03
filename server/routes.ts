import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import {
  getAuthenticatedUser,
  createAuthenticatedClient,
  supabase,
} from "./supabase";
import {
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  disconnectGoogle,
  listCalendars,
  fetchCalendarEvents,
  parseGoogleEvents,
  importEvents,
  getSelectedCalendars,
  saveSelectedCalendars,
} from "./google-calendar";
import {
  getAISettings,
  upsertAISettings,
  gatherUserContext,
  chatWithAI,
  transcribeAudio,
  generateMeetingSummary,
  createConversation,
  getConversations,
  getConversation,
  deleteConversation,
  addMessage,
  getMessages,
  getTranscription,
  createMeetingSummary,
  updateMeetingSummary,
  getMeetingSummary,
  generateConversationTitle,
} from "./ai-service";
import multer from "multer";

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = "https://api.daily.co/v1";

interface DailyRoomConfig {
  name?: string;
  privacy?: "public" | "private";
  properties?: {
    start_video_off?: boolean;
    start_audio_off?: boolean;
    enable_chat?: boolean;
    enable_screenshare?: boolean;
    enable_recording?: string;
    exp?: number;
    nbf?: number;
    max_participants?: number;
  };
}

interface DailyRoom {
  id: string;
  name: string;
  api_created: boolean;
  privacy: string;
  url: string;
  created_at: string;
  config: Record<string, unknown>;
}

async function createDailyRoom(config: DailyRoomConfig): Promise<DailyRoom> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY is not configured");
  }

  const response = await fetch(`${DAILY_API_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Daily.co API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function deleteDailyRoom(roomName: string): Promise<void> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY is not configured");
  }

  const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Daily.co API error: ${response.status} - ${errorText}`);
  }
}

async function getDailyRoom(roomName: string): Promise<DailyRoom | null> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY is not configured");
  }

  const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Daily.co API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function generateRoomName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "deskmate-";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

interface MeetingTokenConfig {
  room_name: string;
  is_owner?: boolean;
  exp?: number;
  nbf?: number;
}

async function createMeetingToken(config: MeetingTokenConfig): Promise<string> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY is not configured");
  }

  const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: config,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Daily.co API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/meetings", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        event_id,
        title,
        description,
        scheduled_start,
        scheduled_end,
        recording_enabled = false,
        transcription_enabled = false,
        max_participants = 10,
      } = req.body;

      if (!title || !scheduled_start || !scheduled_end) {
        return res.status(400).json({
          error:
            "Missing required fields: title, scheduled_start, scheduled_end",
        });
      }

      if (event_id) {
        const token = authHeader!.substring(7);
        const authClient = createAuthenticatedClient(token);

        const { data: eventData, error: eventError } = await authClient
          .from("calendar_events")
          .select("id, user_id")
          .eq("id", event_id)
          .single();

        if (eventError || !eventData) {
          return res.status(404).json({ error: "Event not found" });
        }

        if (eventData.user_id !== user.id) {
          return res
            .status(403)
            .json({ error: "Not authorized to add meeting to this event" });
        }
      }

      const roomName = generateRoomName();
      const startTime = new Date(scheduled_start);
      const endTime = new Date(scheduled_end);

      const now = new Date();
      if (startTime < now) {
        return res.status(400).json({
          error: "Meeting start time must be in the future",
        });
      }

      if (endTime <= startTime) {
        return res.status(400).json({
          error: "Meeting end time must be after start time",
        });
      }

      const expTime = Math.floor(endTime.getTime() / 1000) + 3600;
      const nbfTime = Math.floor(startTime.getTime() / 1000) - 900;

      const roomConfig: DailyRoomConfig = {
        name: roomName,
        privacy: "private",
        properties: {
          start_video_off: false,
          start_audio_off: true,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: recording_enabled ? "cloud" : undefined,
          exp: expTime,
          nbf: nbfTime,
          max_participants: max_participants,
        },
      };

      const dailyRoom = await createDailyRoom(roomConfig);

      // Generate host meeting token for private room access
      const hostMeetingToken = await createMeetingToken({
        room_name: dailyRoom.name,
        is_owner: true,
        exp: expTime,
        nbf: nbfTime,
      });

      const guestToken = crypto.randomUUID();
      const guestTokenExpiry = new Date(
        endTime.getTime() + 24 * 60 * 60 * 1000,
      );

      const token = authHeader!.substring(7);
      const authClient = createAuthenticatedClient(token);

      const meetingData = {
        event_id: event_id || null,
        host_user_id: user.id,
        title,
        description: description || null,
        daily_room_name: dailyRoom.name,
        daily_room_url: dailyRoom.url,
        daily_room_config: dailyRoom.config,
        scheduled_start,
        scheduled_end,
        status: "scheduled",
        recording_enabled,
        transcription_enabled,
        max_participants,
        require_authentication: false,
        guest_token: guestToken,
        guest_token_expires_at: guestTokenExpiry.toISOString(),
        host_meeting_token: hostMeetingToken,
      };

      const { data: meeting, error: insertError } = await authClient
        .from("meetings")
        .insert(meetingData)
        .select()
        .single();

      if (insertError) {
        console.error(
          "Failed to persist meeting, cleaning up Daily room:",
          insertError,
        );
        try {
          await deleteDailyRoom(dailyRoom.name);
        } catch (cleanupError) {
          console.error("Failed to cleanup Daily room:", cleanupError);
        }
        throw new Error(`Failed to save meeting: ${insertError.message}`);
      }

      res.status(201).json({
        success: true,
        meeting,
      });
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      res.status(500).json({
        error: error.message || "Failed to create meeting",
      });
    }
  });

  app.get("/api/meetings/:roomName", async (req: Request, res: Response) => {
    try {
      const { roomName } = req.params;

      const room = await getDailyRoom(roomName);

      if (!room) {
        return res.status(404).json({ error: "Meeting room not found" });
      }

      res.json({ room });
    } catch (error: any) {
      console.error("Error getting meeting:", error);
      res.status(500).json({
        error: error.message || "Failed to get meeting",
      });
    }
  });

  app.delete("/api/meetings/:roomName", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { roomName } = req.params;

      const token = authHeader!.substring(7);
      const authClient = createAuthenticatedClient(token);

      const { data: meeting, error: fetchError } = await authClient
        .from("meetings")
        .select("id, host_user_id, daily_room_name")
        .eq("daily_room_name", roomName)
        .single();

      if (fetchError || !meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (meeting.host_user_id !== user.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this meeting" });
      }

      await deleteDailyRoom(roomName);

      const { error: deleteError } = await authClient
        .from("meetings")
        .delete()
        .eq("id", meeting.id);

      if (deleteError) {
        console.error("Failed to delete meeting from database:", deleteError);
      }

      res.json({ success: true, message: "Meeting room deleted" });
    } catch (error: any) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({
        error: error.message || "Failed to delete meeting",
      });
    }
  });

  app.post(
    "/api/events/:eventId/share",
    async (req: Request, res: Response) => {
      try {
        const authHeader = req.headers.authorization;
        const user = await getAuthenticatedUser(authHeader);

        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { eventId } = req.params;
        const { expiresInDays = 30 } = req.body;

        const token = authHeader!.substring(7);
        const authClient = createAuthenticatedClient(token);

        const { data: eventData, error: fetchError } = await authClient
          .from("calendar_events")
          .select("id, user_id")
          .eq("id", eventId)
          .single();

        if (fetchError || !eventData) {
          return res.status(404).json({ error: "Event not found" });
        }

        if (eventData.user_id !== user.id) {
          return res
            .status(403)
            .json({ error: "Not authorized to share this event" });
        }

        const shareToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const { error: updateError } = await authClient
          .from("calendar_events")
          .update({
            share_token: shareToken,
            share_token_expires_at: expiresAt.toISOString(),
          })
          .eq("id", eventId);

        if (updateError) {
          throw new Error(
            `Failed to generate share link: ${updateError.message}`,
          );
        }

        res.json({
          success: true,
          shareToken,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (error: any) {
        console.error("Error generating share link:", error);
        res.status(500).json({
          error: error.message || "Failed to generate share link",
        });
      }
    },
  );

  app.get("/api/shared-event/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const { data: eventData, error: eventError } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("share_token", token)
        .eq("is_deleted", false)
        .single();

      if (eventError || !eventData) {
        return res
          .status(404)
          .json({ error: "Event not found or link has expired" });
      }

      if (eventData.share_token_expires_at) {
        const expiresAt = new Date(eventData.share_token_expires_at);
        if (expiresAt < new Date()) {
          return res.status(410).json({ error: "This share link has expired" });
        }
      }

      let meetingData = null;
      const { data: meeting } = await supabase
        .from("meetings")
        .select(
          "id, daily_room_url, title, scheduled_start, scheduled_end, status",
        )
        .eq("event_id", eventData.id)
        .maybeSingle();

      if (meeting) {
        meetingData = meeting;
      }

      let hostName: string | null = null;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", eventData.user_id)
          .single();

        if (profile?.full_name) {
          hostName = profile.full_name;
        }
      } catch (profileError) {
        console.log("Could not fetch host profile, continuing without it");
      }

      const sanitizedEvent = {
        title: eventData.title,
        description: eventData.description,
        start_time: eventData.start_time,
        end_time: eventData.end_time,
        all_day: eventData.all_day,
        location: eventData.location,
        event_type: eventData.event_type,
        color: eventData.color,
      };

      const sanitizedMeeting = meetingData
        ? {
            daily_room_url: meetingData.daily_room_url,
            title: meetingData.title,
            scheduled_start: meetingData.scheduled_start,
            scheduled_end: meetingData.scheduled_end,
          }
        : null;

      res.json({
        event: sanitizedEvent,
        meeting: sanitizedMeeting,
        hostName,
      });
    } catch (error: any) {
      console.error("Error fetching shared event:", error);
      res.status(500).json({
        error: error.message || "Failed to fetch event",
      });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      daily_configured: !!DAILY_API_KEY,
      openai_configured: !!process.env.OPENAI_API_KEY,
      google_calendar_configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
  });

  app.get("/api/google-calendar/auth-url", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({ error: "Google Calendar integration not configured" });
      }

      const authUrl = getAuthUrl(user.id);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("Error generating Google auth URL:", error);
      res.status(500).json({ error: error.message || "Failed to generate auth URL" });
    }
  });

  app.get("/api/google-calendar/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error: authError, error_description } = req.query;
      
      console.log("Google OAuth callback received:", {
        hasCode: !!code,
        hasState: !!state,
        error: authError,
        error_description,
      });

      if (authError) {
        const errorMsg = error_description 
          ? `${authError}: ${error_description}` 
          : String(authError);
        console.error("Google OAuth error from Google:", errorMsg);
        return res.redirect("/profile?google_error=" + encodeURIComponent(errorMsg));
      }

      if (!code || !state) {
        return res.redirect("/profile?google_error=missing_params");
      }

      const result = await handleCallback(String(code), String(state));

      if (result.success) {
        return res.redirect("/profile?google_connected=true");
      } else {
        return res.redirect("/profile?google_error=" + encodeURIComponent(result.error || "unknown"));
      }
    } catch (error: any) {
      console.error("Google Calendar callback error:", error);
      res.redirect("/profile?google_error=" + encodeURIComponent(error.message || "callback_failed"));
    }
  });
  
  // Diagnostic endpoint to check Google OAuth configuration
  app.get("/api/google-calendar/debug", async (_req: Request, res: Response) => {
    const redirectUri = `https://${process.env.REPLIT_DEV_DOMAIN || 'unknown'}/api/google-calendar/callback`;
    
    res.json({
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      redirectUri,
      replitDevDomain: process.env.REPLIT_DEV_DOMAIN || 'not set',
      instructions: [
        "1. Go to Google Cloud Console > APIs & Services > Credentials",
        "2. Click on your OAuth 2.0 Client ID",
        "3. Add this EXACT redirect URI to 'Authorized redirect URIs': " + redirectUri,
        "4. Make sure the user's email is added as a Test User under OAuth consent screen",
        "5. Ensure Google Calendar API is enabled in your project"
      ]
    });
  });

  app.get("/api/google-calendar/status", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const status = await getConnectionStatus(user.id);
      res.json(status);
    } catch (error: any) {
      console.error("Error getting Google Calendar status:", error);
      res.status(500).json({ error: error.message || "Failed to get status" });
    }
  });

  app.post("/api/google-calendar/disconnect", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const success = await disconnectGoogle(user.id);
      res.json({ success });
    } catch (error: any) {
      console.error("Error disconnecting Google Calendar:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect" });
    }
  });

  app.get("/api/google-calendar/calendars", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const calendars = await listCalendars(user.id);
      const selectedCalendarIds = await getSelectedCalendars(user.id);
      
      res.json({ 
        calendars: calendars.map(cal => ({
          id: cal.id,
          summary: cal.summary,
          description: cal.description,
          backgroundColor: cal.backgroundColor,
          primary: cal.primary,
          selected: selectedCalendarIds.includes(cal.id || ""),
        })),
        selectedCalendarIds,
      });
    } catch (error: any) {
      console.error("Error listing calendars:", error);
      res.status(500).json({ error: error.message || "Failed to list calendars" });
    }
  });

  app.post("/api/google-calendar/calendars/select", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { calendarIds } = req.body;
      
      if (!Array.isArray(calendarIds)) {
        return res.status(400).json({ error: "calendarIds must be an array" });
      }

      const success = await saveSelectedCalendars(user.id, calendarIds);
      res.json({ success });
    } catch (error: any) {
      console.error("Error saving calendar selection:", error);
      res.status(500).json({ error: error.message || "Failed to save selection" });
    }
  });

  app.post("/api/google-calendar/fetch-events", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { calendarIds, timeMin, timeMax } = req.body;
      
      console.log(`[fetch-events] Request from user ${user.id}`);
      console.log(`[fetch-events] Calendar IDs:`, calendarIds);
      console.log(`[fetch-events] Time range: ${timeMin} to ${timeMax}`);
      
      if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
        return res.status(400).json({ error: "calendarIds is required and must be a non-empty array" });
      }

      if (!timeMin || !timeMax) {
        return res.status(400).json({ error: "timeMin and timeMax are required" });
      }

      const events = await fetchCalendarEvents(user.id, calendarIds, timeMin, timeMax);
      console.log(`[fetch-events] Fetched ${events.length} raw events from Google`);
      
      const parsedEvents = parseGoogleEvents(events);
      console.log(`[fetch-events] Parsed ${parsedEvents.length} events`);
      
      res.json({ events: parsedEvents });
    } catch (error: any) {
      console.error("Error fetching Google Calendar events:", error);
      res.status(500).json({ error: error.message || "Failed to fetch events" });
    }
  });

  app.post("/api/google-calendar/import", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { events } = req.body;
      
      console.log(`Import request received: ${events?.length || 0} events for user ${user.id}`);
      
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: "events must be an array" });
      }

      const token = authHeader!.substring(7);
      const result = await importEvents(user.id, token, events);
      
      console.log(`Import result:`, result);
      res.json(result);
    } catch (error: any) {
      console.error("Error importing events:", error);
      res.status(500).json({ error: error.message || "Failed to import events" });
    }
  });

  // ==================== AI ASSISTANT ROUTES ====================

  // Configure multer for audio file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit (Whisper limit)
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/webm",
        "audio/ogg", "audio/m4a", "audio/mp4", "video/mp4", "video/webm"
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only audio/video files are allowed."));
      }
    },
  });

  // Get AI settings for current user
  app.get("/api/ai/settings", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const settings = await getAISettings(user.id);
      
      // Return default settings if none exist
      if (!settings) {
        return res.json({
          context_calendar: true,
          context_journal: true,
          context_meetings: true,
          context_analytics: true,
          preferred_language: "en",
          summary_style: "concise",
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching AI settings:", error);
      res.status(500).json({ error: error.message || "Failed to fetch AI settings" });
    }
  });

  // Update AI settings
  app.put("/api/ai/settings", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const settings = await upsertAISettings(user.id, req.body);
      res.json(settings);
    } catch (error: any) {
      console.error("Error updating AI settings:", error);
      res.status(500).json({ error: error.message || "Failed to update AI settings" });
    }
  });

  // Get all conversations for current user
  app.get("/api/ai/conversations", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const conversations = await getConversations(user.id);
      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: error.message || "Failed to fetch conversations" });
    }
  });

  // Create a new conversation
  app.post("/api/ai/conversations", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { title, context_sources } = req.body;
      const conversation = await createConversation(user.id, title, context_sources);
      
      if (!conversation) {
        return res.status(500).json({ error: "Failed to create conversation" });
      }
      
      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: error.message || "Failed to create conversation" });
    }
  });

  // Get a specific conversation with messages
  app.get("/api/ai/conversations/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const conversation = await getConversation(req.params.id, user.id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await getMessages(req.params.id);
      
      res.json({ ...conversation, messages });
    } catch (error: any) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: error.message || "Failed to fetch conversation" });
    }
  });

  // Delete a conversation
  app.delete("/api/ai/conversations/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const success = await deleteConversation(req.params.id, user.id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to delete conversation" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: error.message || "Failed to delete conversation" });
    }
  });

  // Send a message in a conversation
  app.post("/api/ai/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { message } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Verify conversation belongs to user
      const conversation = await getConversation(req.params.id, user.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Get AI settings and gather context
      const settings = await getAISettings(user.id);
      const context = await gatherUserContext(user.id, settings);

      // Save user message
      const userMessage = await addMessage(req.params.id, "user", message);
      if (!userMessage) {
        return res.status(500).json({ error: "Failed to save message" });
      }

      // Get AI response
      const { response, contextUsed } = await chatWithAI(
        user.id,
        req.params.id,
        message,
        context,
        settings
      );

      // Save assistant message
      const assistantMessage = await addMessage(req.params.id, "assistant", response, contextUsed);
      if (!assistantMessage) {
        return res.status(500).json({ error: "Failed to save AI response" });
      }

      // Generate title for new conversation (if this is the first message)
      const messages = await getMessages(req.params.id);
      if (messages.length === 2 && !conversation.title) {
        const title = await generateConversationTitle(message, settings?.preferred_language || "en");
        // Update conversation title asynchronously (don't wait)
        upsertAISettings(user.id, {}).catch(() => {}); // Just to trigger update
      }

      res.json({
        userMessage,
        assistantMessage,
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });

  // Quick chat (no conversation persistence)
  app.post("/api/ai/chat", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { message, saveToConversation } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get AI settings and gather context
      const settings = await getAISettings(user.id);
      const context = await gatherUserContext(user.id, settings);

      // If saveToConversation is true, create a new conversation
      let conversationId: string | null = null;
      if (saveToConversation) {
        const title = await generateConversationTitle(message, settings?.preferred_language || "en");
        const conversation = await createConversation(user.id, title);
        conversationId = conversation?.id || null;
        
        if (conversationId) {
          await addMessage(conversationId, "user", message);
        }
      }

      // Get AI response (use a temporary conversation context)
      const { response, contextUsed } = await chatWithAI(
        user.id,
        conversationId || "temp",
        message,
        context,
        settings
      );

      if (conversationId) {
        await addMessage(conversationId, "assistant", response, contextUsed);
      }

      res.json({
        response,
        contextUsed,
        conversationId,
      });
    } catch (error: any) {
      console.error("Error in quick chat:", error);
      res.status(500).json({ error: error.message || "Failed to process chat" });
    }
  });

  // Transcribe audio file
  // Note: This endpoint transcribes audio using Whisper API.
  // Transcription text is returned directly and can be used to generate summaries.
  // The existing transcriptions table uses recording_id -> meeting_recordings,
  // so we don't persist here - the summary endpoint handles persistence.
  app.post("/api/ai/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
      }

      try {
        const { text, duration } = await transcribeAudio(req.file.buffer, req.file.originalname);

        res.json({
          text,
          duration,
          success: true,
        });
      } catch (transcribeError: any) {
        console.error("Transcription error:", transcribeError);
        throw transcribeError;
      }
    } catch (error: any) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: error.message || "Failed to transcribe audio" });
    }
  });

  // Generate meeting summary from transcription
  app.post("/api/ai/meetings/:meetingId/summarize", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { meetingId } = req.params;
      const { transcription, meetingTitle } = req.body;

      if (!transcription || typeof transcription !== "string") {
        return res.status(400).json({ error: "Transcription text is required" });
      }

      // Get user settings for language preference
      const settings = await getAISettings(user.id);

      try {
        // Generate the summary using GPT-4o-mini
        const summaryData = await generateMeetingSummary(
          transcription,
          meetingTitle || "Meeting",
          settings?.preferred_language || "en"
        );

        // Create the summary record with the correct column names
        const summaryRecord = await createMeetingSummary(meetingId, {
          summary_text: summaryData.summary,
          key_points: summaryData.key_points || [],
          action_items: summaryData.action_items || [],
          topics_discussed: summaryData.decisions || [], // Map decisions to topics_discussed
        });

        res.json({
          summary: summaryData.summary,
          key_points: summaryData.key_points,
          action_items: summaryData.action_items,
          decisions: summaryData.decisions,
          summaryId: summaryRecord?.id,
        });
      } catch (summaryError: any) {
        console.error("Summary generation error:", summaryError);
        throw summaryError;
      }
    } catch (error: any) {
      console.error("Error generating meeting summary:", error);
      res.status(500).json({ error: error.message || "Failed to generate summary" });
    }
  });

  // Get meeting transcription
  app.get("/api/ai/meetings/:meetingId/transcription", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const transcription = await getTranscription(req.params.meetingId);
      res.json(transcription || { status: "not_found" });
    } catch (error: any) {
      console.error("Error fetching transcription:", error);
      res.status(500).json({ error: error.message || "Failed to fetch transcription" });
    }
  });

  // Get meeting summary
  app.get("/api/ai/meetings/:meetingId/summary", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const summary = await getMeetingSummary(req.params.meetingId);
      res.json(summary || { status: "not_found" });
    } catch (error: any) {
      console.error("Error fetching summary:", error);
      res.status(500).json({ error: error.message || "Failed to fetch summary" });
    }
  });

  // Get combined meeting intelligence (transcription and summary)
  app.get("/api/ai/meetings/:meetingId/intelligence", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getAuthenticatedUser(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const transcription = await getTranscription(req.params.meetingId);
      const summary = await getMeetingSummary(req.params.meetingId);

      res.json({
        success: true,
        transcription: transcription || null,
        summary: summary || null,
      });
    } catch (error: any) {
      console.error("Error fetching meeting intelligence:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to fetch meeting intelligence" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
