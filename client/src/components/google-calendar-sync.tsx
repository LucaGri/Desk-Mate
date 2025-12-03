import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Check,
  Loader2,
  RefreshCw,
  Unlink,
  AlertTriangle,
  Import,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { format, subDays, addDays } from "date-fns";

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  primary: boolean;
  selected: boolean;
}

interface GoogleEvent {
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

interface ConflictingEvent {
  event: GoogleEvent;
  conflicts: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  }>;
}

interface ConnectionStatus {
  connected: boolean;
  email?: string;
}

interface CalendarsData {
  calendars: GoogleCalendar[];
  selectedCalendarIds: string[];
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error("[fetchWithAuth] No session available");
    throw new Error("Not authenticated");
  }
  
  console.log("[fetchWithAuth] Making request to:", url);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });
    console.log("[fetchWithAuth] Response received, status:", response.status);
    return response;
  } catch (error) {
    console.error("[fetchWithAuth] Fetch error:", error);
    throw error;
  }
}

export function GoogleCalendarSync() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [eventsToImport, setEventsToImport] = useState<GoogleEvent[]>([]);
  const [conflictingEvents, setConflictingEvents] = useState<ConflictingEvent[]>([]);
  const [importRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 7),
    end: addDays(new Date(), 30),
  });

  const { data: connectionStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<ConnectionStatus>({
    queryKey: ["/api/google-calendar/status"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/google-calendar/status");
      if (!response.ok) throw new Error("Failed to get status");
      return response.json();
    },
  });

  const { data: calendarsData, isLoading: calendarsLoading, refetch: refetchCalendars } = useQuery<CalendarsData>({
    queryKey: ["/api/google-calendar/calendars"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/google-calendar/calendars");
      if (!response.ok) throw new Error("Failed to get calendars");
      return response.json();
    },
    enabled: connectionStatus?.connected === true,
  });

  useEffect(() => {
    if (calendarsData?.selectedCalendarIds) {
      setSelectedCalendarIds(calendarsData.selectedCalendarIds);
    }
  }, [calendarsData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      toast({
        title: t("googleCalendar.connected"),
        description: t("googleCalendar.connectedDescription"),
      });
      refetchStatus();
      refetchCalendars();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("google_error")) {
      toast({
        title: t("googleCalendar.connectionFailed"),
        description: params.get("google_error"),
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth("/api/google-calendar/auth-url");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get auth URL");
      }
      const { authUrl } = await response.json();
      return authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: t("googleCalendar.connectionFailed"),
        description: error.message,
        variant: "destructive",
      });
      setConnecting(false);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth("/api/google-calendar/disconnect", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to disconnect");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("googleCalendar.disconnected"),
        description: t("googleCalendar.disconnectedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/calendars"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("errors.generic"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveSelectionMutation = useMutation({
    mutationFn: async (calendarIds: string[]) => {
      const response = await fetchWithAuth("/api/google-calendar/calendars/select", {
        method: "POST",
        body: JSON.stringify({ calendarIds }),
      });
      if (!response.ok) throw new Error("Failed to save selection");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("googleCalendar.selectionSaved"),
        description: t("googleCalendar.selectionSavedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/calendars"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("errors.generic"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const fetchEventsMutation = useMutation({
    mutationFn: async () => {
      console.log("[GoogleCalendarSync] Fetching events from Google Calendar...");
      console.log("[GoogleCalendarSync] Calendar IDs:", selectedCalendarIds);
      console.log("[GoogleCalendarSync] Time range:", importRange.start.toISOString(), "to", importRange.end.toISOString());
      
      const response = await fetchWithAuth("/api/google-calendar/fetch-events", {
        method: "POST",
        body: JSON.stringify({
          calendarIds: selectedCalendarIds,
          timeMin: importRange.start.toISOString(),
          timeMax: importRange.end.toISOString(),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("[GoogleCalendarSync] Fetch events failed:", error);
        throw new Error(error.error || "Failed to fetch events");
      }
      const result = await response.json();
      console.log("[GoogleCalendarSync] Fetched events:", result.events?.length || 0, "events");
      return result;
    },
    onSuccess: async (data) => {
      try {
        console.log("[GoogleCalendarSync] Processing fetched events...");
        console.log("[GoogleCalendarSync] Events data:", data.events);
        
        // Query existing events to check for conflicts
        let existingEvents: Array<{ id: string; title: string; start_time: string; end_time: string }> = [];
        
        try {
          const { data: eventsData, error: fetchError } = await supabase
            .from("calendar_events")
            .select("id, title, start_time, end_time")
            .eq("is_deleted", false);
          
          if (fetchError) {
            console.error("[GoogleCalendarSync] Error fetching existing events:", fetchError);
            // Continue without conflict checking if we can't fetch existing events
          } else {
            existingEvents = eventsData || [];
          }
        } catch (queryError) {
          console.error("[GoogleCalendarSync] Exception fetching existing events:", queryError);
          // Continue without conflict checking
        }
        
        console.log("[GoogleCalendarSync] Existing events:", existingEvents.length);
        
        const conflicts: ConflictingEvent[] = [];
        const nonConflicting: GoogleEvent[] = [];
        
        for (const event of data.events) {
          const eventStart = new Date(event.startTime).getTime();
          const eventEnd = new Date(event.endTime).getTime();
          
          const overlapping = existingEvents.filter((existing) => {
            const existingStart = new Date(existing.start_time).getTime();
            const existingEnd = new Date(existing.end_time).getTime();
            return eventStart < existingEnd && eventEnd > existingStart;
          });
          
          if (overlapping.length > 0) {
            conflicts.push({ event, conflicts: overlapping });
          } else {
            nonConflicting.push(event);
          }
        }
        
        console.log("[GoogleCalendarSync] Conflicts:", conflicts.length);
        console.log("[GoogleCalendarSync] Non-conflicting:", nonConflicting.length);
        
        if (conflicts.length > 0) {
          console.log("[GoogleCalendarSync] Showing conflict dialog");
          setConflictingEvents(conflicts);
          setEventsToImport(nonConflicting);
          setShowConflictDialog(true);
        } else {
          console.log("[GoogleCalendarSync] Showing import dialog");
          setEventsToImport(data.events);
          setShowImportDialog(true);
        }
      } catch (error) {
        console.error("[GoogleCalendarSync] Error in onSuccess handler:", error);
        // Fallback: just show all events for import without conflict checking
        console.log("[GoogleCalendarSync] Fallback: showing all events for import");
        setEventsToImport(data.events);
        setShowImportDialog(true);
      }
    },
    onError: (error: Error) => {
      console.error("[GoogleCalendarSync] Fetch mutation error:", error);
      toast({
        title: t("googleCalendar.fetchFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (events: GoogleEvent[]) => {
      console.log("[GoogleCalendarSync] Starting import of", events.length, "events");
      console.log("[GoogleCalendarSync] Events to import:", events);
      
      const response = await fetchWithAuth("/api/google-calendar/import", {
        method: "POST",
        body: JSON.stringify({ events }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[GoogleCalendarSync] Import failed:", errorData);
        throw new Error(errorData.error || "Failed to import events");
      }
      
      const result = await response.json();
      console.log("[GoogleCalendarSync] Import result:", result);
      return result;
    },
    onSuccess: (result) => {
      console.log("[GoogleCalendarSync] Import success:", result);
      toast({
        title: t("googleCalendar.importComplete"),
        description: t("googleCalendar.importedCount", { count: result.imported }),
      });
      setShowImportDialog(false);
      setShowConflictDialog(false);
      setEventsToImport([]);
      setConflictingEvents([]);
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
    },
    onError: (error: Error) => {
      console.error("[GoogleCalendarSync] Import mutation error:", error);
      toast({
        title: t("googleCalendar.importFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    setConnecting(true);
    connectMutation.mutate();
  };

  const handleCalendarToggle = (calendarId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedCalendarIds, calendarId]
      : selectedCalendarIds.filter((id) => id !== calendarId);
    setSelectedCalendarIds(newSelection);
  };

  const handleSaveSelection = () => {
    saveSelectionMutation.mutate(selectedCalendarIds);
  };

  const handleSync = () => {
    console.log("[GoogleCalendarSync] handleSync called");
    console.log("[GoogleCalendarSync] selectedCalendarIds:", selectedCalendarIds);
    
    if (selectedCalendarIds.length === 0) {
      console.log("[GoogleCalendarSync] No calendars selected, showing error toast");
      toast({
        title: t("googleCalendar.noCalendarsSelected"),
        description: t("googleCalendar.selectCalendarsFirst"),
        variant: "destructive",
      });
      return;
    }
    console.log("[GoogleCalendarSync] Calling fetchEventsMutation.mutate()");
    fetchEventsMutation.mutate();
  };

  const handleImportSelected = () => {
    console.log("[GoogleCalendarSync] handleImportSelected called with", eventsToImport.length, "events");
    importMutation.mutate(eventsToImport);
  };

  const handleAddConflictingEvent = (event: GoogleEvent) => {
    setEventsToImport([...eventsToImport, event]);
    setConflictingEvents(conflictingEvents.filter((c) => c.event.googleEventId !== event.googleEventId));
  };

  const handleSkipConflictingEvent = (event: GoogleEvent) => {
    setConflictingEvents(conflictingEvents.filter((c) => c.event.googleEventId !== event.googleEventId));
  };

  const handleProceedWithImport = () => {
    setShowConflictDialog(false);
    if (eventsToImport.length > 0) {
      setShowImportDialog(true);
    } else {
      toast({
        title: t("googleCalendar.noEventsToImport"),
        description: t("googleCalendar.allEventsSkipped"),
      });
    }
  };

  if (statusLoading) {
    return (
      <Card data-testid="card-google-calendar">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SiGoogle className="h-5 w-5" />
            <CardTitle>{t("googleCalendar.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="card-google-calendar">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SiGoogle className="h-5 w-5" />
            <CardTitle>{t("googleCalendar.title")}</CardTitle>
          </div>
          <CardDescription>{t("googleCalendar.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectionStatus?.connected ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <p className="text-sm text-muted-foreground text-center">
                {t("googleCalendar.connectPrompt")}
              </p>
              <Button
                type="button"
                onClick={handleConnect}
                disabled={connecting || connectMutation.isPending}
                data-testid="button-connect-google"
              >
                {connecting || connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <SiGoogle className="h-4 w-4 mr-2" />
                )}
                {t("googleCalendar.connectButton")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{t("googleCalendar.connectedStatus")}</span>
                  {connectionStatus.email && (
                    <Badge variant="secondary">{connectionStatus.email}</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-google"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  {t("googleCalendar.disconnect")}
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-sm font-medium">{t("googleCalendar.selectCalendars")}</h4>
                {calendarsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : calendarsData?.calendars && calendarsData.calendars.length > 0 ? (
                  <ScrollArea className="h-[200px] rounded-md border p-3">
                    <div className="space-y-3">
                      {calendarsData.calendars.map((calendar: GoogleCalendar) => (
                        <div
                          key={calendar.id}
                          className="flex items-center gap-3"
                          data-testid={`calendar-item-${calendar.id}`}
                        >
                          <Checkbox
                            id={calendar.id}
                            checked={selectedCalendarIds.includes(calendar.id)}
                            onCheckedChange={(checked) =>
                              handleCalendarToggle(calendar.id, checked as boolean)
                            }
                            data-testid={`checkbox-calendar-${calendar.id}`}
                          />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: calendar.backgroundColor }}
                          />
                          <label
                            htmlFor={calendar.id}
                            className="text-sm flex-1 cursor-pointer"
                          >
                            {calendar.summary}
                            {calendar.primary && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {t("googleCalendar.primary")}
                              </Badge>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("googleCalendar.noCalendarsFound")}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveSelection}
                    disabled={saveSelectionMutation.isPending}
                    data-testid="button-save-calendar-selection"
                  >
                    {saveSelectionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    {t("googleCalendar.saveSelection")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSync}
                    disabled={
                      fetchEventsMutation.isPending ||
                      selectedCalendarIds.length === 0
                    }
                    data-testid="button-sync-now"
                  >
                    {fetchEventsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {t("googleCalendar.syncNow")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t("googleCalendar.conflictsFound")}
            </DialogTitle>
            <DialogDescription>
              {t("googleCalendar.conflictsDescription")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {conflictingEvents.map((item) => (
                <Card key={item.event.googleEventId} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.event.calendarColor }}
                          />
                          <span className="font-medium">{item.event.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(item.event.startTime), "PPp")} -{" "}
                          {format(new Date(item.event.endTime), "p")}
                        </p>
                        <Badge variant="secondary" className="mt-1">
                          {item.event.calendarName}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSkipConflictingEvent(item.event)}
                        >
                          {t("googleCalendar.skip")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddConflictingEvent(item.event)}
                        >
                          {t("googleCalendar.importAnyway")}
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded text-sm">
                      <p className="text-muted-foreground mb-1">
                        {t("googleCalendar.conflictsWith")}:
                      </p>
                      {item.conflicts.map((conflict) => (
                        <div key={conflict.id} className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>{conflict.title}</span>
                          <span className="text-muted-foreground">
                            ({format(new Date(conflict.start_time), "p")} -{" "}
                            {format(new Date(conflict.end_time), "p")})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowConflictDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleProceedWithImport}>
              {t("googleCalendar.proceedWithImport")} ({eventsToImport.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-5 w-5" />
              {t("googleCalendar.importEvents")}
            </DialogTitle>
            <DialogDescription>
              {t("googleCalendar.importEventsDescription", { count: eventsToImport.length })}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {eventsToImport.map((event) => (
                <div
                  key={event.googleEventId}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.calendarColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.startTime), "PPp")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {event.calendarName}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowImportDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleImportSelected}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Import className="h-4 w-4 mr-2" />
              )}
              {t("googleCalendar.importAll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
