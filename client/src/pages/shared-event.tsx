import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  ExternalLink,
  CalendarCheck,
  User,
  AlertCircle
} from "lucide-react";

interface SharedEventData {
  event: {
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    all_day: boolean;
    location: string | null;
    event_type: string;
    color: string | null;
  };
  meeting: {
    daily_room_url: string;
    title: string;
    scheduled_start: string;
    scheduled_end: string;
  } | null;
  hostName: string | null;
}

export default function SharedEventPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedEventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedEvent() {
      if (!token) {
        setError("Invalid share link");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/shared-event/${token}`);
        
        if (response.status === 404) {
          setError("Event not found or link has expired");
          setLoading(false);
          return;
        }
        
        if (response.status === 410) {
          setError("This share link has expired");
          setLoading(false);
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Failed to load event");
          setLoading(false);
          return;
        }

        const eventData = await response.json();
        setData(eventData);
      } catch (err) {
        console.error("Error fetching shared event:", err);
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    fetchSharedEvent();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Event Not Available</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The event you're looking for might have been removed, the link may have expired, 
              or you may not have permission to view it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { event, meeting, hostName } = data;
  const startDate = parseISO(event.start_time);
  const endDate = parseISO(event.end_time);
  const isMultiDay = format(startDate, "yyyy-MM-dd") !== format(endDate, "yyyy-MM-dd");

  const eventTypeColors: Record<string, string> = {
    meeting: "bg-blue-500",
    task: "bg-green-500",
    personal: "bg-purple-500",
    reminder: "bg-yellow-500",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge 
              className={`${eventTypeColors[event.event_type] || "bg-gray-500"} text-white`}
              data-testid="badge-event-type"
            >
              {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
            </Badge>
            {event.all_day && (
              <Badge variant="outline" data-testid="badge-all-day">All Day</Badge>
            )}
          </div>
          <CardTitle className="text-2xl" data-testid="text-event-title">{event.title}</CardTitle>
          {hostName && (
            <CardDescription className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Hosted by {hostName}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium" data-testid="text-event-date">
                  {event.all_day ? (
                    isMultiDay ? (
                      `${format(startDate, "EEEE, MMMM d")} - ${format(endDate, "EEEE, MMMM d, yyyy")}`
                    ) : (
                      format(startDate, "EEEE, MMMM d, yyyy")
                    )
                  ) : (
                    format(startDate, "EEEE, MMMM d, yyyy")
                  )}
                </p>
                {!event.all_day && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-event-time">
                    <Clock className="h-4 w-4" />
                    {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                    {isMultiDay && ` (${format(endDate, "MMM d")})`}
                  </p>
                )}
              </div>
            </div>

            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <p data-testid="text-event-location">{event.location}</p>
              </div>
            )}
          </div>

          {event.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-event-description">
                  {event.description}
                </p>
              </div>
            </>
          )}

          {meeting && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Video Call</h3>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Join the video call when the event starts
                  </p>
                  <Button asChild className="w-full" data-testid="button-join-call">
                    <a
                      href={meeting.daily_room_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Join Video Call
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck className="h-4 w-4" />
            <span>Shared via Desk Mate</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
