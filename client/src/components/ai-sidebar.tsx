import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  Calendar,
  BookOpen,
  Video,
  BarChart3,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface AISettings {
  context_calendar: boolean;
  context_journal: boolean;
  context_meetings: boolean;
  context_analytics: boolean;
  preferred_language: string;
  summary_style: string;
}

interface AISidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChatResponse {
  conversationId?: string;
  userMessage?: Message;
  assistantMessage?: Message;
  response?: string;
  contextUsed?: object;
}

export function AISidebar({ open, onOpenChange }: AISidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: settings } = useQuery<AISettings>({
    queryKey: ["/api/ai/settings"],
    enabled: !!user,
  });

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string): Promise<ChatResponse> => {
      let response: Response;
      if (conversationId) {
        response = await fetchWithAuth(`/api/ai/conversations/${conversationId}/messages`, {
          method: "POST",
          body: JSON.stringify({ message: userMessage }),
        });
      } else {
        response = await fetchWithAuth("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ message: userMessage, saveToConversation: true }),
        });
      }
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      return response.json();
    },
    onSuccess: (data: ChatResponse) => {
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
      
      if (data.userMessage && data.assistantMessage) {
        setMessages((prev) => [
          ...prev,
          data.userMessage!,
          data.assistantMessage!,
        ]);
      } else if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            role: "assistant" as const,
            content: data.response || "",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    },
  });

  const handleSendMessage = async () => {
    if (!message.trim() || chatMutation.isPending) return;

    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: message.trim(),
      created_at: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    const currentMessage = message;
    setMessage("");
    
    try {
      await chatMutation.mutateAsync(currentMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const contextItems = [
    { key: "calendar", icon: Calendar, label: t("ai.context.calendar", "Calendar"), enabled: settings?.context_calendar },
    { key: "journal", icon: BookOpen, label: t("ai.context.journal", "Journal"), enabled: settings?.context_journal },
    { key: "meetings", icon: Video, label: t("ai.context.meetings", "Meetings"), enabled: settings?.context_meetings },
    { key: "analytics", icon: BarChart3, label: t("ai.context.analytics", "Analytics"), enabled: settings?.context_analytics },
  ];

  const quickActions = [
    { label: t("ai.quick.todaySchedule", "What's my schedule for today?"), icon: Calendar },
    { label: t("ai.quick.moodTrend", "How has my mood been this week?"), icon: BookOpen },
    { label: t("ai.quick.upcomingMeetings", "What meetings do I have coming up?"), icon: Video },
    { label: t("ai.quick.productivityTips", "Any productivity insights for me?"), icon: Sparkles },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
        data-testid="ai-sidebar"
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">
                  {t("ai.title", "Desk Mate AI")}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {t("ai.subtitle", "Your productivity assistant")}
                </SheetDescription>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                data-testid="button-new-chat"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                {t("ai.newChat", "New")}
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <div className="text-center py-6">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">
                  {t("ai.welcome.title", "How can I help you today?")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("ai.welcome.subtitle", "I have access to your calendar, journal, and meeting data.")}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  {t("ai.quickActions", "Quick Actions")}
                </p>
                <div className="space-y-1">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setMessage(action.label);
                        textareaRef.current?.focus();
                      }}
                      className="w-full flex items-center gap-3 p-3 text-left text-sm rounded-lg hover-elevate bg-muted/50 transition-colors"
                      data-testid={`button-quick-action-${index}`}
                    >
                      <action.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{action.label}</span>
                      <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  {t("ai.contextSources", "Active Context")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {contextItems.map((item) => (
                    <Badge
                      key={item.key}
                      variant={item.enabled ? "default" : "outline"}
                      className={cn(
                        "gap-1",
                        !item.enabled && "opacity-50"
                      )}
                    >
                      <item.icon className="h-3 w-3" />
                      {item.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("ai.contextHint", "Configure in Profile settings")}
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                      data-testid={`message-${msg.role}-${index}`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="flex-shrink-0 p-4 border-t bg-background">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("ai.inputPlaceholder", "Ask me anything...")}
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                disabled={chatMutation.isPending}
                data-testid="input-ai-message"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!message.trim() || chatMutation.isPending}
                data-testid="button-send-ai-message"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AITriggerButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={cn("relative", className)}
      data-testid="button-open-ai-sidebar"
    >
      <Bot className="h-4 w-4" />
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
      <span className="sr-only">{t("ai.openAssistant", "Open AI Assistant")}</span>
    </Button>
  );
}
