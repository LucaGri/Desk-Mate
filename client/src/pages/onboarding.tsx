import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingFormData } from "@/lib/supabase-types";
import { CheckCircle2 } from "lucide-react";
import { changeLanguage } from "@/lib/i18n";

const WORK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIMEZONES = [
  { value: "Europe/Rome", label: "Europe/Rome (GMT+1)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "Europe/Paris", label: "Europe/Paris (GMT+1)" },
  { value: "America/New_York", label: "America/New York (GMT-5)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (GMT-8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9)" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const {
    user,
    profile,
    loading: authLoading,
    profileError,
    refreshProfile,
  } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<OnboardingFormData>({
    full_name: profile?.full_name || user?.user_metadata?.full_name || "",
    timezone: "Europe/Rome",
    locale: "EN",
    work_hours_start: "09:00",
    work_hours_end: "18:00",
    work_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    calendar_view_default: "Week",
  });

  useEffect(() => {
    if (!authLoading && !profileError) {
      if (!user) {
        setLocation("/auth");
      } else if (profile?.onboarding_completed) {
        setLocation("/dashboard");
      }
    }
  }, [user, profile, authLoading, profileError, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p
            className="text-sm text-muted-foreground"
            data-testid="text-loading"
          >
            {t("common.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle data-testid="text-error-title">
              {t("onboarding.errorLoadingProfile")}
            </CardTitle>
            <CardDescription>
              {t("onboarding.couldntLoadProfile")}
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
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || profile?.onboarding_completed) {
    return null;
  }

  const handleContinue = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Converti work_days da stringhe a numeri (il DB usa numeri)
      const workDaysMap: Record<string, number> = {
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
        Sunday: 7,
      };
      const workDaysNumbers = formData.work_days.map((day) => workDaysMap[day]);

      // Salva TUTTO su profiles (non più su user_settings)
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          timezone: formData.timezone,
          locale: formData.locale,
          work_hours_start: formData.work_hours_start,
          work_hours_end: formData.work_hours_end,
          work_days: workDaysNumbers,
          default_calendar_view: formData.calendar_view_default.toLowerCase(),
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (profileUpdateError) throw profileUpdateError;

      const refreshedProfile = await refreshProfile();

      if (!refreshedProfile) {
        throw new Error(
          "Failed to refresh profile after onboarding. Please try signing in again.",
        );
      }

      toast({
        title: t("common.success"),
        description: t("onboarding.preferencesSaved"),
      });

      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("errors.generic"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day],
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step ? "w-12 bg-primary" : "w-8 bg-muted"
                }`}
                data-testid={`progress-step-${s}`}
              />
            ))}
          </div>
          <p
            className="text-center text-sm text-muted-foreground"
            data-testid="text-step-indicator"
          >
            {t("onboarding.stepOf", { current: step, total: 3 })}
          </p>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle data-testid="text-step1-title">
                  {t("onboarding.welcomeTitle")}
                </CardTitle>
                <CardDescription>
                  {t("onboarding.welcomeDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("profile.fullName")}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    data-testid="input-fullname"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">{t("profile.timezone")}</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) =>
                      setFormData({ ...formData, timezone: value })
                    }
                  >
                    <SelectTrigger id="timezone" data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem
                          key={tz.value}
                          value={tz.value}
                          data-testid={`option-timezone-${tz.value}`}
                        >
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("profile.language")}</Label>
                  <RadioGroup
                    value={formData.locale}
                    onValueChange={(value) => {
                      setFormData({ ...formData, locale: value });
                      changeLanguage(value.toLowerCase());
                    }}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="en"
                        id="en"
                        data-testid="radio-locale-en"
                      />
                      <Label
                        htmlFor="en"
                        className="font-normal cursor-pointer"
                      >
                        English
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="it"
                        id="it"
                        data-testid="radio-locale-it"
                      />
                      <Label
                        htmlFor="it"
                        className="font-normal cursor-pointer"
                      >
                        Italiano
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="de"
                        id="de"
                        data-testid="radio-locale-de"
                      />
                      <Label
                        htmlFor="de"
                        className="font-normal cursor-pointer"
                      >
                        Deutsch
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="fr"
                        id="fr"
                        data-testid="radio-locale-fr"
                      />
                      <Label
                        htmlFor="fr"
                        className="font-normal cursor-pointer"
                      >
                        Français
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="es"
                        id="es"
                        data-testid="radio-locale-es"
                      />
                      <Label
                        htmlFor="es"
                        className="font-normal cursor-pointer"
                      >
                        Español
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button
                  onClick={handleContinue}
                  className="w-full"
                  data-testid="button-continue"
                >
                  {t("common.continue")}
                </Button>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle data-testid="text-step2-title">
                  {t("onboarding.calendarPreferencesTitle")}
                </CardTitle>
                <CardDescription>
                  {t("onboarding.calendarPreferencesDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workStart">
                      {t("profile.workHoursStart")}
                    </Label>
                    <Input
                      id="workStart"
                      type="time"
                      value={formData.work_hours_start}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          work_hours_start: e.target.value,
                        })
                      }
                      data-testid="input-work-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workEnd">{t("profile.workHoursEnd")}</Label>
                    <Input
                      id="workEnd"
                      type="time"
                      value={formData.work_hours_end}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          work_hours_end: e.target.value,
                        })
                      }
                      data-testid="input-work-end"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>{t("profile.workDays")}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {WORK_DAYS.map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={formData.work_days.includes(day)}
                          onCheckedChange={() => toggleWorkDay(day)}
                          data-testid={`checkbox-workday-${day.toLowerCase()}`}
                        />
                        <Label
                          htmlFor={day}
                          className="font-normal cursor-pointer"
                        >
                          {t(`calendar.days.${day.toLowerCase()}`)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("profile.defaultCalendarView")}</Label>
                  <RadioGroup
                    value={formData.calendar_view_default}
                    onValueChange={(value) =>
                      setFormData({ ...formData, calendar_view_default: value })
                    }
                    className="flex gap-4"
                  >
                    {["Day", "Week", "Month"].map((view) => (
                      <div key={view} className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={view}
                          id={view.toLowerCase()}
                          data-testid={`radio-view-${view.toLowerCase()}`}
                        />
                        <Label
                          htmlFor={view.toLowerCase()}
                          className="font-normal cursor-pointer"
                        >
                          {t(`calendar.views.${view.toLowerCase()}`)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleBack}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-back"
                  >
                    {t("common.back")}
                  </Button>
                  <Button
                    onClick={handleContinue}
                    className="flex-1"
                    data-testid="button-continue"
                  >
                    {t("common.continue")}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircle2
                    className="h-16 w-16 text-primary"
                    data-testid="icon-success"
                  />
                </div>
                <CardTitle data-testid="text-step3-title">
                  {t("onboarding.allSetTitle")}
                </CardTitle>
                <CardDescription>
                  {t("onboarding.allSetDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium text-sm">
                    {t("onboarding.yourPreferences")}
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li data-testid="text-summary-name">
                      {t("onboarding.summaryName")}: {formData.full_name}
                    </li>
                    <li data-testid="text-summary-timezone">
                      {t("onboarding.summaryTimezone")}: {formData.timezone}
                    </li>
                    <li data-testid="text-summary-locale">
                      {t("onboarding.summaryLanguage")}:{" "}
                      {formData.locale.toUpperCase()}
                    </li>
                    <li data-testid="text-summary-hours">
                      {t("onboarding.summaryWorkHours")}:{" "}
                      {formData.work_hours_start} - {formData.work_hours_end}
                    </li>
                    <li data-testid="text-summary-days">
                      {t("onboarding.summaryWorkDays")}:{" "}
                      {formData.work_days
                        .map((day) => t(`calendar.days.${day.toLowerCase()}`))
                        .join(", ")}
                    </li>
                    <li data-testid="text-summary-view">
                      {t("onboarding.summaryDefaultView")}:{" "}
                      {t(
                        `calendar.views.${formData.calendar_view_default.toLowerCase()}`,
                      )}
                    </li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleBack}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-back"
                  >
                    {t("common.back")}
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={loading}
                    className="flex-1"
                    data-testid="button-complete"
                  >
                    {loading
                      ? t("common.saving")
                      : t("onboarding.startUsingDeskMate")}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
