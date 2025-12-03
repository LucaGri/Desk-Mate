import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, CheckCircle2 } from "lucide-react";

export default function Auth() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, profile, loading: authLoading, profileError } = useAuth();
  const { t } = useTranslation();
  
  const searchParams = new URLSearchParams(searchString);
  const mode = searchParams.get('mode');
  const [isSignUp, setIsSignUp] = useState(mode === 'register');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (mode === 'register' || mode === 'login') {
      setIsSignUp(mode === 'register');
      setShowEmailConfirmation(false);
    }
  }, [mode]);

  const clearAuthCache = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      window.location.reload();
    }
  };

  useEffect(() => {
    if (!authLoading && user && profile) {
      if (profile.onboarding_completed) {
        setLocation("/dashboard");
      } else {
        setLocation("/onboarding");
      }
    }
  }, [user, profile, authLoading, setLocation]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth?mode=login`
          },
        });
        if (error) throw error;
        
        if (data.user) {
          setRegisteredEmail(email);
          setShowEmailConfirmation(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('errors.generic'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('errors.generic'),
        variant: "destructive",
      });
    }
  };

  if (showEmailConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Link href="/" data-testid="link-auth-home">
              <img src="/logo.png" alt="Desk Mate" className="h-10 mx-auto mb-6" />
            </Link>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold" data-testid="text-check-email-title">
                  {t('auth.checkEmail')}
                </h2>
                <p className="text-muted-foreground" data-testid="text-check-email-description">
                  {t('auth.verificationSent')}
                </p>
                <p className="font-medium text-foreground" data-testid="text-registered-email">
                  {registeredEmail}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {t('auth.clickToVerify')}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {t('auth.thenReturn')}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => {
                    setShowEmailConfirmation(false);
                    setIsSignUp(false);
                    setEmail(registeredEmail);
                    setPassword("");
                  }}
                  data-testid="button-go-to-login"
                >
                  {t('auth.goToLogin')}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {t('auth.didntReceive')}{" "}
                  <button 
                    onClick={() => setShowEmailConfirmation(false)}
                    className="text-primary hover:underline"
                    data-testid="button-try-again"
                  >
                    {t('auth.tryAgain')}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground" data-testid="text-email-sender">
            {t('auth.emailSentFrom')}: noreply@desk-mate.it
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" data-testid="link-auth-home">
            <img src="/logo.png" alt="Desk Mate" className="h-10 mx-auto mb-6" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-auth-title">
            {isSignUp ? t('auth.createAccount') : t('auth.welcomeBack')}
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-auth-subtitle">
            {isSignUp ? t('auth.startJourney') : t('auth.loginToAccount')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isSignUp ? t('auth.register') : t('auth.login')}</CardTitle>
            <CardDescription>
              {isSignUp
                ? t('auth.createAccountDescription')
                : t('auth.loginDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleAuth}
              data-testid="button-google-auth"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('auth.continueWithGoogle')}
            </Button>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                {t('auth.orContinueWith')}
              </span>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    data-testid="input-fullname"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-submit"
              >
                {loading ? t('common.loading') : isSignUp ? t('auth.createAccountButton') : t('auth.login')}
              </Button>
            </form>

            <div className="text-center text-sm">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover-elevate"
                data-testid="button-toggle-mode"
              >
                {isSignUp
                  ? t('auth.alreadyHaveAccount')
                  : t('auth.noAccount')}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground" data-testid="text-auth-terms">
          {t('auth.termsAgreement')}{" "}
          <a href="#" className="underline hover-elevate">{t('auth.termsOfService')}</a>{" "}
          {t('auth.and')}{" "}
          <a href="#" className="underline hover-elevate">{t('auth.privacyPolicy')}</a>
        </p>

        {profileError && (
          <div className="text-center">
            <p className="text-sm text-destructive mb-2" data-testid="text-auth-error">
              {t('auth.havingTrouble')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAuthCache}
              data-testid="button-clear-cache"
            >
              {t('auth.clearCache')}
            </Button>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={clearAuthCache}
            className="text-xs text-muted-foreground hover:text-foreground underline"
            data-testid="button-clear-cache-link"
          >
            {t('auth.havingIssues')}
          </button>
        </div>
      </div>
    </div>
  );
}
