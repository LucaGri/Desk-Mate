import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getInitials, getDisplayName } from "@/lib/timezones";
import { Calendar, FileText, BarChart3, LogOut, Bot } from "lucide-react";
import { AISidebar, AITriggerButton } from "@/components/ai-sidebar";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, profile, loading, profileError, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profileError) {
      if (!user) {
        setLocation("/auth");
      } else if (!profile?.onboarding_completed) {
        setLocation("/onboarding");
      }
    }
  }, [user, profile, loading, profileError, setLocation]);

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

  const handleSignOut = async () => {
    try {
      await signOut();
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

  const displayName = getDisplayName(profile.first_name, profile.last_name, profile.email);
  const initials = getInitials(profile.first_name, profile.last_name, profile.email);
  const firstName = profile.first_name || displayName.split(" ")[0];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img 
            src="/logo.png" 
            alt="Desk Mate" 
            className="h-12 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setLocation("/dashboard")}
            data-testid="logo-home"
          />
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
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-2" data-testid="text-welcome">
              {t('dashboard.welcomeBack', { name: firstName })}
            </h2>
            <p className="text-muted-foreground" data-testid="text-subtitle">
              {t('dashboard.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover-elevate cursor-pointer" data-testid="card-calendar" onClick={() => setLocation("/calendar")}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t('dashboard.calendarMeetings')}</CardTitle>
                    <CardDescription>{t('dashboard.calendarDescription')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.calendarDetails')}
                </p>
                <Button className="mt-4 w-full" data-testid="button-calendar" onClick={(e) => { e.stopPropagation(); setLocation("/calendar"); }}>
                  {t('dashboard.openCalendar')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="card-chat" onClick={() => setAiSidebarOpen(true)}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t('dashboard.aiChat')}</CardTitle>
                    <CardDescription>{t('dashboard.aiChatDescription')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.aiChatDetails')}
                </p>
                <Button className="mt-4 w-full" data-testid="button-chat" onClick={(e) => { e.stopPropagation(); setAiSidebarOpen(true); }}>
                  {t('dashboard.startChatting')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="card-journal" onClick={() => setLocation("/journal")}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t('dashboard.journal')}</CardTitle>
                    <CardDescription>{t('dashboard.journalDescription')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.journalDetails')}
                </p>
                <Button className="mt-4 w-full" data-testid="button-journal" onClick={(e) => { e.stopPropagation(); setLocation("/journal"); }}>
                  {t('dashboard.openJournal')}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" data-testid="card-analytics" onClick={() => setLocation("/analysis")}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t('dashboard.analytics')}</CardTitle>
                    <CardDescription>{t('dashboard.analyticsDescription')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.analyticsDetails')}
                </p>
                <Button className="mt-4 w-full" data-testid="button-analytics" onClick={(e) => { e.stopPropagation(); setLocation("/analysis"); }}>
                  {t('dashboard.viewAnalytics')}
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      <AISidebar open={aiSidebarOpen} onOpenChange={setAiSidebarOpen} />
    </div>
  );
}
