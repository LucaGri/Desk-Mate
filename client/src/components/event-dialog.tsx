import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarEvent, EventType, CalendarEventInsert, EventAttachment, Meeting } from "@/lib/supabase-types";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Mic, 
  Bell,
  Loader2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Link2,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ListChecks,
  CheckCircle2,
  MessageSquare
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AttachmentUpload } from "./attachment-upload";

const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  start_date: z.string().min(1, "Start date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_date: z.string().min(1, "End date is required"),
  end_time: z.string().min(1, "End time is required"),
  all_day: z.boolean().default(false),
  event_type: z.enum(['meeting', 'task', 'personal', 'reminder'] as const).default('personal'),
  color_tag: z.string().optional(),
  has_video_call: z.boolean().default(false),
  recording_enabled: z.boolean().default(false),
  transcription_enabled: z.boolean().default(false),
}).refine((data) => {
  if (data.all_day) {
    return new Date(data.end_date) >= new Date(data.start_date);
  }
  const startDateTime = new Date(`${data.start_date}T${data.start_time}`);
  const endDateTime = new Date(`${data.end_date}T${data.end_time}`);
  return endDateTime > startDateTime;
}, {
  message: "End time must be after start time",
  path: ["end_time"],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  defaultTime?: string;
  userId: string;
  onEventSaved: () => void;
}

const colorOptions = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#eab308", label: "Yellow" },
  { value: "#f97316", label: "Orange" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6b7280", label: "Gray" },
];

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultTime,
  userId,
  onEventSaved,
}: EventDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [transcription, setTranscription] = useState<{ id: string; transcription_text: string; created_at: string } | null>(null);
  const [summary, setSummary] = useState<{ id: string; summary: any; created_at: string } | null>(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [transcriptionOpen, setTranscriptionOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!event;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const fetchAttachments = useCallback(async () => {
    if (!event) return;
    
    setAttachmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("event_attachments")
        .select("*")
        .eq("event_id", event.id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    } finally {
      setAttachmentsLoading(false);
    }
  }, [event]);

  const fetchMeeting = useCallback(async () => {
    if (!event) return;
    
    setMeetingLoading(true);
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("event_id", event.id)
        .maybeSingle();

      if (error) throw error;
      setMeeting(data);
    } catch (error) {
      console.error("Error fetching meeting:", error);
    } finally {
      setMeetingLoading(false);
    }
  }, [event]);

  useEffect(() => {
    if (open && event) {
      fetchAttachments();
      fetchMeeting();
    } else {
      setAttachments([]);
      setMeeting(null);
    }
  }, [open, event, fetchAttachments, fetchMeeting]);

  const copyMeetingLink = useCallback(async () => {
    if (!meeting?.daily_room_url) return;
    
    try {
      // Copy URL with host token for private room access
      const meetingUrl = meeting.host_meeting_token 
        ? `${meeting.daily_room_url}?t=${meeting.host_meeting_token}`
        : meeting.daily_room_url;
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: t('event.linkCopied'),
        description: t('event.meetingLinkCopied'),
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [meeting, toast]);

  const generateShareLink = useCallback(async () => {
    if (!event) return;

    setShareLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/events/${event.id}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ expiresInDays: 30 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate share link");
      }

      const { shareToken } = await response.json();
      const shareUrl = `${window.location.origin}/event/${shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
      
      toast({
        title: t('event.shareLinkCreated'),
        description: t('event.shareLinkCopiedDescription'),
      });

      onEventSaved();
    } catch (error: any) {
      console.error("Error generating share link:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('event.failedToGenerateShareLink'),
        variant: "destructive",
      });
    } finally {
      setShareLoading(false);
    }
  }, [event, toast, onEventSaved]);

  const copyExistingShareLink = useCallback(async () => {
    if (!event?.share_token) return;

    try {
      const shareUrl = `${window.location.origin}/event/${event.share_token}`;
      await navigator.clipboard.writeText(shareUrl);
      
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
      
      toast({
        title: t('event.linkCopied'),
        description: t('event.shareLinkCopiedDescription'),
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [event, toast]);

  const fetchTranscriptionAndSummary = useCallback(async () => {
    if (!meeting?.id) return;

    try {
      const response = await fetchWithAuth(`/api/ai/meetings/${meeting.id}/intelligence`);
      const data = await response.json();
      
      if (data.success) {
        setTranscription(data.transcription || null);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Failed to fetch transcription/summary:", error);
    }
  }, [meeting?.id]);

  useEffect(() => {
    if (meeting?.id && open) {
      fetchTranscriptionAndSummary();
    }
  }, [meeting?.id, open, fetchTranscriptionAndSummary]);

  const handleUploadAudio = () => {
    audioInputRef.current?.click();
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !meeting?.id) return;

    setTranscriptionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const formData = new FormData();
      formData.append("audio", file);
      formData.append("meetingId", meeting.id);

      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: formData,
      });
      
      const data = await response.json();
      
      if (!data.error && data.text) {
        setTranscription({
          id: data.transcriptionId,
          transcription_text: data.text,
          created_at: new Date().toISOString(),
        });
        toast({
          title: t('ai.transcription.transcribed'),
          description: t('ai.transcription.viewTranscription'),
        });
      } else {
        throw new Error(data.error || "Transcription failed");
      }
    } catch (error: any) {
      console.error("Failed to generate transcription:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('ai.transcription.errorTranscribing'),
        variant: "destructive",
      });
    } finally {
      setTranscriptionLoading(false);
      if (audioInputRef.current) {
        audioInputRef.current.value = "";
      }
    }
  };

  const handleGenerateSummary = async () => {
    if (!meeting?.id || !transcription) return;

    setSummaryLoading(true);
    try {
      const response = await fetchWithAuth(`/api/ai/meetings/${meeting.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({ 
          transcription: transcription.transcription_text,
          meetingTitle: event?.title || "Meeting",
        }),
      });
      
      const data = await response.json();
      
      if (!data.error) {
        setSummary({
          id: data.summaryId,
          summary: data,
          created_at: new Date().toISOString(),
        });
        toast({
          title: t('ai.summary.title'),
          description: t('ai.summary.viewSummary'),
        });
      } else {
        throw new Error(data.error || "Summary generation failed");
      }
    } catch (error: any) {
      console.error("Failed to generate summary:", error);
      toast({
        title: t('common.error'),
        description: t('ai.summary.errorGenerating'),
        variant: "destructive",
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const getDefaultValues = (): EventFormValues => {
    if (event) {
      // Estrai data/ora direttamente dalla stringa ISO senza conversione timezone
      // event.start_time formato: "2025-11-26T15:00:00+00:00" o "2025-11-26 15:00:00+00"
      const startStr = event.start_time.replace(' ', 'T');
      const endStr = event.end_time.replace(' ', 'T');
      
      // Crea Date object e formatta in timezone locale
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      
      // Usa toLocaleString per ottenere l'ora nel timezone locale
      const startTimeLocal = startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const endTimeLocal = endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      const startDateLocal = startDate.toLocaleDateString('en-CA'); // formato yyyy-MM-dd
      const endDateLocal = endDate.toLocaleDateString('en-CA');
      
      return {
        title: event.title,
        description: event.description || "",
        location: event.location || "",
        start_date: startDateLocal,
        start_time: startTimeLocal,
        end_date: endDateLocal,
        end_time: endTimeLocal,
        all_day: event.all_day,
        event_type: event.event_type as EventFormValues["event_type"],
        color_tag: event.color_tag || "#3b82f6",
        has_video_call: !!meeting,
        recording_enabled: meeting?.recording_enabled || false,
        transcription_enabled: meeting?.transcription_enabled || false,
      };
    }

    const date = defaultDate || new Date();
    const startTime = defaultTime || "09:00";
    const [hours, minutes] = startTime.split(":").map(Number);
    const endHours = hours + 1;

    return {
      title: "",
      description: "",
      location: "",
      start_date: format(date, "yyyy-MM-dd"),
      start_time: startTime,
      end_date: format(date, "yyyy-MM-dd"),
      end_time: `${endHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
      all_day: false,
      event_type: "personal",
      color_tag: "#3b82f6",
      has_video_call: false,
      recording_enabled: false,
      transcription_enabled: false,
    };
  };

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues());
    }
  }, [open, event, defaultDate, defaultTime]);

  // Sync form with meeting data when it loads
  useEffect(() => {
    if (meeting && open) {
      form.setValue('has_video_call', true);
      form.setValue('recording_enabled', meeting.recording_enabled || false);
      form.setValue('transcription_enabled', meeting.transcription_enabled || false);
    }
  }, [meeting, open, form]);

  const allDay = form.watch("all_day");
  const hasVideoCall = form.watch("has_video_call");
  const eventType = form.watch("event_type");

  const onSubmit = async (values: EventFormValues) => {
    setIsLoading(true);
    
    // Set a timeout to prevent infinite loading states (30 seconds)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      console.warn("Operation timed out after 30 seconds");
      setIsLoading(false);
      toast({
        title: t('common.error'),
        description: "Operation timed out. Please try again.",
        variant: "destructive",
      });
    }, 30000);

    try {
      console.log("Starting event save...", { isEditing, hasVideoCall: values.has_video_call });
      
      const startLocal = new Date(`${values.start_date}T${values.start_time}:00`);
      const endLocal = new Date(`${values.end_date}T${values.end_time}:00`);

      const startDateTime = values.all_day
        ? `${values.start_date}T00:00:00Z`
        : startLocal.toISOString();

      const endDateTime = values.all_day
        ? `${values.end_date}T23:59:59Z`
        : endLocal.toISOString();

      const eventData: CalendarEventInsert = {
        user_id: userId,
        title: values.title,
        description: values.description || null,
        location: values.location || null,
        start_time: startDateTime,
        end_time: endDateTime,
        all_day: values.all_day,
        event_type: values.event_type as EventType,
        color_tag: values.color_tag || null,
        source: "manual",
      };

      if (isEditing && event) {
        console.log("Updating existing event...", event.id);
        const { error } = await supabase
          .from("calendar_events")
          .update({
            ...eventData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", event.id);

        if (error) {
          console.error("Supabase update error:", error);
          throw error;
        }
        console.log("Event updated successfully");

        // Handle video call changes in editing mode
        const hadVideoCall = !!meeting;
        const wantsVideoCall = values.has_video_call;
        console.log("Video call state:", { hadVideoCall, wantsVideoCall });

        if (wantsVideoCall && !hadVideoCall) {
          console.log("Creating new meeting for existing event...");
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              throw new Error("Not authenticated");
            }

            const response = await fetch("/api/meetings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                event_id: event.id,
                title: values.title,
                description: values.description,
                scheduled_start: startDateTime,
                scheduled_end: endDateTime,
                recording_enabled: values.recording_enabled,
                transcription_enabled: values.transcription_enabled,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error("Meeting API error:", response.status, errorData);
              throw new Error(errorData.error || `Failed to create meeting: ${response.status}`);
            }

            const meetingResponse = await response.json();
            if (meetingResponse.success && meetingResponse.meeting) {
              setMeeting(meetingResponse.meeting);
              console.log("Meeting created successfully");
              toast({
                title: t('event.videoCallAdded'),
                description: t('event.meetingRoomReady'),
              });
            }
          } catch (meetingError: any) {
            const errorMessage = meetingError?.message || String(meetingError) || "Unknown error";
            console.error("Error creating video call:", errorMessage, meetingError);
            toast({
              title: t('event.eventUpdated'),
              description: t('event.videoCallFailed'),
              variant: "destructive",
            });
          }
        } else if (!wantsVideoCall && hadVideoCall && meeting) {
          console.log("Deleting meeting...");
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await fetch(`/api/meetings/${meeting.daily_room_name}`, {
                method: "DELETE",
                headers: {
                  "Authorization": `Bearer ${session.access_token}`,
                },
              });
              setMeeting(null);
              console.log("Meeting deleted successfully");
            }
          } catch (deleteError: any) {
            const errorMessage = deleteError?.message || String(deleteError) || "Unknown error";
            console.error("Error deleting meeting:", errorMessage, deleteError);
          }
          toast({
            title: t('event.eventUpdated'),
            description: t('event.videoCallRemoved'),
          });
        } else {
          console.log("No video call changes, showing update toast");
          toast({
            title: t('event.eventUpdated'),
            description: t('event.eventUpdatedDescription'),
          });
        }

        console.log("Calling onEventSaved for update");
        onEventSaved();
        if (!(wantsVideoCall && !hadVideoCall)) {
          console.log("Closing dialog");
          onOpenChange(false);
        }
      } else {
        console.log("Creating new event...");
        const { data: newEvent, error } = await supabase
          .from("calendar_events")
          .insert(eventData)
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
          throw error;
        }
        console.log("Event created successfully:", newEvent?.id);

        if (values.has_video_call && newEvent) {
          console.log("Creating video call for event...");
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              throw new Error("Not authenticated");
            }

            const response = await fetch("/api/meetings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                event_id: newEvent.id,
                title: values.title,
                description: values.description,
                scheduled_start: startDateTime,
                scheduled_end: endDateTime,
                recording_enabled: values.recording_enabled,
                transcription_enabled: values.transcription_enabled,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error("Meeting API error:", response.status, errorData);
              throw new Error(errorData.error || `Failed to create meeting: ${response.status}`);
            }

            const meetingResponse = await response.json();
            console.log("Video call created successfully");

            if (meetingResponse.success && meetingResponse.meeting) {
              toast({
                title: t('event.eventCreated'),
                description: t('event.meetingRoomReady'),
              });
            }
          } catch (meetingError: any) {
            const errorMessage = meetingError?.message || String(meetingError) || "Unknown error";
            console.error("Error creating video call:", errorMessage, meetingError);
            toast({
              title: t('event.eventCreated'),
              description: t('event.videoCallFailed'),
              variant: "destructive",
            });
          }
        } else {
          console.log("No video call, showing success toast");
          toast({
            title: t('event.eventCreated'),
            description: t('event.eventCreatedDescription'),
          });
        }

        console.log("Calling onEventSaved and closing dialog");
        onEventSaved();
        onOpenChange(false);
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || "Unknown error";
      console.error("Error saving event:", errorMessage, error);
      toast({
        title: t('common.error'),
        description: errorMessage || t('event.failedToSaveEvent'),
        variant: "destructive",
      });
    } finally {
      console.log("Setting isLoading to false");
      // Clear the timeout since operation completed
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .update({ is_deleted: true })
        .eq("id", event.id);

      if (error) throw error;

      toast({
        title: t('event.eventDeleted'),
        description: t('event.eventDeletedDescription'),
      });

      onEventSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('event.failedToDeleteEvent'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {isEditing ? t('event.editEvent') : t('event.newEvent')}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? t('event.editDescription')
                : t('event.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('event.title')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('event.titlePlaceholder')}
                        {...field}
                        data-testid="input-event-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('event.description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('event.descriptionPlaceholder')}
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-event-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="event_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('event.type')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue placeholder={t('event.type')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="personal">{t('event.personal')}</SelectItem>
                          <SelectItem value="meeting">{t('event.meeting')}</SelectItem>
                          <SelectItem value="task">{t('event.task')}</SelectItem>
                          <SelectItem value="reminder">{t('event.reminder')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color_tag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('event.color')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-color">
                            <SelectValue placeholder={t('event.color')}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: field.value }}
                                />
                                <span>
                                  {colorOptions.find((c) => c.value === field.value)?.label || t('event.color')}
                                </span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colorOptions.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: color.value }}
                                />
                                <span>{color.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="all_day"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t('event.allDay')}
                      </FormLabel>
                      <FormDescription>
                        {t('event.allDayDescription')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-all-day"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('event.startDate')}</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-start-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!allDay && (
                  <FormField
                    control={form.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('event.startTime')}</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            data-testid="input-start-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('event.endDate')}</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-end-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!allDay && (
                  <FormField
                    control={form.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('event.endTime')}</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            data-testid="input-end-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {t('event.location')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('event.locationPlaceholder')}
                        {...field}
                        data-testid="input-event-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {eventType !== "reminder" && (
                <>
                  <FormField
                    control={form.control}
                    name="has_video_call"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center gap-2">
                            <Video className="h-4 w-4" />
                            {t('event.videoCall')}
                          </FormLabel>
                          <FormDescription>
                            {t('event.videoCallDescription')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-video-call"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {hasVideoCall && (
                    <>
                      <FormField
                        control={form.control}
                        name="recording_enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3 ml-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                {t('event.recordMeeting')}
                              </FormLabel>
                              <FormDescription>
                                {t('event.recordDescription')}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-recording"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="transcription_enabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3 ml-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base flex items-center gap-2">
                                <Mic className="h-4 w-4" />
                                {t('event.transcribe')}
                              </FormLabel>
                              <FormDescription>
                                {t('event.transcribeDescription')}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-transcription"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {isEditing && meeting && (
                        <div className="rounded-lg border p-3 ml-4 bg-muted/50">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <Video className="h-4 w-4" />
                              {t('event.meetingLink')}
                            </Label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-background p-2 rounded border truncate" data-testid="text-meeting-url">
                                {meeting.daily_room_url}
                              </code>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={copyMeetingLink}
                                data-testid="button-copy-meeting-link"
                              >
                                {copied ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                asChild
                              >
                                <a
                                  href={meeting.host_meeting_token 
                                    ? `${meeting.daily_room_url}?t=${meeting.host_meeting_token}` 
                                    : meeting.daily_room_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  data-testid="link-join-meeting"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t('event.shareLinkDescription')}
                            </p>
                          </div>
                        </div>
                      )}

                      {isEditing && meeting && meeting.transcription_enabled && (
                        <div className="space-y-3 ml-4">
                          <Separator />
                          
                          <input
                            ref={audioInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioFileChange}
                            className="hidden"
                          />
                          
                          <div className="rounded-lg border p-3 bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                {t('ai.transcription.title')}
                              </Label>
                              {transcription ? (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {t('ai.transcription.transcribed')}
                                </Badge>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleUploadAudio}
                                  disabled={transcriptionLoading}
                                  data-testid="button-upload-audio"
                                >
                                  {transcriptionLoading ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      {t('ai.transcription.transcribing')}
                                    </>
                                  ) : (
                                    <>
                                      <Mic className="h-3 w-3 mr-1" />
                                      {t('ai.transcription.uploadAudio')}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            
                            {transcription && (
                              <Collapsible open={transcriptionOpen} onOpenChange={setTranscriptionOpen}>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-between"
                                    data-testid="button-toggle-transcription"
                                  >
                                    {t('ai.transcription.viewTranscription')}
                                    {transcriptionOpen ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2">
                                  <div className="bg-background rounded border p-3 max-h-48 overflow-y-auto">
                                    <p className="text-sm whitespace-pre-wrap" data-testid="text-transcription">
                                      {transcription.transcription_text}
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>

                          <div className="rounded-lg border p-3 bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                {t('ai.summary.title')}
                              </Label>
                              {summary ? (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {t('ai.summary.viewSummary')}
                                </Badge>
                              ) : transcription ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleGenerateSummary}
                                  disabled={summaryLoading}
                                  data-testid="button-summarize"
                                >
                                  {summaryLoading ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      {t('ai.summary.generating')}
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      {t('ai.summary.generate')}
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t('ai.summary.noTranscription')}
                                </span>
                              )}
                            </div>
                            
                            {summary && (
                              <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-between"
                                    data-testid="button-toggle-summary"
                                  >
                                    {t('ai.summary.viewSummary')}
                                    {summaryOpen ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2">
                                  <div className="bg-background rounded border p-3 space-y-3 max-h-64 overflow-y-auto">
                                    {summary.summary?.keyPoints?.length > 0 && (
                                      <div>
                                        <Label className="text-xs font-medium flex items-center gap-1 mb-1">
                                          <ListChecks className="h-3 w-3" />
                                          {t('ai.summary.keyPoints')}
                                        </Label>
                                        <ul className="text-sm list-disc list-inside space-y-1">
                                          {summary.summary.keyPoints.map((point: string, idx: number) => (
                                            <li key={idx}>{point}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {summary.summary?.actionItems?.length > 0 && (
                                      <div>
                                        <Label className="text-xs font-medium flex items-center gap-1 mb-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          {t('ai.summary.actionItems')}
                                        </Label>
                                        <ul className="text-sm list-disc list-inside space-y-1">
                                          {summary.summary.actionItems.map((item: string, idx: number) => (
                                            <li key={idx}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {summary.summary?.decisions?.length > 0 && (
                                      <div>
                                        <Label className="text-xs font-medium flex items-center gap-1 mb-1">
                                          <MessageSquare className="h-3 w-3" />
                                          {t('ai.summary.decisions')}
                                        </Label>
                                        <ul className="text-sm list-disc list-inside space-y-1">
                                          {summary.summary.decisions.map((decision: string, idx: number) => (
                                            <li key={idx}>{decision}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {isEditing && event && (
                <>
                  <Separator className="my-4" />
                  <AttachmentUpload
                    eventId={event.id}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    disabled={isLoading}
                  />
                </>
              )}

              <div className="flex justify-between pt-4">
                {isEditing && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isLoading}
                      data-testid="button-delete-event"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete')}
                    </Button>
                    {event?.share_token ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={copyExistingShareLink}
                        disabled={shareLoading}
                        data-testid="button-copy-share-link"
                      >
                        {shareLinkCopied ? (
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-2" />
                        )}
                        {shareLinkCopied ? t('event.linkCopied') : t('common.copy')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateShareLink}
                        disabled={shareLoading}
                        data-testid="button-share-event"
                      >
                        {shareLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Share2 className="h-4 w-4 mr-2" />
                        )}
                        {t('common.share')}
                      </Button>
                    )}
                  </div>
                )}
                <div className={`flex gap-2 ${!isEditing ? "ml-auto" : ""}`}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isLoading}
                    data-testid="button-cancel"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={isLoading} data-testid="button-save-event">
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isEditing ? t('common.update') : t('common.create')}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('event.deleteEvent')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('event.deleteConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
