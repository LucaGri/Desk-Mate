import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, X, FileText, Image, File, Upload, Loader2 } from "lucide-react";
import type { EventAttachment, EventAttachmentInsert } from "@/lib/supabase-types";

const STORAGE_BUCKET = "event-attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface AttachmentUploadProps {
  eventId: string;
  attachments: EventAttachment[];
  onAttachmentsChange: (attachments: EventAttachment[]) => void;
  disabled?: boolean;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) return FileText;
  return File;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentUpload({ 
  eventId, 
  attachments, 
  onAttachmentsChange,
  disabled = false 
}: AttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        if (uploadError.message.includes("bucket") || uploadError.message.includes("not found")) {
          throw new Error("Storage bucket not configured. Please contact support.");
        }
        throw uploadError;
      }

      const attachmentData: EventAttachmentInsert = {
        event_id: eventId,
        file_name: file.name,
        storage_path: fileName,
        storage_bucket: STORAGE_BUCKET,
        file_size_bytes: file.size,
        mime_type: file.type || null,
      };

      const { data: newAttachment, error: insertError } = await supabase
        .from("event_attachments")
        .insert(attachmentData)
        .select()
        .single();

      if (insertError) throw insertError;

      onAttachmentsChange([...attachments, newAttachment]);
      
      toast({
        title: "File uploaded",
        description: `${file.name} has been attached to this event.`,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [eventId, attachments, onAttachmentsChange, toast]);

  const handleDelete = useCallback(async (attachment: EventAttachment) => {
    try {
      const { error: storageError } = await supabase.storage
        .from(attachment.storage_bucket)
        .remove([attachment.storage_path]);

      if (storageError) {
        console.warn("Storage deletion warning:", storageError);
      }

      const { error: dbError } = await supabase
        .from("event_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      onAttachmentsChange(attachments.filter(a => a.id !== attachment.id));
      
      toast({
        title: "Attachment removed",
        description: `${attachment.file_name} has been deleted.`,
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete attachment",
        variant: "destructive",
      });
    }
  }, [attachments, onAttachmentsChange, toast]);

  const handleDownload = useCallback(async (attachment: EventAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from(attachment.storage_bucket)
        .download(attachment.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Attachments</span>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const IconComponent = getFileIcon(attachment.mime_type);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group"
              >
                <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => handleDownload(attachment)}
                  className="flex-1 text-left text-sm truncate hover:underline"
                  data-testid={`attachment-download-${attachment.id}`}
                >
                  {attachment.file_name}
                </button>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatFileSize(attachment.file_size_bytes)}
                </span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(attachment)}
                    data-testid={`button-delete-attachment-${attachment.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
            data-testid="input-attachment-file"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-add-attachment"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadProgress || "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Add attachment
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Max file size: 10MB
          </p>
        </div>
      )}

      {attachments.length === 0 && disabled && (
        <p className="text-sm text-muted-foreground">No attachments</p>
      )}
    </div>
  );
}
