import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getInitials, getDisplayName } from "@/lib/timezones";
import { AISidebar, AITriggerButton } from "@/components/ai-sidebar";
import { 
  ArrowLeft, 
  LogOut, 
  Calendar, 
  BookOpen,
  TrendingUp,
  Frown,
  Meh,
  Smile,
  SmilePlus,
  Laugh,
  Clock,
  Video,
  CheckSquare,
  Target,
  Activity,
  BarChart3,
  PieChart as PieChartIcon
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, differenceInMinutes, isWithinInterval, eachDayOfInterval } from "date-fns";
import type { JournalEntry, CalendarEvent, Meeting, MoodLevel } from "@/lib/supabase-types";

type DateRange = "7days" | "30days" | "thisMonth" | "custom";

const MOOD_ICONS: Record<MoodLevel, typeof Frown> = {
  terrible: Frown,
  bad: Meh,
  neutral: Smile,
  good: SmilePlus,
  great: Laugh
};

const MOOD_COLORS: Record<MoodLevel, string> = {
  terrible: "#ef4444",
  bad: "#f97316",
  neutral: "#eab308",
  good: "#84cc16",
  great: "#22c55e"
};

const MOOD_SCORES: Record<MoodLevel, number> = {
  terrible: 1,
  bad: 2,
  neutral: 3,
  good: 4,
  great: 5
};

const EVENT_TYPE_COLORS = {
  meeting: "#3b82f6",
  task: "#22c55e",
  personal: "#8b5cf6",
  reminder: "#f59e0b",
  imported: "#6b7280",
  journal: "#ec4899"
};

export default function AnalysisPage() {
  const [, setLocation] = useLocation();
  const { user, profile, loading, profileError, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [dateRange, setDateRange] = useState<DateRange>("30days");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);

  const dateInterval = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "7days":
        return { start: subDays(now, 7), end: now };
      case "30days":
        return { start: subDays(now, 30), end: now };
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: subDays(now, 30), end: now };
    }
  }, [dateRange]);

  useEffect(() => {
    if (!loading && !profileError) {
      if (!user) {
        setLocation("/auth");
      } else if (!profile?.onboarding_completed) {
        setLocation("/onboarding");
      }
    }
  }, [user, profile, loading, profileError, setLocation]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      setDataLoading(true);
      try {
        const startDate = format(dateInterval.start, "yyyy-MM-dd");
        const endDate = format(dateInterval.end, "yyyy-MM-dd");
        
        const [journalRes, eventsRes, meetingsRes] = await Promise.all([
          supabase
            .from("journal_entries")
            .select("*")
            .eq("user_id", user.id)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: true }),
          supabase
            .from("calendar_events")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_deleted", false)
            .gte("start_time", dateInterval.start.toISOString())
            .lte("start_time", dateInterval.end.toISOString())
            .order("start_time", { ascending: true }),
          supabase
            .from("meetings")
            .select("*")
            .eq("host_user_id", user.id)
            .gte("scheduled_start", dateInterval.start.toISOString())
            .lte("scheduled_start", dateInterval.end.toISOString())
        ]);

        if (journalRes.data) setJournalEntries(journalRes.data);
        if (eventsRes.data) setCalendarEvents(eventsRes.data);
        if (meetingsRes.data) setMeetings(meetingsRes.data);
      } catch (error) {
        console.error("Error fetching analysis data:", error);
        toast({
          title: t("common.error"),
          description: t("analysis.failedToLoadData"),
          variant: "destructive"
        });
      } finally {
        setDataLoading(false);
      }
    }
    
    if (user && profile?.onboarding_completed) {
      fetchData();
    }
  }, [user, profile, dateInterval, t, toast]);

  const moodTrendData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateInterval.start, end: dateInterval.end });
    return days.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = journalEntries.filter(e => e.date === dateStr && e.mood);
      const avgScore = dayEntries.length > 0
        ? dayEntries.reduce((sum, e) => sum + (MOOD_SCORES[e.mood!] || 3), 0) / dayEntries.length
        : null;
      return {
        date: format(day, "MMM dd"),
        fullDate: dateStr,
        score: avgScore,
        entries: dayEntries.length
      };
    }).filter(d => d.score !== null);
  }, [journalEntries, dateInterval]);

  const moodDistribution = useMemo(() => {
    const counts: Record<MoodLevel, number> = {
      terrible: 0,
      bad: 0,
      neutral: 0,
      good: 0,
      great: 0
    };
    journalEntries.forEach(entry => {
      if (entry.mood) {
        counts[entry.mood]++;
      }
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([mood, count]) => ({
        name: t(`journal.mood.${mood}`),
        value: count,
        color: MOOD_COLORS[mood as MoodLevel]
      }));
  }, [journalEntries, t]);

  const moodByDayOfWeek = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayData: Record<number, { total: number; count: number }> = {};
    
    journalEntries.forEach(entry => {
      if (entry.mood && entry.date) {
        const dayIndex = parseISO(entry.date).getDay();
        if (!dayData[dayIndex]) {
          dayData[dayIndex] = { total: 0, count: 0 };
        }
        dayData[dayIndex].total += MOOD_SCORES[entry.mood];
        dayData[dayIndex].count++;
      }
    });
    
    return dayNames.map((name, index) => ({
      day: name,
      avgMood: dayData[index] ? dayData[index].total / dayData[index].count : 0
    }));
  }, [journalEntries]);

  const journalStats = useMemo(() => {
    const totalEntries = journalEntries.length;
    const entriesWithMood = journalEntries.filter(e => e.mood).length;
    const avgMoodScore = entriesWithMood > 0
      ? journalEntries.reduce((sum, e) => sum + (e.mood ? MOOD_SCORES[e.mood] : 0), 0) / entriesWithMood
      : 0;
    
    const allTags = journalEntries.flatMap(e => e.tags || []);
    const tagCounts: Record<string, number> = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    return {
      totalEntries,
      entriesWithMood,
      avgMoodScore: avgMoodScore.toFixed(1),
      topTags
    };
  }, [journalEntries]);

  const eventTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    calendarEvents.forEach(event => {
      const type = event.event_type || "personal";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      name: t(`event.${type}`),
      value: count,
      color: EVENT_TYPE_COLORS[type as keyof typeof EVENT_TYPE_COLORS] || "#6b7280"
    }));
  }, [calendarEvents, t]);

  const calendarStats = useMemo(() => {
    const totalEvents = calendarEvents.length;
    const meetingEvents = calendarEvents.filter(e => e.event_type === "meeting");
    const totalMeetingMinutes = meetingEvents.reduce((sum, event) => {
      const start = parseISO(event.start_time);
      const end = parseISO(event.end_time);
      return sum + differenceInMinutes(end, start);
    }, 0);
    const totalMeetingHours = (totalMeetingMinutes / 60).toFixed(1);
    
    const eventsByDay: Record<number, number> = {};
    calendarEvents.forEach(event => {
      const dayIndex = parseISO(event.start_time).getDay();
      eventsByDay[dayIndex] = (eventsByDay[dayIndex] || 0) + 1;
    });
    const busiestDay = Object.entries(eventsByDay)
      .sort((a, b) => b[1] - a[1])[0];
    const dayNames = [
      t("calendar.days.sunday"),
      t("calendar.days.monday"),
      t("calendar.days.tuesday"),
      t("calendar.days.wednesday"),
      t("calendar.days.thursday"),
      t("calendar.days.friday"),
      t("calendar.days.saturday")
    ];
    
    return {
      totalEvents,
      meetingCount: meetingEvents.length,
      totalMeetingHours,
      busiestDay: busiestDay ? dayNames[parseInt(busiestDay[0])] : "-"
    };
  }, [calendarEvents, t]);

  const meetingStats = useMemo(() => {
    const totalMeetings = meetings.length;
    const completedMeetings = meetings.filter(m => m.status === "ended").length;
    const cancelledMeetings = meetings.filter(m => m.status === "cancelled").length;
    
    const actualMeetingMinutes = meetings
      .filter(m => m.actual_start_time && m.actual_end_time)
      .reduce((sum, m) => {
        const start = parseISO(m.actual_start_time!);
        const end = parseISO(m.actual_end_time!);
        return sum + differenceInMinutes(end, start);
      }, 0);
    
    return {
      totalMeetings,
      completedMeetings,
      cancelledMeetings,
      actualHours: (actualMeetingMinutes / 60).toFixed(1)
    };
  }, [meetings]);

  const eventsByDayChart = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayData: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    calendarEvents.forEach(event => {
      const dayIndex = parseISO(event.start_time).getDay();
      dayData[dayIndex]++;
    });
    
    return dayNames.map((name, index) => ({
      day: name,
      events: dayData[index]
    }));
  }, [calendarEvents]);

  const combinedInsights = useMemo(() => {
    const days = eachDayOfInterval({ start: dateInterval.start, end: dateInterval.end });
    const insights = days.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayEntries = journalEntries.filter(e => e.date === dateStr && e.mood);
      const avgMood = dayEntries.length > 0
        ? dayEntries.reduce((sum, e) => sum + (MOOD_SCORES[e.mood!] || 3), 0) / dayEntries.length
        : null;
      
      const dayEvents = calendarEvents.filter(event => {
        const eventStart = parseISO(event.start_time);
        return isWithinInterval(eventStart, { start: dayStart, end: dayEnd });
      });
      
      const dayMeetings = dayEvents.filter(e => e.event_type === "meeting");
      const meetingMinutes = dayMeetings.reduce((sum, event) => {
        const start = parseISO(event.start_time);
        const end = parseISO(event.end_time);
        return sum + differenceInMinutes(end, start);
      }, 0);
      
      return {
        date: format(day, "MMM dd"),
        mood: avgMood,
        events: dayEvents.length,
        meetingHours: meetingMinutes / 60
      };
    });
    
    return insights;
  }, [journalEntries, calendarEvents, dateInterval]);

  const productivityScore = useMemo(() => {
    let score = 50;
    
    if (journalStats.totalEntries > 0) {
      const journalFrequency = journalStats.totalEntries / 30;
      score += Math.min(journalFrequency * 10, 15);
    }
    
    if (parseFloat(journalStats.avgMoodScore) >= 3.5) {
      score += 10;
    } else if (parseFloat(journalStats.avgMoodScore) >= 3) {
      score += 5;
    }
    
    if (calendarStats.totalEvents > 0) {
      score += 10;
    }
    
    if (meetingStats.completedMeetings > meetingStats.cancelledMeetings) {
      score += 10;
    }
    
    return Math.min(Math.round(score), 100);
  }, [journalStats, calendarStats, meetingStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground" data-testid="text-loading">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle data-testid="text-error-title">{t("errors.loadingProfile")}</CardTitle>
            <CardDescription>{t("errors.couldNotLoadProfile")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="text-error-message">
              {profileError.message}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full" data-testid="button-retry">
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || !profile?.onboarding_completed) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: t("dashboard.signedOut"),
        description: t("dashboard.signedOutDescription"),
      });
      setLocation("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: t("common.error"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const displayName = getDisplayName(profile.first_name, profile.last_name, profile.email);
  const initials = getInitials(profile.first_name, profile.last_name, profile.email);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img 
              src="/logo.png" 
              alt="Desk Mate" 
              className="h-10 cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={() => setLocation("/dashboard")}
              data-testid="logo-home"
            />
          </div>
          <div className="flex items-center gap-4">
            <AITriggerButton onClick={() => setAiSidebarOpen(true)} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/profile")}
              className="flex items-center gap-2"
              data-testid="button-profile"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm" data-testid="text-user-name">
                {displayName}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("common.signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                {t("analysis.title")}
              </h1>
              <p className="text-muted-foreground" data-testid="text-page-subtitle">
                {t("analysis.subtitle")}
              </p>
            </div>
            <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days" data-testid="option-7days">{t("analysis.last7Days")}</SelectItem>
                <SelectItem value="30days" data-testid="option-30days">{t("analysis.last30Days")}</SelectItem>
                <SelectItem value="thisMonth" data-testid="option-this-month">{t("analysis.thisMonth")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">{t("analysis.loadingData")}</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 max-w-md">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  <Activity className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t("analysis.overview")}</span>
                </TabsTrigger>
                <TabsTrigger value="mood" data-testid="tab-mood">
                  <BookOpen className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t("analysis.mood")}</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" data-testid="tab-calendar">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t("analysis.calendarTab")}</span>
                </TabsTrigger>
                <TabsTrigger value="insights" data-testid="tab-insights">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t("analysis.insights")}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card data-testid="card-productivity-score">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.productivityScore")}</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{productivityScore}%</div>
                      <p className="text-xs text-muted-foreground">{t("analysis.basedOnActivity")}</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-journal-entries">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.journalEntries")}</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{journalStats.totalEntries}</div>
                      <p className="text-xs text-muted-foreground">
                        {t("analysis.avgMood")}: {journalStats.avgMoodScore}/5
                      </p>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-total-events">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.totalEvents")}</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calendarStats.totalEvents}</div>
                      <p className="text-xs text-muted-foreground">
                        {t("analysis.meetingHours", { hours: calendarStats.totalMeetingHours })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-video-meetings">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.videoMeetings")}</CardTitle>
                      <Video className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{meetingStats.totalMeetings}</div>
                      <p className="text-xs text-muted-foreground">
                        {t("analysis.completed")}: {meetingStats.completedMeetings}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card data-testid="card-mood-trend">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {t("analysis.moodTrend")}
                      </CardTitle>
                      <CardDescription>{t("analysis.moodTrendDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {moodTrendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={moodTrendData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--background))", 
                                border: "1px solid hsl(var(--border))" 
                              }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="score" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--primary))" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                          {t("analysis.noMoodData")}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-events-by-day">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        {t("analysis.eventsByDay")}
                      </CardTitle>
                      <CardDescription>{t("analysis.eventsByDayDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {calendarEvents.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={eventsByDayChart}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="day" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--background))", 
                                border: "1px solid hsl(var(--border))" 
                              }} 
                            />
                            <Bar dataKey="events" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                          {t("analysis.noEventData")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="mood" className="space-y-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.totalEntries")}</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{journalStats.totalEntries}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.entriesWithMood")}</CardTitle>
                      <Smile className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{journalStats.entriesWithMood}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.averageMood")}</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{journalStats.avgMoodScore}/5</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.topTags")}</CardTitle>
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {journalStats.topTags.length > 0 ? (
                          journalStats.topTags.slice(0, 3).map(([tag]) => (
                            <span key={tag} className="text-xs bg-muted px-2 py-1 rounded">{tag}</span>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {t("analysis.moodOverTime")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {moodTrendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={moodTrendData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--background))", 
                                border: "1px solid hsl(var(--border))" 
                              }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="score" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--primary))" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                          {t("analysis.noMoodData")}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5" />
                        {t("analysis.moodDistribution")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {moodDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={moodDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {moodDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--background))", 
                                border: "1px solid hsl(var(--border))" 
                              }} 
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                          {t("analysis.noMoodData")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      {t("analysis.moodByDayOfWeek")}
                    </CardTitle>
                    <CardDescription>{t("analysis.moodByDayDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {journalEntries.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={moodByDayOfWeek}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="day" className="text-xs" />
                          <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--background))", 
                              border: "1px solid hsl(var(--border))" 
                            }}
                            formatter={(value: number) => [value.toFixed(1), "Avg Mood"]}
                          />
                          <Bar dataKey="avgMood" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                        {t("analysis.noMoodData")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="calendar" className="space-y-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.totalEvents")}</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calendarStats.totalEvents}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.meetingEvents")}</CardTitle>
                      <Video className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calendarStats.meetingCount}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.meetingHoursLabel")}</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calendarStats.totalMeetingHours}h</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t("analysis.busiestDay")}</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{calendarStats.busiestDay}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5" />
                        {t("analysis.eventTypeBreakdown")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {eventTypeDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={eventTypeDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {eventTypeDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--background))", 
                                border: "1px solid hsl(var(--border))" 
                              }} 
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                          {t("analysis.noEventData")}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        {t("analysis.eventsByDay")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {calendarEvents.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={eventsByDayChart}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="day" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--background))", 
                                border: "1px solid hsl(var(--border))" 
                              }} 
                            />
                            <Bar dataKey="events" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                          {t("analysis.noEventData")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      {t("analysis.videoMeetingStats")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-primary">{meetingStats.totalMeetings}</div>
                        <p className="text-sm text-muted-foreground">{t("analysis.totalVideoMeetings")}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-green-600">{meetingStats.completedMeetings}</div>
                        <p className="text-sm text-muted-foreground">{t("analysis.completed")}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-red-600">{meetingStats.cancelledMeetings}</div>
                        <p className="text-sm text-muted-foreground">{t("analysis.cancelled")}</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-blue-600">{meetingStats.actualHours}h</div>
                        <p className="text-sm text-muted-foreground">{t("analysis.actualTime")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      {t("analysis.moodVsMeetings")}
                    </CardTitle>
                    <CardDescription>{t("analysis.moodVsMeetingsDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {combinedInsights.filter(d => d.mood !== null).length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={combinedInsights.filter(d => d.mood !== null)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis yAxisId="left" domain={[0, 5]} className="text-xs" />
                          <YAxis yAxisId="right" orientation="right" className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--background))", 
                              border: "1px solid hsl(var(--border))" 
                            }} 
                          />
                          <Legend />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="mood" 
                            stroke="#22c55e" 
                            strokeWidth={2}
                            name={t("analysis.moodScore")}
                            dot={{ fill: "#22c55e" }}
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="meetingHours" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            name={t("analysis.meetingHoursLabel")}
                            dot={{ fill: "#3b82f6" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        {t("analysis.notEnoughData")}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t("analysis.journalingSummary")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t("analysis.entriesThisPeriod")}</span>
                        <span className="font-medium">{journalStats.totalEntries}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t("analysis.avgMoodScore")}</span>
                        <span className="font-medium">{journalStats.avgMoodScore}/5</span>
                      </div>
                      {journalStats.topTags.length > 0 && (
                        <div>
                          <span className="text-muted-foreground block mb-2">{t("analysis.topTags")}</span>
                          <div className="flex flex-wrap gap-1">
                            {journalStats.topTags.map(([tag, count]) => (
                              <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                {tag} ({count})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t("analysis.calendarSummary")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t("analysis.totalEvents")}</span>
                        <span className="font-medium">{calendarStats.totalEvents}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t("analysis.meetings")}</span>
                        <span className="font-medium">{calendarStats.meetingCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t("analysis.timeInMeetings")}</span>
                        <span className="font-medium">{calendarStats.totalMeetingHours}h</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t("analysis.busiestDay")}</span>
                        <span className="font-medium">{calendarStats.busiestDay}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t("analysis.productivityInsight")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-4">
                        <div className="text-4xl font-bold text-primary">{productivityScore}%</div>
                        <p className="text-sm text-muted-foreground mt-2">{t("analysis.productivityScoreLabel")}</p>
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        {productivityScore >= 70 
                          ? t("analysis.productivityHigh")
                          : productivityScore >= 50
                          ? t("analysis.productivityMedium")
                          : t("analysis.productivityLow")
                        }
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      <AISidebar open={aiSidebarOpen} onOpenChange={setAiSidebarOpen} />
    </div>
  );
}
