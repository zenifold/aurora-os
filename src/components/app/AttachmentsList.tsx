import { useRef } from "react";
import {
  type AttachmentEntityType,
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  getAttachmentUrl,
} from "@/hooks/use-attachments";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface Props {
  entityType: AttachmentEntityType;
  entityId: string | undefined;
  /** Hide the heading row when used inline (e.g. in a comments thread) */
  compact?: boolean;
  className?: string;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsList({ entityType, entityId, compact, className }: Props) {
  const { data: attachments = [], isLoading } = useAttachments(entityType, entityId);
  const upload = useUploadAttachment();
  const remove = useDeleteAttachment();
  const fileInput = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && entityId) {
      upload.mutate({ entity_type: entityType, entity_id: entityId, file });
    }
    e.target.value = "";
  };

  const onDownload = async (path: string, name: string) => {
    try {
      const url = await getAttachmentUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = name;
      a.click();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!entityId) return null;

  return (
    <div className={className}>
      {!compact && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Paperclip className="h-4 w-4" />
            Attachments
            {attachments.length > 0 && (
              <span className="text-xs text-muted-foreground">({attachments.length})</span>
            )}
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={onPick}
      />

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : attachments.length === 0 ? (
        compact ? null : (
          <p className="text-xs text-muted-foreground">No attachments yet.</p>
        )
      ) : (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatBytes(a.file_size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onDownload(a.storage_path, a.file_name)}
                aria-label="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={() => remove.mutate(a)}
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {compact && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-7 px-2 text-xs"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Paperclip className="mr-1 h-3 w-3" />
          )}
          Attach file
        </Button>
      )}
    </div>
  );
}
