import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  COMMON_TIMEZONES,
  WORK_DAYS,
  TIME_OPTIONS,
  getInitials,
  getDisplayName,
} from "@/lib/timezones";
import { Profile, ProfileUpdate } from "@/lib/supabase-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronsUpDown,
  Clock,
  Bell,
  Video,
  Sun,
  Moon,
  Monitor,
  Loader2,
  User,
  Calendar,
  Globe,
  Briefcase,
  Save,
  Sparkles,
  MessageSquare,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { changeLanguage } from "@/lib/i18n";
import { GoogleCalendarSync } from "@/components/google-calendar-sync";

const profileFormSchema = z
  .object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    job_title: z.string().nullable(),
    timezone: z.string(),
    week_start_day: z.enum(["monday", "sunday"]),
    default_calendar_view: z.enum(["day", "week", "month"]),
    default_meeting_duration: z.enum(["15", "30", "45", "60"]),
    email_notifications_enabled: z.boolean(),
    default_reminder_timing: z.enum(["5", "10", "15", "30"]),
    video_camera_on_join: z.boolean(),
    video_mic_on_join: z.boolean(),
    video_background_blur: z.boolean(),
    work_hours_start: z.string(),
    work_hours_end: z.string(),
    work_days: z.array(z.number()),
    theme: z.enum(["light", "dark", "system"]),
    locale: z.string(),
  })
  .refine(
    (data) => {
      const start = data.work_hours_start;
      const end = data.work_hours_end;
      if (!start || !end) return true;
      const startMinutes =
        parseInt(start.split(":")[0]) * 60 + parseInt(start.split(":")[1]);
      const endMinutes =
        parseInt(end.split(":")[0]) * 60 + parseInt(end.split(":")[1]);
      return endMinutes > startMinutes;
    },
    {
      message: "End time must be after start time",
      path: ["work_hours_end"],
    },
  );

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [aiSettings, setAiSettings] = useState({
    context_calendar: true,
    context_journal: true,
    context_meetings: true,
    context_analytics: true,
    preferred_language: "en",
  });
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false);
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false);

  const defaultValues: ProfileFormValues = {
    first_name: null,
    last_name: null,
    job_title: null,
    timezone: "Europe/Rome",
    week_start_day: "monday",
    default_calendar_view: "week",
    default_meeting_duration: "30",
    email_notifications_enabled: true,
    default_reminder_timing: "15",
    video_camera_on_join: true,
    video_mic_on_join: true,
    video_background_blur: false,
    work_hours_start: "09:00",
    work_hours_end: "18:00",
    work_days: [1, 2, 3, 4, 5],
    theme: "system",
    locale: "it",
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name ?? null,
        last_name: profile.last_name ?? null,
        job_title: profile.job_title ?? null,
        timezone: profile.timezone ?? "Europe/Rome",
        week_start_day: profile.week_start_day ?? "monday",
        default_calendar_view: profile.default_calendar_view ?? "week",
        default_meeting_duration: profile.default_meeting_duration ?? "30",
        email_notifications_enabled:
          profile.email_notifications_enabled ?? true,
        default_reminder_timing: profile.default_reminder_timing ?? "15",
        video_camera_on_join: profile.video_camera_on_join ?? true,
        video_mic_on_join: profile.video_mic_on_join ?? true,
        video_background_blur: profile.video_background_blur ?? false,
        work_hours_start: profile.work_hours_start ?? "09:00",
        work_hours_end: profile.work_hours_end ?? "18:00",
        work_days: profile.work_days ?? [1, 2, 3, 4, 5],
        theme: profile.theme ?? "system",
        locale: profile.locale ?? "it",
      });
    }
  }, [profile, form]);

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
    const fetchAiSettings = async () => {
      if (!user) return;
      
      setAiSettingsLoading(true);
      try {
        const response = await fetchWithAuth("/api/ai/settings");
        const data = await response.json();
        
        if (data.success && data.settings) {
          setAiSettings({
            context_calendar: data.settings.context_calendar ?? true,
            context_journal: data.settings.context_journal ?? true,
            context_meetings: data.settings.context_meetings ?? true,
            context_analytics: data.settings.context_analytics ?? true,
            preferred_language: data.settings.preferred_language ?? profile?.locale ?? "en",
          });
        }
      } catch (error) {
        console.error("Failed to fetch AI settings:", error);
      } finally {
        setAiSettingsLoading(false);
      }
    };

    if (user) {
      fetchAiSettings();
    }
  }, [user, profile?.locale]);

  const handleAiSettingChange = async (key: string, value: boolean | string) => {
    const newSettings = { ...aiSettings, [key]: value };
    setAiSettings(newSettings);
    setAiSettingsSaving(true);
    
    try {
      await fetchWithAuth("/api/ai/settings", {
        method: "PUT",
        body: JSON.stringify(newSettings),
      });
      
      toast({
        title: t('profile.settingsSaved'),
        description: t('profile.aiSettingsUpdated'),
      });
    } catch (error) {
      console.error("Failed to save AI settings:", error);
      toast({
        title: t('common.error'),
        description: t('profile.failedToSaveAiSettings'),
        variant: "destructive",
      });
    } finally {
      setAiSettingsSaving(false);
    }
  };

  const applyTheme = useCallback((theme: "light" | "dark" | "system") => {
    const root = document.documentElement;
    if (theme === "system") {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.classList.toggle("dark", systemDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
    localStorage.setItem("theme", theme);
  }, []);

  const saveProfile = useCallback(
    async (data: ProfileFormValues) => {
      if (!user) return;

      setSaving(true);
      try {
        console.log("Saving profile...");
        const updateData: ProfileUpdate = {
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          job_title: data.job_title || null,
          timezone: data.timezone || "Europe/Rome",
          week_start_day: data.week_start_day || "monday",
          default_calendar_view: data.default_calendar_view || "week",
          default_meeting_duration: data.default_meeting_duration || "30",
          email_notifications_enabled: data.email_notifications_enabled ?? true,
          default_reminder_timing: data.default_reminder_timing || "15",
          video_camera_on_join: data.video_camera_on_join ?? true,
          video_mic_on_join: data.video_mic_on_join ?? true,
          video_background_blur: data.video_background_blur ?? false,
          work_hours_start: data.work_hours_start || "09:00",
          work_hours_end: data.work_hours_end || "18:00",
          work_days:
            data.work_days?.length > 0 ? data.work_days : [1, 2, 3, 4, 5],
          theme: data.theme || "system",
          locale: data.locale || "it",
        };

        const { error } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", user.id);

        if (error) throw error;
        console.log("Profile updated in database");

        applyTheme(data.theme);
        changeLanguage(data.locale);
        setHasUnsavedChanges(false);

        try {
          await refreshProfile();
          console.log("Profile refreshed");
        } catch (refreshError) {
          console.error("Error refreshing profile (non-blocking):", refreshError);
        }

        toast({
          title: t('profile.profileUpdated'),
          description: t('profile.changesSaved'),
        });
        console.log("Save completed successfully");
      } catch (error: any) {
        console.error("Error saving profile:", error);
        toast({
          title: t('profile.errorSavingProfile'),
          description: error.message || t('errors.generic'),
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [user, toast, refreshProfile, applyTheme, changeLanguage, t],
  );

  const handleFormChange = useCallback(() => {
    setHasUnsavedChanges(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('profile.invalidFileType'),
        description: t('profile.uploadImageFormats'),
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: t('profile.fileTooLarge'),
        description: t('profile.uploadSizeLimit'),
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingAvatar(true);
    console.log("1. Starting avatar upload for user:", user.id);

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/avatar.${fileExt}`;
      console.log("2. File path:", filePath);

      // Skip list/delete - just use upsert directly
      // This avoids potential issues with list permissions
      console.log("3. Uploading file...");

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

      console.log("4. Upload result:", { uploadData, uploadError });

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw uploadError;
      }

      // Correct way to get public URL
      console.log("5. Getting public URL...");
      const urlData = supabase.storage.from("avatars").getPublicUrl(filePath);

      console.log("6. URL data:", urlData);

      const publicUrl = urlData.data.publicUrl;
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      console.log("7. Final URL:", urlWithTimestamp);

      // Update profile
      console.log("8. Updating profile...");
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithTimestamp })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        throw updateError;
      }

      console.log("9. Refreshing profile...");
      await refreshProfile();

      console.log("10. Success!");
      toast({
        title: t('profile.avatarUpdated'),
        description: t('profile.avatarUpdatedDescription'),
      });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      toast({
        title: t('profile.uploadFailed'),
        description: error?.message || t('errors.generic'),
        variant: "destructive",
      });
    } finally {
      console.log("11. Cleanup - setting uploadingAvatar to false");
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onSubmit = (data: ProfileFormValues) => {
    saveProfile(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle data-testid="text-error-title">
              {t('onboarding.errorLoadingProfile')}
            </CardTitle>
            <CardDescription>
              {t('onboarding.couldntLoadProfile')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-error-message"
            >
              {profileError.message}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
              data-testid="button-retry"
            >
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

  const watchedValues = form.watch();
  const initials = getInitials(
    watchedValues.first_name,
    watchedValues.last_name,
    profile.email,
  );
  const displayName = getDisplayName(
    watchedValues.first_name,
    watchedValues.last_name,
    profile.email,
  );

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
            <div>
              <h1 className="text-xl font-bold" data-testid="text-page-title">
                {t('profile.title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('profile.subtitle')}
              </p>
            </div>
          </div>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={saving || !hasUnsavedChanges}
            data-testid="button-save"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('profile.saveChanges')}
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Form {...form}>
          <form onChange={handleFormChange} className="space-y-6">
            <Card data-testid="card-personal-info">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>{t('profile.personalInfo')}</CardTitle>
                </div>
                <CardDescription>
                  {t('profile.personalInfoDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24" data-testid="avatar-profile">
                      <AvatarImage
                        src={profile.avatar_url || undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      data-testid="input-avatar-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      data-testid="button-upload-avatar"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium" data-testid="text-display-name">
                      {displayName}
                    </p>
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid="text-email"
                    >
                      {profile.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('profile.clickCameraToUpload')}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.firstName')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('profile.enterFirstName')}
                            {...field}
                            value={field.value || ""}
                            data-testid="input-first-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.lastName')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('profile.enterLastName')}
                            {...field}
                            value={field.value || ""}
                            data-testid="input-last-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="job_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.jobTitle')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('profile.jobTitlePlaceholder')}
                          {...field}
                          value={field.value || ""}
                          data-testid="input-job-title"
                        />
                      </FormControl>
                      <FormDescription>
                        {t('profile.jobTitleDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card data-testid="card-calendar-preferences">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle>{t('profile.calendarPreferences')}</CardTitle>
                </div>
                <CardDescription>
                  {t('profile.calendarPreferencesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('profile.timezone')}</FormLabel>
                      <Popover
                        open={timezoneOpen}
                        onOpenChange={setTimezoneOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground",
                              )}
                              data-testid="button-timezone"
                            >
                              {field.value
                                ? COMMON_TIMEZONES.find(
                                    (tz) => tz.value === field.value,
                                  )?.label || field.value
                                : "Select timezone"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search timezone..."
                              data-testid="input-timezone-search"
                            />
                            <CommandList>
                              <CommandEmpty>{t('profile.noTimezoneFound')}</CommandEmpty>
                              <CommandGroup>
                                {COMMON_TIMEZONES.map((tz) => (
                                  <CommandItem
                                    key={tz.value}
                                    value={tz.label}
                                    onSelect={() => {
                                      form.setValue("timezone", tz.value);
                                      setTimezoneOpen(false);
                                      handleFormChange();
                                    }}
                                    data-testid={`option-timezone-${tz.value}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === tz.value
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {tz.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="week_start_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.weekStartsOn')}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleFormChange();
                          }}
                          value={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="monday"
                              id="week-monday"
                              data-testid="radio-week-monday"
                            />
                            <Label htmlFor="week-monday">{t('calendar.days.monday')}</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="sunday"
                              id="week-sunday"
                              data-testid="radio-week-sunday"
                            />
                            <Label htmlFor="week-sunday">{t('calendar.days.sunday')}</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="default_calendar_view"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.defaultCalendarView')}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleFormChange();
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-default-view">
                              <SelectValue placeholder={t('profile.selectView')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem
                              value="day"
                              data-testid="option-view-day"
                            >
                              {t('calendar.views.day')}
                            </SelectItem>
                            <SelectItem
                              value="week"
                              data-testid="option-view-week"
                            >
                              {t('calendar.views.week')}
                            </SelectItem>
                            <SelectItem
                              value="month"
                              data-testid="option-view-month"
                            >
                              {t('calendar.views.month')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="default_meeting_duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.defaultMeetingDuration')}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleFormChange();
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-meeting-duration">
                              <SelectValue placeholder={t('profile.selectDuration')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem
                              value="15"
                              data-testid="option-duration-15"
                            >
                              {t('profile.minutes', { count: 15 })}
                            </SelectItem>
                            <SelectItem
                              value="30"
                              data-testid="option-duration-30"
                            >
                              {t('profile.minutes', { count: 30 })}
                            </SelectItem>
                            <SelectItem
                              value="45"
                              data-testid="option-duration-45"
                            >
                              {t('profile.minutes', { count: 45 })}
                            </SelectItem>
                            <SelectItem
                              value="60"
                              data-testid="option-duration-60"
                            >
                              {t('profile.minutes', { count: 60 })}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <GoogleCalendarSync />

            <Card data-testid="card-notifications">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle>{t('profile.notificationPreferences')}</CardTitle>
                </div>
                <CardDescription>
                  {t('profile.notificationPreferencesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="email_notifications_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('profile.emailNotifications')}
                        </FormLabel>
                        <FormDescription>
                          {t('profile.emailNotificationsDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            handleFormChange();
                          }}
                          data-testid="switch-email-notifications"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_reminder_timing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.defaultReminder')}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleFormChange();
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-reminder-timing">
                            <SelectValue placeholder={t('profile.selectReminderTiming')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5" data-testid="option-reminder-5">
                            {t('profile.minutesBefore', { count: 5 })}
                          </SelectItem>
                          <SelectItem
                            value="10"
                            data-testid="option-reminder-10"
                          >
                            {t('profile.minutesBefore', { count: 10 })}
                          </SelectItem>
                          <SelectItem
                            value="15"
                            data-testid="option-reminder-15"
                          >
                            {t('profile.minutesBefore', { count: 15 })}
                          </SelectItem>
                          <SelectItem
                            value="30"
                            data-testid="option-reminder-30"
                          >
                            {t('profile.minutesBefore', { count: 30 })}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t('profile.reminderDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card data-testid="card-video-preferences">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  <CardTitle>{t('profile.videoCallPreferences')}</CardTitle>
                </div>
                <CardDescription>
                  {t('profile.videoCallPreferencesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="video_camera_on_join"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('profile.cameraOnByDefault')}
                        </FormLabel>
                        <FormDescription>
                          {t('profile.cameraOnDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            handleFormChange();
                          }}
                          data-testid="switch-camera-on"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="video_mic_on_join"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('profile.micOnByDefault')}
                        </FormLabel>
                        <FormDescription>
                          {t('profile.micOnDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            handleFormChange();
                          }}
                          data-testid="switch-mic-on"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="video_background_blur"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('profile.backgroundBlur')}
                        </FormLabel>
                        <FormDescription>
                          {t('profile.backgroundBlurDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            handleFormChange();
                          }}
                          data-testid="switch-background-blur"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card data-testid="card-working-hours">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>{t('profile.workingHours')}</CardTitle>
                </div>
                <CardDescription>
                  {t('profile.workingHoursDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="work_hours_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.startTime')}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleFormChange();
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-work-start">
                              <Clock className="h-4 w-4 mr-2 opacity-50" />
                              <SelectValue placeholder={t('profile.selectStartTime')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {TIME_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                data-testid={`option-start-${opt.value}`}
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="work_hours_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profile.endTime')}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleFormChange();
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-work-end">
                              <Clock className="h-4 w-4 mr-2 opacity-50" />
                              <SelectValue placeholder={t('profile.selectEndTime')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {TIME_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                data-testid={`option-end-${opt.value}`}
                              >
                                {opt.label}
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
                  name="work_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.workingDays')}</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-2">
                          {WORK_DAYS.map((day) => {
                            const isSelected = field.value.includes(day.value);
                            const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                            const dayLabel = t(`calendar.days.${dayKeys[day.value]}`);
                            return (
                              <Button
                                key={day.value}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  const newDays = isSelected
                                    ? field.value.filter((d) => d !== day.value)
                                    : [...field.value, day.value].sort(
                                        (a, b) => a - b,
                                      );
                                  field.onChange(newDays);
                                  handleFormChange();
                                }}
                                data-testid={`button-workday-${day.value}`}
                                className="min-w-[56px]"
                              >
                                {dayLabel}
                              </Button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t('profile.workingDaysDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card data-testid="card-theme-language">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <CardTitle>{t('profile.themeAndLanguage')}</CardTitle>
                </div>
                <CardDescription>
                  {t('profile.themeAndLanguageDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.theme')}</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          {[
                            {
                              value: "light" as const,
                              label: t('profile.themeLight'),
                              icon: Sun,
                            },
                            {
                              value: "dark" as const,
                              label: t('profile.themeDark'),
                              icon: Moon,
                            },
                            {
                              value: "system" as const,
                              label: t('profile.themeSystem'),
                              icon: Monitor,
                            },
                          ].map((theme) => {
                            const Icon = theme.icon;
                            const isSelected = field.value === theme.value;
                            return (
                              <Button
                                key={theme.value}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => {
                                  field.onChange(theme.value);
                                  applyTheme(theme.value);
                                  handleFormChange();
                                }}
                                className="flex-1"
                                data-testid={`button-theme-${theme.value}`}
                              >
                                <Icon className="h-4 w-4 mr-2" />
                                {theme.label}
                              </Button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locale"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profile.language')}</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleFormChange();
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-locale">
                            <SelectValue placeholder={t('profile.selectLanguage')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en" data-testid="option-locale-en">
                            English
                          </SelectItem>
                          <SelectItem value="it" data-testid="option-locale-it">
                            Italiano
                          </SelectItem>
                          <SelectItem value="de" data-testid="option-locale-de">
                            Deutsch
                          </SelectItem>
                          <SelectItem value="fr" data-testid="option-locale-fr">
                            Français
                          </SelectItem>
                          <SelectItem value="es" data-testid="option-locale-es">
                            Español
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card data-testid="card-ai-assistant">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>{t('profile.aiAssistantSettings')}</CardTitle>
                </div>
                <CardDescription>
                  {t('profile.aiAssistantDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">
                    {t('profile.aiContextSources')}
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('profile.aiContextSourcesDescription')}
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="ai-context-calendar" className="cursor-pointer">
                            {t('ai.context.calendar')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('profile.aiContextCalendarDesc')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ai-context-calendar"
                        checked={aiSettings.context_calendar}
                        onCheckedChange={(checked) => handleAiSettingChange("context_calendar", checked)}
                        disabled={aiSettingsLoading || aiSettingsSaving}
                        data-testid="switch-ai-calendar"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="ai-context-journal" className="cursor-pointer">
                            {t('ai.context.journal')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('profile.aiContextJournalDesc')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ai-context-journal"
                        checked={aiSettings.context_journal}
                        onCheckedChange={(checked) => handleAiSettingChange("context_journal", checked)}
                        disabled={aiSettingsLoading || aiSettingsSaving}
                        data-testid="switch-ai-journal"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="ai-context-meetings" className="cursor-pointer">
                            {t('ai.context.meetings')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('profile.aiContextMeetingsDesc')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ai-context-meetings"
                        checked={aiSettings.context_meetings}
                        onCheckedChange={(checked) => handleAiSettingChange("context_meetings", checked)}
                        disabled={aiSettingsLoading || aiSettingsSaving}
                        data-testid="switch-ai-meetings"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="ai-context-analytics" className="cursor-pointer">
                            {t('ai.context.analytics')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('profile.aiContextAnalyticsDesc')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ai-context-analytics"
                        checked={aiSettings.context_analytics}
                        onCheckedChange={(checked) => handleAiSettingChange("context_analytics", checked)}
                        disabled={aiSettingsLoading || aiSettingsSaving}
                        data-testid="switch-ai-analytics"
                      />
                    </div>
                  </div>
                </div>

                {aiSettingsSaving && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.saving')}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end pb-8">
              <Button
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                disabled={saving || !hasUnsavedChanges}
                size="lg"
                data-testid="button-save-bottom"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('profile.saveChanges')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
