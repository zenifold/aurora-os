import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePages, useCreatePage, useUpdatePage, useDeletePage } from "@/hooks/use-pages";
import { PAGE_TYPES, type PageType } from "@/lib/page-types";
import { type PageTemplate } from "@/lib/page-templates";
import { PageEditor } from "@/components/pages/PageEditor";
import { PageTreeSidebar } from "@/components/pages/PageTreeSidebar";
import { TemplatePickerDialog } from "@/components/pages/TemplatePickerDialog";
import { useProject } from "@/hooks/use-projects";

export const Route = createFileRoute("/app/p/$projectId/pages")({
  component: ProjectPagesPage,
});

function ProjectPagesPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: pages = [] } = usePages({ scope: "project", scopeId: projectId, archived: false });
  const create = useCreatePage();
  const update = useUpdatePage();
  const del = useDeletePage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplParent, setTplParent] = useState<string | null>(null);

  // Project Overview now lives at /app/p/$projectId/overview as an AI-maintained,
  // versioned snapshot. Pages here are user-authored docs only — no auto-journal.

  const docPages = pages.filter((p) => p.page_type !== "folder");
  const selected = docPages.find((p) => p.id === selectedId) ?? docPages[0] ?? null;

  const newBlankPage = async (page_type: PageType, parent_page_id: string | null = null) => {
    const meta = PAGE_TYPES.find((t) => t.value === page_type);
    const p = await create.mutateAsync({
      scope: "project",
      scope_id: projectId,
      page_type,
      icon: meta?.icon,
      title: meta?.label ?? "Untitled",
      parent_page_id,
    });
    setSelectedId(p.id);
  };

  const newFromTemplate = async (tpl: PageTemplate) => {
    const p = await create.mutateAsync({
      scope: "project",
      scope_id: projectId,
      page_type: tpl.page_type,
      icon: tpl.icon,
      title: tpl.label,
      content: tpl.content,
      parent_page_id: tplParent,
    });
    setSelectedId(p.id);
    setTplParent(null);
  };

  const openTemplatePicker = (parentId: string | null = null) => {
    setTplParent(parentId);
    setTplOpen(true);
  };

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 flex-col border-r border-border lg:flex">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <h2 className="flex-1 text-sm font-semibold">Project pages</h2>
          <Button size="icon" variant="ghost" aria-label="Templates" title="Templates" onClick={() => openTemplatePicker(null)}>
            <Sparkles className="h-4 w-4 text-primary" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="New page"><Plus className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => openTemplatePicker(null)}>
                <Sparkles className="mr-2 h-4 w-4 text-primary" /> From template…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Blank page</DropdownMenuLabel>
              {PAGE_TYPES.map((t) => (
                <DropdownMenuItem key={t.value} onClick={() => newBlankPage(t.value)}>
                  <span className="mr-2">{t.icon}</span> {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <PageTreeSidebar
          pages={pages}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onAddSubpage={(parentId) => openTemplatePicker(parentId)}
          onDelete={(id) => {
            del.mutate(id);
            if (selectedId === id) setSelectedId(null);
          }}
          onTogglePin={(p) => update.mutate({ id: p.id, is_pinned: !p.is_pinned })}
          onArchive={(p) => update.mutate({ id: p.id, is_archived: !p.is_archived })}
          onMove={(id, newParent) => update.mutate({ id, parent_page_id: newParent })}
        />
      </aside>

      <main className="min-w-0 flex-1">
        {selected ? (
          <PageEditor page={selected} onClose={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No pages yet for this project.</p>
            <Button size="sm" onClick={() => openTemplatePicker(null)}>
              <Sparkles className="mr-2 h-4 w-4" /> Choose a template
            </Button>
          </div>
        )}
      </main>

      <TemplatePickerDialog open={tplOpen} onOpenChange={setTplOpen} onSelect={newFromTemplate} />
    </div>
  );
}
