import { google, calendar_v3 } from "googleapis";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { supabase, getAuthenticatedUser, createAuthenticatedClient } from "./supabase";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Service role client for bypassing RLS when storing tokens
function getServiceRoleClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key");
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
}

function getEncryptionKey(): string {
  const key = process.env.SESSION_SECRET;
  if (!key) {
    throw new Error("SESSION_SECRET environment variable is required for secure token encryption");
  }
  return key;
}

function getRedirectUri(): string {
  const host = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG 
    ? `https://${process.env.REPLIT_DEV_DOMAIN || `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`}`
    : "http://localhost:5000";
  return `${host}/api/google-calendar/callback`;
}

function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

function encrypt(text: string): string {
  const encryptionKey = getEncryptionKey();
  const key = crypto.scryptSync(encryptionKey, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string): string {
  const encryptionKey = getEncryptionKey();
  const key = crypto.scryptSync(encryptionKey, "salt", 32);
  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function getAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();
  
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  
  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const redirectUri = getRedirectUri();
  console.log("Generating Google Auth URL with redirect URI:", redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state,
    prompt: "consent",
  });
}

export async function handleCallback(code: string, state: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Google OAuth callback - Starting token exchange");
    console.log("Redirect URI being used:", getRedirectUri());
    
    const { userId } = JSON.parse(Buffer.from(state, "base64").toString());
    console.log("User ID from state:", userId);
    
    const oauth2Client = createOAuth2Client();
    
    let tokens;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      console.log("Token exchange successful, got access_token:", !!tokens.access_token);
    } catch (tokenError: any) {
      console.error("Token exchange failed:", tokenError.message);
      console.error("Token error details:", JSON.stringify(tokenError.response?.data || tokenError, null, 2));
      return { success: false, error: `Token exchange failed: ${tokenError.message}` };
    }
    
    if (!tokens.access_token) {
      return { success: false, error: "No access token received" };
    }

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    
    // Get user's Google email for display
    let googleEmail: string | null = null;
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      googleEmail = userInfo.data.email || null;
      console.log("Got Google user email:", googleEmail);
    } catch (emailError) {
      console.error("Could not fetch Google user email:", emailError);
    }
    
    // Use service role client to bypass RLS for storing tokens
    const serviceClient = getServiceRoleClient();
    const { error } = await serviceClient
      .from("google_calendar_connections")
      .upsert({
        user_id: userId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        is_connected: true,
        google_email: googleEmail,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (error) {
      console.error("Error storing Google tokens:", error);
      return { success: false, error: "Failed to store tokens" };
    }

    console.log("Google OAuth callback - Success, tokens stored");
    return { success: true };
  } catch (error: any) {
    console.error("Google OAuth callback error:", error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    return { success: false, error: error.message };
  }
}

async function getAuthenticatedOAuth2Client(userId: string): Promise<ReturnType<typeof createOAuth2Client> | null> {
  const serviceClient = getServiceRoleClient();
  const { data: connection, error } = await serviceClient
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("is_connected", true)
    .single();

  if (error || !connection) {
    return null;
  }

  const oauth2Client = createOAuth2Client();
  
  try {
    const accessToken = decrypt(connection.access_token);
    const refreshToken = connection.refresh_token ? decrypt(connection.refresh_token) : null;

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: connection.token_expiry ? new Date(connection.token_expiry).getTime() : undefined,
    });

    const tokenExpiry = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0;
    if (tokenExpiry < Date.now() && refreshToken) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      const encryptedNewAccessToken = encrypt(credentials.access_token!);
      
      await serviceClient
        .from("google_calendar_connections")
        .update({
          access_token: encryptedNewAccessToken,
          token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    return oauth2Client;
  } catch (error) {
    console.error("Error getting authenticated OAuth client:", error);
    return null;
  }
}

export async function getConnectionStatus(userId: string): Promise<{ connected: boolean; email?: string }> {
  const serviceClient = getServiceRoleClient();
  const { data: connection } = await serviceClient
    .from("google_calendar_connections")
    .select("is_connected, google_email")
    .eq("user_id", userId)
    .single();

  return {
    connected: connection?.is_connected ?? false,
    email: connection?.google_email,
  };
}

export async function disconnectGoogle(userId: string): Promise<boolean> {
  const serviceClient = getServiceRoleClient();
  const { error } = await serviceClient
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", userId);

  return !error;
}

export async function listCalendars(userId: string): Promise<calendar_v3.Schema$CalendarListEntry[]> {
  const oauth2Client = await getAuthenticatedOAuth2Client(userId);
  if (!oauth2Client) {
    throw new Error("Not connected to Google Calendar");
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const response = await calendar.calendarList.list();
  
  return response.data.items || [];
}

export async function fetchCalendarEvents(
  userId: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string
): Promise<Array<calendar_v3.Schema$Event & { calendarId: string; calendarName: string; calendarColor: string }>> {
  const oauth2Client = await getAuthenticatedOAuth2Client(userId);
  if (!oauth2Client) {
    throw new Error("Not connected to Google Calendar");
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const allEvents: Array<calendar_v3.Schema$Event & { calendarId: string; calendarName: string; calendarColor: string }> = [];

  const calendarsResponse = await calendar.calendarList.list();
  const calendarMap = new Map<string, { name: string; color: string }>();
  
  for (const cal of calendarsResponse.data.items || []) {
    if (cal.id) {
      calendarMap.set(cal.id, {
        name: cal.summary || "Unnamed Calendar",
        color: cal.backgroundColor || "#4285f4",
      });
    }
  }

  for (const calendarId of calendarIds) {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      });

      const calendarInfo = calendarMap.get(calendarId) || { name: "Unknown", color: "#4285f4" };
      
      for (const event of response.data.items || []) {
        allEvents.push({
          ...event,
          calendarId,
          calendarName: calendarInfo.name,
          calendarColor: calendarInfo.color,
        });
      }
    } catch (error) {
      console.error(`Error fetching events from calendar ${calendarId}:`, error);
    }
  }

  return allEvents;
}

export interface GoogleEventToImport {
  googleEventId: string;
  googleCalendarId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string | null;
  calendarName: string;
  calendarColor: string;
}

export function parseGoogleEvents(
  events: Array<calendar_v3.Schema$Event & { calendarId: string; calendarName: string; calendarColor: string }>
): GoogleEventToImport[] {
  return events
    .filter(event => event.id && (event.start?.dateTime || event.start?.date))
    .map(event => ({
      googleEventId: event.id!,
      googleCalendarId: event.calendarId,
      title: event.summary || "Untitled Event",
      description: event.description || null,
      startTime: event.start?.dateTime || `${event.start?.date}T00:00:00`,
      endTime: event.end?.dateTime || `${event.end?.date}T23:59:59`,
      allDay: !event.start?.dateTime,
      location: event.location || null,
      calendarName: event.calendarName,
      calendarColor: event.calendarColor,
    }));
}

export async function importEvents(
  userId: string,
  _authToken: string,
  events: GoogleEventToImport[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  // Use service role client to bypass RLS for importing events
  const serviceClient = getServiceRoleClient();
  
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  console.log(`Starting import of ${events.length} events for user ${userId}`);

  for (const event of events) {
    try {
      // Check if event already exists
      const { data: existing } = await serviceClient
        .from("calendar_events")
        .select("id")
        .eq("user_id", userId)
        .eq("google_event_id", event.googleEventId)
        .eq("is_deleted", false)
        .single();

      if (existing) {
        console.log(`Skipping existing event: ${event.title}`);
        skipped++;
        continue;
      }

      const { error: insertError } = await serviceClient
        .from("calendar_events")
        .insert({
          user_id: userId,
          title: event.title,
          description: event.description,
          start_time: event.startTime,
          end_time: event.endTime,
          all_day: event.allDay,
          location: event.location,
          event_type: "imported",
          source: "google",
          google_event_id: event.googleEventId,
          google_calendar_id: event.googleCalendarId,
          color_tag: event.calendarColor,
          timezone: "UTC",
        });

      if (insertError) {
        console.error(`Failed to import "${event.title}":`, insertError);
        errors.push(`Failed to import "${event.title}": ${insertError.message}`);
      } else {
        console.log(`Imported event: ${event.title}`);
        imported++;
      }
    } catch (error: any) {
      console.error(`Error importing "${event.title}":`, error);
      errors.push(`Error importing "${event.title}": ${error.message}`);
    }
  }

  console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);
  return { imported, skipped, errors };
}

export async function getSelectedCalendars(userId: string): Promise<string[]> {
  const serviceClient = getServiceRoleClient();
  const { data } = await serviceClient
    .from("google_calendar_connections")
    .select("selected_calendar_ids")
    .eq("user_id", userId)
    .single();

  return data?.selected_calendar_ids || [];
}

export async function saveSelectedCalendars(userId: string, calendarIds: string[]): Promise<boolean> {
  const serviceClient = getServiceRoleClient();
  const { error } = await serviceClient
    .from("google_calendar_connections")
    .update({
      selected_calendar_ids: calendarIds,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return !error;
}
