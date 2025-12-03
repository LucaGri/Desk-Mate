import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getInitials, getDisplayName } from "@/lib/timezones";
import { supabase } from "@/lib/supabase";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { 
  ArrowLeft, 
  LogOut, 
  Send, 
  Bot, 
  User,
  Plus,
  Trash2,
  Calendar,
  BookOpen,
  Video,
  BarChart3,
  MessageSquare,
  Settings,
  Loader2,
  Sparkles
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  context_sources: string[];
}

interface ContextSources {
  calendar: boolean;
  journal: boolean;
  meetings: boolean;
  analytics: boolean;
}

export default function AssistantPage() {
  const [, setLocation] = useLocation();
  const { user, profile, loading: authLoading, profileError, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const [contextSources, setContextSources] = useState<ContextSources>({
    calendar: true,
    journal: true,
    meetings: true,
    analytics: true,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!authLoading && !profileError) {
      if (!user) {
        setLocation("/auth");
      } else if (profile && !profile.onboarding_completed) {
        setLocation("/onboarding");
      }
    }
  }, [user, profile, authLoading, profileError, setLocation]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      setConversationsLoading(true);
      const response = await fetchWithAuth("/api/ai/conversations");
      const data = await response.json();
      
      if (data.success) {
        setConversations(data.conversations || []);
        if (data.conversations?.length > 0 && !activeConversation) {
          setActiveConversation(data.conversations[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setConversationsLoading(false);
    }
  }, [user, activeConversation]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const response = await fetchWithAuth(`/api/ai/conversations/${conversationId}/messages`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
    } else {
      setMessages([]);
    }
  }, [activeConversation, fetchMessages]);

  const handleNewConversation = async () => {
    if (!user) return;
    
    try {
      const response = await fetchWithAuth("/api/ai/conversations", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          title: t('ai.newConversation'),
          contextSources: Object.keys(contextSources).filter(
            (key) => contextSources[key as keyof ContextSources]
          ),
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.conversation) {
        setConversations(prev => [data.conversation, ...prev]);
        setActiveConversation(data.conversation);
        setMessages([]);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast({
        title: t('common.error'),
        description: t('ai.errorCreatingConversation'),
        variant: "destructive",
      });
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const response = await fetchWithAuth(`/api/ai/conversations/${conversationId}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (activeConversation?.id === conversationId) {
          const remaining = conversations.filter(c => c.id !== conversationId);
          setActiveConversation(remaining.length > 0 ? remaining[0] : null);
        }
        toast({
          title: t('ai.conversationDeleted'),
          description: t('ai.conversationDeletedDescription'),
        });
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast({
        title: t('common.error'),
        description: t('ai.errorDeletingConversation'),
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user || isSending) return;
    
    if (!activeConversation) {
      await handleNewConversation();
    }
    
    const currentConversation = activeConversation;
    if (!currentConversation) return;
    
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsSending(true);
    
    try {
      const response = await fetchWithAuth("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: currentConversation.id,
          userId: user.id,
          message: inputMessage,
          contextSources: Object.keys(contextSources).filter(
            (key) => contextSources[key as keyof ContextSources]
          ),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [
          ...prev.filter(m => !m.id.startsWith("temp-")),
          data.userMessage,
          data.assistantMessage,
        ]);
        
        if (data.conversationTitle) {
          setActiveConversation(prev => prev ? { ...prev, title: data.conversationTitle } : null);
          setConversations(prev => 
            prev.map(c => 
              c.id === currentConversation.id 
                ? { ...c, title: data.conversationTitle } 
                : c
            )
          );
        }
      } else {
        setMessages(prev => prev.filter(m => !m.id.startsWith("temp-")));
        toast({
          title: t('common.error'),
          description: data.error || t('ai.errorSendingMessage'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prev => prev.filter(m => !m.id.startsWith("temp-")));
      toast({
        title: t('common.error'),
        description: t('ai.errorSendingMessage'),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const displayName = getDisplayName(profile.first_name, profile.last_name, profile.email);
  const initials = getInitials(profile.first_name, profile.last_name, profile.email);

  const getContextIcon = (source: string) => {
    switch (source) {
      case "calendar":
        return <Calendar className="h-3 w-3" />;
      case "journal":
        return <BookOpen className="h-3 w-3" />;
      case "meetings":
        return <Video className="h-3 w-3" />;
      case "analytics":
        return <BarChart3 className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{t('ai.assistant')}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
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
              <span className="hidden sm:inline">{t('auth.signOut')}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-4 flex gap-4 max-h-[calc(100vh-65px)]">
        <aside className="w-72 shrink-0 flex flex-col gap-4">
          <Button 
            onClick={handleNewConversation} 
            className="w-full"
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('ai.newConversation')}
          </Button>
          
          {showSettings && (
            <Card data-testid="card-context-settings">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {t('ai.contextSources')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(contextSources).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`context-${key}`} className="flex items-center gap-2 text-sm">
                      {getContextIcon(key)}
                      {t(`ai.context.${key}`)}
                    </Label>
                    <Switch
                      id={`context-${key}`}
                      checked={value}
                      onCheckedChange={(checked) =>
                        setContextSources(prev => ({ ...prev, [key]: checked }))
                      }
                      data-testid={`switch-context-${key}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t('ai.conversations')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                {conversationsLoading ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {t('ai.noConversations')}
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`p-3 cursor-pointer hover-elevate transition-colors ${
                          activeConversation?.id === conversation.id
                            ? "bg-primary/5"
                            : ""
                        }`}
                        onClick={() => setActiveConversation(conversation)}
                        data-testid={`conversation-${conversation.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {conversation.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(conversation.updated_at), "MMM d, HH:mm")}
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-delete-${conversation.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('ai.deleteConversation')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('ai.deleteConversationConfirm')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteConversation(conversation.id)}
                                >
                                  {t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        {conversation.context_sources?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {conversation.context_sources.map(source => (
                              <Badge key={source} variant="secondary" className="text-xs px-1.5 py-0">
                                {getContextIcon(source)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="border-b shrink-0 py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {activeConversation?.title || t('ai.startConversation')}
            </CardTitle>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "flex-row-reverse" : ""}`}>
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <Skeleton className="h-16 flex-1 max-w-[80%]" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">{t('ai.welcomeTitle')}</h3>
                <p className="text-muted-foreground max-w-md">
                  {t('ai.welcomeMessage')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    data-testid={`message-${message.id}`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === "user" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-primary/10 text-primary"
                    }`}>
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {format(parseISO(message.created_at), "HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {t('ai.thinking')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
          
          <div className="border-t p-4 shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('ai.typeMessage')}
                disabled={isSending}
                data-testid="input-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isSending}
                data-testid="button-send"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">{t('ai.usingContext')}:</span>
              {Object.entries(contextSources)
                .filter(([, value]) => value)
                .map(([key]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {getContextIcon(key)}
                    <span className="ml-1">{t(`ai.context.${key}`)}</span>
                  </Badge>
                ))}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
