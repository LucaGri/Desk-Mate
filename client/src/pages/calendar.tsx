import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { CalendarEvent } from "@/lib/supabase-types";
import { EventDialog } from "@/components/event-dialog";
import { AISidebar, AITriggerButton } from "@/components/ai-sidebar";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  LogOut,
  Home,
  Plus
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

type CalendarView = "month" | "week" | "day";

interface TimeSlot {
  hour: number;
  label: string;
}

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const { user, profile, settings, loading, profileError, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const hasUserChangedView = useRef(false);
  
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultEventDate, setDefaultEventDate] = useState<Date | undefined>();
  const [defaultEventTime, setDefaultEventTime] = useState<string | undefined>();

  // Apply default calendar view from profile, but only if user hasn't manually changed it
  useEffect(() => {
    if (profile?.default_calendar_view && !hasUserChangedView.current) {
      const defaultView = profile.default_calendar_view.toLowerCase() as CalendarView;
      if (["month", "week", "day"].includes(defaultView)) {
        setView(defaultView);
      }
    }
  }, [profile?.default_calendar_view]);

  useEffect(() => {
    if (!loading && !profileError) {
      if (!user) {
        setLocation("/auth");
      } else if (!profile?.onboarding_completed) {
        setLocation("/onboarding");
      }
    }
  }, [user, profile, loading, profileError, setLocation]);

  const workHoursStart = useMemo(() => {
    if (profile?.work_hours_start) {
      const [hours] = profile.work_hours_start.split(':').map(Number);
      return hours;
    }
    return 9;
  }, [profile]);

  const workHoursEnd = useMemo(() => {
    if (profile?.work_hours_end) {
      const [hours] = profile.work_hours_end.split(':').map(Number);
      return hours;
    }
    return 18;
  }, [profile]);

  const timeSlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = workHoursStart; hour <= workHoursEnd; hour++) {
      slots.push({
        hour,
        label: format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm'),
      });
    }
    return slots;
  }, [workHoursStart, workHoursEnd]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    
    setEventsLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (view === "month") {
        startDate = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
        endDate = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
      } else if (view === "week") {
        startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
      } else {
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
      }

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .or(`and(start_time.gte.${startDate.toISOString()},start_time.lte.${endDate.toISOString()}),and(end_time.gte.${startDate.toISOString()},end_time.lte.${endDate.toISOString()}),and(start_time.lte.${startDate.toISOString()},end_time.gte.${endDate.toISOString()})`)
        .order("start_time", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error("Error fetching events:", error);
      toast({
        title: t('calendar.errorLoadingEvents'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEventsLoading(false);
    }
  }, [user, currentDate, view, toast]);

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user, fetchEvents]);

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start_time);
      return isSameDay(eventStart, day);
    });
  };

  const getEventsForHour = (day: Date, hour: number): CalendarEvent[] => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start_time);
      const eventHour = eventStart.getHours();
      return isSameDay(eventStart, day) && eventHour === hour;
    });
  };

  const navigatePrevious = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (view === "month") {
      setCurrentDate(day);
      hasUserChangedView.current = true;
      setView("day");
    }
  };

  const handleSlotClick = (day: Date, hour?: number) => {
    setDefaultEventDate(day);
    setDefaultEventTime(hour !== undefined ? `${hour.toString().padStart(2, "0")}:00` : undefined);
    setSelectedEvent(null);
    setEventDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setDefaultEventDate(undefined);
    setDefaultEventTime(undefined);
    setEventDialogOpen(true);
  };

  const handleAddEvent = () => {
    setDefaultEventDate(selectedDate);
    setDefaultEventTime(`${workHoursStart.toString().padStart(2, "0")}:00`);
    setSelectedEvent(null);
    setEventDialogOpen(true);
  };

  const handleEventSaved = () => {
    fetchEvents();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: t('auth.signedOut'),
        description: t('auth.signedOutDescription'),
      });
      setLocation("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: t('common.error'),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const getHeaderTitle = () => {
    if (view === "month") {
      return format(currentDate, "MMMM yyyy");
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, "d")} - ${format(end, "d MMMM yyyy")}`;
      }
      return `${format(start, "d MMM")} - ${format(end, "d MMM yyyy")}`;
    } else {
      return format(currentDate, "EEEE, d MMMM yyyy");
    }
  };

  const getEventTypeColor = (event: CalendarEvent): string => {
    if (event.color_tag) return event.color_tag;
    switch (event.event_type) {
      case "meeting": return "#3b82f6";
      case "task": return "#22c55e";
      case "reminder": return "#f97316";
      default: return "#8b5cf6";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground" data-testid="text-loading">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md p-6">
          <h2 className="text-lg font-semibold mb-2" data-testid="text-error-title">{t('onboarding.errorLoadingProfile')}</h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-error-message">
            {profileError.message}
          </p>
          <Button onClick={() => window.location.reload()} className="w-full" data-testid="button-retry">
            {t('common.retry')}
          </Button>
        </Card>
      </div>
    );
  }

  if (!user || !profile?.onboarding_completed) {
    return null;
  }

  const weekDayNames = [
    t('calendar.days.mon'),
    t('calendar.days.tue'),
    t('calendar.days.wed'),
    t('calendar.days.thu'),
    t('calendar.days.fri'),
    t('calendar.days.sat'),
    t('calendar.days.sun')
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <img 
            src="/logo.png" 
            alt="Desk Mate" 
            className="h-12 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setLocation("/dashboard")}
            data-testid="logo-home"
          />
          <div className="flex items-center gap-2">
            <AITriggerButton onClick={() => setAiSidebarOpen(true)} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-dashboard"
            >
              <Home className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('auth.signOut')}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-4 flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              onClick={navigatePrevious}
              data-testid="button-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={navigateNext}
              data-testid="button-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-today"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              {t('calendar.today')}
            </Button>
            <h2 className="text-lg sm:text-xl font-semibold ml-2" data-testid="text-calendar-title">
              {getHeaderTitle()}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => { hasUserChangedView.current = true; setView(v as CalendarView); }}>
              <TabsList>
                <TabsTrigger value="month" data-testid="tab-month">{t('calendar.views.month')}</TabsTrigger>
                <TabsTrigger value="week" data-testid="tab-week">{t('calendar.views.week')}</TabsTrigger>
                <TabsTrigger value="day" data-testid="tab-day">{t('calendar.views.day')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={handleAddEvent} data-testid="button-add-event">
              <Plus className="h-4 w-4 mr-1" />
              {t('calendar.event')}
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden">
          {view === "month" && (
            <div className="h-full flex flex-col" data-testid="view-month">
              <div className="grid grid-cols-7 border-b bg-muted/50">
                {weekDayNames.map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                {monthDays.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = isSameDay(day, selectedDate);
                  const isDayToday = isToday(day);
                  const dayEvents = getEventsForDay(day);

                  return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(day)}
                      className={`
                        min-h-[80px] p-1 border-b border-r cursor-pointer
                        hover-elevate transition-colors
                        ${!isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""}
                        ${isSelected ? "bg-primary/10" : ""}
                      `}
                      data-testid={`day-cell-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div className="flex justify-end">
                        <span
                          className={`
                            w-7 h-7 flex items-center justify-center text-sm rounded-full
                            ${isDayToday ? "bg-primary text-primary-foreground font-semibold" : ""}
                            ${isSelected && !isDayToday ? "bg-accent" : ""}
                          `}
                        >
                          {format(day, "d")}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => handleEventClick(event, e)}
                            className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                            style={{
                              backgroundColor: `${getEventTypeColor(event)}20`,
                              color: getEventTypeColor(event),
                              borderLeft: `2px solid ${getEventTypeColor(event)}`,
                            }}
                            data-testid={`event-${event.id}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">
                            {t('calendar.moreEvents', { count: dayEvents.length - 3 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="h-full flex flex-col" data-testid="view-week">
              <div className="grid grid-cols-8 border-b bg-muted/50 sticky top-0 z-10">
                <div className="py-2 px-2 text-center text-xs font-medium text-muted-foreground border-r">
                  {t('calendar.time')}
                </div>
                {weekDays.map((day) => {
                  const isDayToday = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`py-2 text-center border-r ${isDayToday ? "bg-primary/10" : ""}`}
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {format(day, "EEE")}
                      </div>
                      <div
                        className={`
                          text-lg font-semibold inline-flex items-center justify-center
                          ${isDayToday ? "w-8 h-8 rounded-full bg-primary text-primary-foreground" : ""}
                        `}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-8">
                  {timeSlots.map((slot) => (
                    <div key={slot.hour} className="contents">
                      <div className="py-3 px-2 text-xs text-muted-foreground text-right border-r border-b">
                        {slot.label}
                      </div>
                      {weekDays.map((day) => {
                        const isDayToday = isToday(day);
                        const hourEvents = getEventsForHour(day, slot.hour);
                        return (
                          <div
                            key={`${day.toISOString()}-${slot.hour}`}
                            onClick={() => handleSlotClick(day, slot.hour)}
                            className={`
                              min-h-[48px] border-r border-b cursor-pointer relative
                              hover:bg-accent/50 transition-colors
                              ${isDayToday ? "bg-primary/5" : ""}
                            `}
                            data-testid={`week-slot-${format(day, "yyyy-MM-dd")}-${slot.hour}`}
                          >
                            {hourEvents.map((event) => (
                              <div
                                key={event.id}
                                onClick={(e) => handleEventClick(event, e)}
                                className="absolute inset-x-0.5 top-0.5 p-1 text-xs rounded truncate cursor-pointer hover:opacity-80"
                                style={{
                                  backgroundColor: `${getEventTypeColor(event)}20`,
                                  color: getEventTypeColor(event),
                                  borderLeft: `2px solid ${getEventTypeColor(event)}`,
                                }}
                                data-testid={`event-${event.id}`}
                              >
                                {event.title}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {view === "day" && (
            <div className="h-full flex flex-col" data-testid="view-day">
              <div className="py-3 px-4 border-b bg-muted/50 sticky top-0 z-10">
                <div className="text-center">
                  <div className="text-sm font-medium text-muted-foreground">
                    {format(currentDate, "EEEE")}
                  </div>
                  <div
                    className={`
                      text-2xl font-bold inline-flex items-center justify-center
                      ${isToday(currentDate) ? "w-10 h-10 rounded-full bg-primary text-primary-foreground" : ""}
                    `}
                  >
                    {format(currentDate, "d")}
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {timeSlots.map((slot) => {
                    const hourEvents = getEventsForHour(currentDate, slot.hour);
                    return (
                      <div
                        key={slot.hour}
                        onClick={() => handleSlotClick(currentDate, slot.hour)}
                        className="flex hover:bg-accent/30 transition-colors cursor-pointer"
                        data-testid={`day-slot-${slot.hour}`}
                      >
                        <div className="w-20 flex-shrink-0 py-4 px-3 text-sm text-muted-foreground text-right border-r">
                          {slot.label}
                        </div>
                        <div className="flex-1 min-h-[60px] p-2 relative">
                          {hourEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={(e) => handleEventClick(event, e)}
                              className="p-2 mb-1 text-sm rounded cursor-pointer hover:opacity-80"
                              style={{
                                backgroundColor: `${getEventTypeColor(event)}20`,
                                color: getEventTypeColor(event),
                                borderLeft: `3px solid ${getEventTypeColor(event)}`,
                              }}
                              data-testid={`event-${event.id}`}
                            >
                              <div className="font-medium">{event.title}</div>
                              {event.location && (
                                <div className="text-xs opacity-75">{event.location}</div>
                              )}
                              <div className="text-xs opacity-75">
                                {format(parseISO(event.start_time), "HH:mm")} - {format(parseISO(event.end_time), "HH:mm")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </Card>
      </main>

      {user && (
        <EventDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          event={selectedEvent}
          defaultDate={defaultEventDate}
          defaultTime={defaultEventTime}
          userId={user.id}
          onEventSaved={handleEventSaved}
        />
      )}

      <AISidebar open={aiSidebarOpen} onOpenChange={setAiSidebarOpen} />
    </div>
  );
}
