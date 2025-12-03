import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { JournalEntry, JournalEntryInsert, MoodLevel } from "@/lib/supabase-types";
import {
  Frown,
  Meh,
  Smile,
  SmilePlus,
  Laugh,
  Loader2,
  Trash2,
  Plus,
  X,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Pencil,
  Calendar,
  Tag,
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
    bgColor: "bg-red-100 dark:bg-red-950/30 hover:bg-red-200 dark:hover:bg-red-900/40",
    score: 1 
  },
  bad: { 
    icon: Meh, 
    color: "text-orange-500", 
    bgColor: "bg-orange-100 dark:bg-orange-950/30 hover:bg-orange-200 dark:hover:bg-orange-900/40",
    score: 2 
  },
  neutral: { 
    icon: Smile, 
    color: "text-yellow-500", 
    bgColor: "bg-yellow-100 dark:bg-yellow-950/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/40",
    score: 3 
  },
  good: { 
    icon: SmilePlus, 
    color: "text-lime-500", 
    bgColor: "bg-lime-100 dark:bg-lime-950/30 hover:bg-lime-200 dark:hover:bg-lime-900/40",
    score: 4 
  },
  great: { 
    icon: Laugh, 
    color: "text-green-500", 
    bgColor: "bg-green-100 dark:bg-green-950/30 hover:bg-green-200 dark:hover:bg-green-900/40",
    score: 5 
  },
};

const MOOD_ORDER: MoodLevel[] = ['terrible', 'bad', 'neutral', 'good', 'great'];

type DialogMode = 'view' | 'edit' | 'create';

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: JournalEntry | null;
  userId: string;
  onEntrySaved: () => void;
}

export function JournalEntryDialog({
  open,
  onOpenChange,
  entry,
  userId,
  onEntrySaved,
}: JournalEntryDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [mode, setMode] = useState<DialogMode>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [entryText, setEntryText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);

  const prompts = useMemo(() => {
    const translatedPrompts = t('journal.prompts', { returnObjects: true });
    return Array.isArray(translatedPrompts) ? translatedPrompts : [];
  }, [t]);

  const currentPrompt = prompts[promptIndex] || "";

  useEffect(() => {
    if (open) {
      if (entry) {
        setMode('view');
        setSelectedMood(entry.mood);
        setEntryText(entry.entry_text || "");
        setTags(entry.tags || []);
      } else {
        setMode('create');
        setSelectedMood(null);
        setEntryText("");
        setTags([]);
        setTagInput("");
        if (prompts.length > 0) {
          setPromptIndex(Math.floor(Math.random() * prompts.length));
        }
      }
    }
  }, [open, entry, prompts.length]);

  const refreshPrompt = () => {
    setPromptIndex((prev) => (prev + 1) % prompts.length);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!selectedMood) return;

    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const moodScore = MOOD_CONFIG[selectedMood].score;

      if (mode === 'edit' && entry) {
        const { error } = await supabase
          .from('journal_entries')
          .update({
            mood: selectedMood,
            mood_score: moodScore,
            entry_text: entryText || null,
            tags: tags.length > 0 ? tags : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        if (error) throw error;

        toast({
          title: t('journal.entryUpdated'),
          description: t('journal.entryUpdatedDescription'),
        });
      } else {
        const newEntry: JournalEntryInsert = {
          user_id: userId,
          date: today,
          mood: selectedMood,
          mood_score: moodScore,
          entry_text: entryText || null,
          tags: tags.length > 0 ? tags : null,
          is_private: true,
        };

        const { error } = await supabase
          .from('journal_entries')
          .insert(newEntry);

        if (error) throw error;

        toast({
          title: t('journal.entrySaved'),
          description: t('journal.entrySavedDescription'),
        });
      }

      onEntrySaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving journal entry:', error);
      toast({
        title: t('journal.failedToSave'),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      toast({
        title: t('journal.entryDeleted'),
        description: t('journal.entryDeletedDescription'),
      });

      onEntrySaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: t('journal.failedToDelete'),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEdit = () => {
    setMode('edit');
  };

  const handleCancel = () => {
    if (mode === 'edit' && entry) {
      setMode('view');
      setSelectedMood(entry.mood);
      setEntryText(entry.entry_text || "");
      setTags(entry.tags || []);
    } else {
      onOpenChange(false);
    }
  };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit' || mode === 'create';
  const moodConfig = selectedMood ? MOOD_CONFIG[selectedMood] : null;
  const MoodIcon = moodConfig?.icon;

  const dialogTitle = mode === 'create' 
    ? t('journal.newEntry') 
    : mode === 'edit' 
      ? t('journal.editEntry') 
      : t('journal.viewEntry');

  const dialogDescription = mode === 'create'
    ? format(new Date(), 'EEEE, MMMM d, yyyy')
    : entry?.date 
      ? format(new Date(entry.date), 'EEEE, MMMM d, yyyy')
      : '';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <DialogTitle data-testid="dialog-title">{dialogTitle}</DialogTitle>
            </div>
            <DialogDescription data-testid="dialog-date">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {isViewMode ? (
              <>
                {moodConfig && MoodIcon && (
                  <div className="flex items-center gap-3">
                    <div className={cn("p-3 rounded-full", moodConfig.bgColor.split(' ')[0])}>
                      <MoodIcon className={cn("h-8 w-8", moodConfig.color)} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('journal.mood.label')}</p>
                      <p className="font-medium text-lg">{t(`journal.mood.${selectedMood}`)}</p>
                    </div>
                  </div>
                )}

                {entryText && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{t('journal.entryText')}</p>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="whitespace-pre-wrap text-foreground/90" data-testid="view-entry-text">
                        {entryText}
                      </p>
                    </div>
                  </div>
                )}

                {tags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{t('journal.tags')}</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" data-testid={`view-tag-${tag}`}>
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {!entryText && tags.length === 0 && (
                  <p className="text-muted-foreground italic text-center py-4">
                    {t('journal.noEntryContent')}
                  </p>
                )}
              </>
            ) : (
              <>
                <div>
                  <Label className="text-sm font-medium mb-3 block">
                    {t('journal.howAreYouFeeling')}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_ORDER.map((mood) => {
                      const config = MOOD_CONFIG[mood];
                      const Icon = config.icon;
                      const isSelected = selectedMood === mood;
                      
                      return (
                        <button
                          key={mood}
                          type="button"
                          onClick={() => setSelectedMood(mood)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg transition-all",
                            config.bgColor,
                            isSelected && "ring-2 ring-primary ring-offset-2"
                          )}
                          data-testid={`button-mood-${mood}`}
                        >
                          <Icon className={cn("h-8 w-8", config.color)} />
                          <span className="text-xs font-medium">
                            {t(`journal.mood.${mood}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mode === 'create' && currentPrompt && (
                  <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Lightbulb className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-primary">
                              {t('journal.getInspired')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={refreshPrompt}
                              className="h-6 px-2 text-xs"
                              data-testid="button-refresh-prompt"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              {t('journal.refreshPrompt')}
                            </Button>
                          </div>
                          <p className="text-sm text-foreground/80 italic" data-testid="text-prompt">
                            "{currentPrompt}"
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <Textarea
                    value={entryText}
                    onChange={(e) => setEntryText(e.target.value)}
                    placeholder={t('journal.writeHere')}
                    className="min-h-[150px] resize-none"
                    data-testid="textarea-entry"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    <Tag className="h-4 w-4 inline mr-1" />
                    {t('journal.addTags')}
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex items-center gap-1"
                        data-testid={`badge-tag-${tag}`}
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`button-remove-tag-${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder={t('journal.tagsPlaceholder')}
                      className="flex-1"
                      data-testid="input-tag"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      type="button"
                      onClick={() => {
                        if (tagInput.trim()) {
                          const newTag = tagInput.trim().toLowerCase();
                          if (!tags.includes(newTag)) {
                            setTags([...tags, newTag]);
                          }
                          setTagInput("");
                        }
                      }}
                      disabled={!tagInput.trim()}
                      data-testid="button-add-tag"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            {isViewMode ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  data-testid="button-delete-entry"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('common.delete')}
                </Button>
                <Button
                  onClick={handleEdit}
                  data-testid="button-edit-entry"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('common.edit')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                  data-testid="button-cancel"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!selectedMood || isLoading}
                  data-testid="button-save-entry"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {mode === 'edit' ? t('journal.updateEntry') : t('journal.saveEntry')}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('journal.deleteEntry')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('journal.deleteConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
