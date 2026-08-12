import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles } from "lucide-react";
import { BUILTIN_TEMPLATES, type PageTemplate } from "@/lib/page-templates";
import { usePages } from "@/hooks/use-pages";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: PageTemplate) => void;
}

const CATEGORIES: { value: PageTemplate["category"] | "all" | "saved"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "agile", label: "Agile" },
  { value: "planning", label: "Planning" },
  { value: "product", label: "Product" },
  { value: "ops", label: "Ops" },
  { value: "general", label: "General" },
  { value: "saved", label: "Saved" },
];

export function TemplatePickerDialog({ open, onOpenChange, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<typeof CATEGORIES[number]["value"]>("all");
  const { data: savedPages = [] } = usePages({});

  const savedTemplates = useMemo<PageTemplate[]>(() => {
    return savedPages
      .filter((p) => p.is_template)
      .map((p) => ({
        id: `saved-${p.id}`,
        label: p.title || "Untitled template",
        description: "Saved template",
        icon: p.icon ?? "📄",
        page_type: p.page_type,
        category: "general",
        content: p.content,
      }));
  }, [savedPages]);

  const filtered = useMemo(() => {
    let list = cat === "saved" ? savedTemplates : BUILTIN_TEMPLATES;
    if (cat !== "all" && cat !== "saved") list = list.filter((t) => t.category === cat);
    const query = q.trim().toLowerCase();
    if (query) list = list.filter((t) => t.label.toLowerCase().includes(query) || t.description.toLowerCase().includes(query));
    return list;
  }, [q, cat, savedTemplates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Choose a template
          </DialogTitle>
          <DialogDescription>Start from a built-in template or one of your saved templates.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="pl-9" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={cat === c.value ? "default" : "outline"}
              onClick={() => setCat(c.value)}
              className="h-7 text-xs"
            >
              {c.label}
              {c.value === "saved" && savedTemplates.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{savedTemplates.length}</Badge>
              )}
            </Button>
          ))}
        </div>

        <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
          {filtered.length === 0 ? (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">No templates match.</div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onSelect(t);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{t.icon}</span>
                  <span className="font-medium">{t.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
