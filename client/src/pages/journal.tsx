import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AISidebar, AITriggerButton } from "@/components/ai-sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { getInitials, getDisplayName } from "@/lib/timezones";
import { supabase } from "@/lib/supabase";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import type { JournalEntry, MoodLevel } from "@/lib/supabase-types";
import { JournalEntryDialog } from "@/components/journal-entry-dialog";
import {
  Frown,
  Meh,
  Smile,
  SmilePlus,
  Laugh,
  ArrowLeft,
  LogOut,
  Plus,
  X,
  Sparkles,
  Filter,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOOD_CONFIG: Record<MoodLevel, { 
  icon: typeof Frown; 
  color: string; 
  bgColor: string;
  score: number;
}> = {
  terrible: { 
    icon: Frown, 
    color: "text-red-500", 
    bgColor: "bg-red-100 dark:bg-red-950/30",
    score: 1 
  },
  bad: { 
    icon: Meh, 
    color: "text-orange-500", 
    bgColor: "bg-orange-100 dark:bg-orange-950/30",
    score: 2 
  },
  neutral: { 
    icon: Smile, 
    color: "text-yellow-500", 
    bgColor: "bg-yellow-100 dark:bg-yellow-950/30",
    score: 3 
  },
  good: { 
    icon: SmilePlus, 
    color: "text-lime-500", 
    bgColor: "bg-lime-100 dark:bg-lime-950/30",
    score: 4 
  },
  great: { 
    icon: Laugh, 
    color: "text-green-500", 
    bgColor: "bg-green-100 dark:bg-green-950/30",
    score: 5 
  },
};

const MOOD_ORDER: MoodLevel[] = ['terrible', 'bad', 'neutral', 'good', 'great'];

export default function JournalPage() {
  const [, setLocation] = useLocation();
  const { user, profile, loading: authLoading, profileError, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [moodFilter, setMoodFilter] = useState<MoodLevel | "all">("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);

  const { data: entries = [], isLoading: entriesLoading, isError, error: entriesError, refetch } = useQuery<JournalEntry[]>({
    queryKey: ['/api/journal', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as JournalEntry[];
    },
    enabled: !!user,
    staleTime: 30000,
    retry: 1,
  });

  useEffect(() => {
    if (isError && entriesError) {
      toast({
        title: t('common.error'),
        description: String(entriesError),
        variant: "destructive",
      });
    }
  }, [isError, entriesError, toast, t]);

  useEffect(() => {
    if (!authLoading && !profileError) {
      if (!user) {
        setLocation("/auth");
      } else if (!profile?.onboarding_completed) {
        setLocation("/onboarding");
      }
    }
  }, [user, profile, authLoading, profileError, setLocation]);

  const handleSignOut = async () => {
    try {
      console.log("Sign out clicked");
      await signOut();
      console.log("Sign out completed");
      toast({
        title: t('dashboard.signedOut'),
        description: t('dashboard.signedOutDescription'),
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

  const clearFilters = () => {
    setMoodFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleNewEntry = () => {
    setSelectedEntry(null);
    setDialogOpen(true);
  };

  const handleEntryClick = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setDialogOpen(true);
  };

  const handleEntrySaved = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/journal', user?.id] });
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (moodFilter !== "all" && entry.mood !== moodFilter) {
        return false;
      }
      
      const entryDate = parseISO(entry.date);
      
      if (startDate && isBefore(entryDate, startOfDay(startDate))) {
        return false;
      }
      
      if (endDate && isAfter(entryDate, endOfDay(endDate))) {
        return false;
      }
      
      return true;
    });
  }, [entries, moodFilter, startDate, endDate]);

  const hasActiveFilters = moodFilter !== "all" || startDate || endDate;
  const isLoading = entriesLoading;

  if (authLoading) {
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
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle data-testid="text-error-title">{t('errors.loadingProfile')}</CardTitle>
            <CardDescription>{t('errors.couldNotLoadProfile')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="text-error-message">
              {profileError.message}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full" data-testid="button-retry">
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || !profile?.onboarding_completed) {
    return null;
  }

  const displayName = getDisplayName(profile.first_name, profile.last_name, profile.email);
  const initials = getInitials(profile.first_name, profile.last_name, profile.email);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
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
              {t('common.signOut')}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1" data-testid="text-journal-title">
                {t('journal.title')}
              </h1>
              <p className="text-muted-foreground" data-testid="text-journal-subtitle">
                {t('journal.subtitle')}
              </p>
            </div>
            <Button
              onClick={handleNewEntry}
              className="shrink-0"
              data-testid="button-new-entry"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('journal.newEntry')}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={moodFilter}
              onValueChange={(value) => setMoodFilter(value as MoodLevel | "all")}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-mood-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('journal.filters.allMoods')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-mood-all">
                  {t('journal.filters.allMoods')}
                </SelectItem>
                {MOOD_ORDER.map((mood) => {
                  const config = MOOD_CONFIG[mood];
                  const Icon = config.icon;
                  return (
                    <SelectItem key={mood} value={mood} data-testid={`option-mood-${mood}`}>
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", config.color)} />
                        <span>{t(`journal.mood.${mood}`)}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                  data-testid="button-start-date"
                >
                  <CalendarRange className="h-4 w-4 mr-2" />
                  {startDate ? format(startDate, 'MMM d, yyyy') : t('journal.filters.from')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                  data-testid="button-end-date"
                >
                  <CalendarRange className="h-4 w-4 mr-2" />
                  {endDate ? format(endDate, 'MMM d, yyyy') : t('journal.filters.to')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                {t('journal.filters.clear')}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3" data-testid="entries-skeleton">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex gap-1 mt-2">
                          <Skeleton className="h-5 w-12 rounded-full" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-destructive/10 rounded-full">
                    <X className="h-10 w-10 text-destructive" />
                  </div>
                  <div>
                    <p className="text-lg font-medium" data-testid="text-error">
                      {t('journal.errorLoading')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('journal.tryAgainLater')}
                    </p>
                  </div>
                  <Button onClick={() => refetch()} className="mt-2" data-testid="button-retry-entries">
                    {t('common.retry')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filteredEntries.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-muted rounded-full">
                    <Sparkles className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-muted-foreground" data-testid="text-no-entries">
                      {hasActiveFilters ? t('journal.noMatchingEntries') : t('journal.noEntriesYet')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasActiveFilters ? t('journal.tryDifferentFilters') : t('journal.startWriting')}
                    </p>
                  </div>
                  {!hasActiveFilters && (
                    <Button onClick={handleNewEntry} className="mt-2" data-testid="button-create-first-entry">
                      <Plus className="h-4 w-4 mr-2" />
                      {t('journal.newEntry')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => {
                const moodConfig = entry.mood ? MOOD_CONFIG[entry.mood] : null;
                const MoodIcon = moodConfig?.icon;
                const previewText = entry.entry_text 
                  ? entry.entry_text.length > 120 
                    ? entry.entry_text.slice(0, 120) + "..." 
                    : entry.entry_text
                  : null;

                return (
                  <Card 
                    key={entry.id} 
                    className="cursor-pointer hover-elevate transition-all"
                    onClick={() => handleEntryClick(entry)}
                    data-testid={`card-entry-${entry.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {MoodIcon && (
                          <div className={cn("p-2 rounded-full shrink-0", moodConfig?.bgColor)}>
                            <MoodIcon className={cn("h-5 w-5", moodConfig?.color)} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {format(parseISO(entry.date), 'EEE, MMM d, yyyy')}
                              </span>
                              {entry.mood && (
                                <Badge variant="secondary" className="text-xs">
                                  {t(`journal.mood.${entry.mood}`)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {previewText ? (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {previewText}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              {t('journal.noEntryForDate')}
                            </p>
                          )}
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.tags.slice(0, 3).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  #{tag}
                                </Badge>
                              ))}
                              {entry.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{entry.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <JournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={selectedEntry}
        userId={user.id}
        onEntrySaved={handleEntrySaved}
      />

      <AISidebar open={aiSidebarOpen} onOpenChange={setAiSidebarOpen} />
    </div>
  );
}
