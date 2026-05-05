import { supabase } from "@/integrations/supabase/client";
import type { WorkspacePreset, PresetFolderSpec } from "./workspace-presets";

interface SeedResult {
  divisionsCreated: number;
  foldersCreated: number;
}

/**
 * Apply a preset to a workspace by upserting divisions and inserting folders.
 * Safe to run on an existing workspace — divisions match by (workspace_id, slug)
 * via UNIQUE constraint and skip on conflict; folders are skipped if a folder
 * with the same name already exists at the same level.
 */
export async function applyPresetToWorkspace(
  workspaceId: string,
  userId: string,
  preset: WorkspacePreset,
): Promise<SeedResult> {
  let divisionsCreated = 0;
  let foldersCreated = 0;

  if (!preset.divisions.length) return { divisionsCreated, foldersCreated };

  // Fetch existing divisions to map slug -> id
  const { data: existingDivs } = await supabase
    .from("divisions")
    .select("id, slug")
    .eq("workspace_id", workspaceId);
  const slugToId = new Map<string, string>(
    (existingDivs ?? []).map((d) => [d.slug, d.id]),
  );

  // Fetch sort_order baseline
  let nextSort = (existingDivs?.length ?? 0);

  for (const divSpec of preset.divisions) {
    let divisionId = slugToId.get(divSpec.slug);
    if (!divisionId) {
      const { data: created, error } = await supabase
        .from("divisions")
        .insert({
          workspace_id: workspaceId,
          name: divSpec.name,
          slug: divSpec.slug,
          icon: divSpec.icon,
          color: divSpec.color,
          division_type: divSpec.division_type,
          sort_order: nextSort++,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error || !created) {
        // Conflict (race): refetch
        const { data: refetched } = await supabase
          .from("divisions")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("slug", divSpec.slug)
          .maybeSingle();
        if (!refetched) continue;
        divisionId = refetched.id;
      } else {
        divisionId = created.id;
        divisionsCreated++;
      }
      slugToId.set(divSpec.slug, divisionId!);
    }

    // Existing folders in this division to dedupe by name+parent
    const { data: existingFolders } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("workspace_id", workspaceId)
      .eq("division_id", divisionId!);
    const folderKey = (name: string, parent: string | null) =>
      `${parent ?? "root"}::${name.toLowerCase()}`;
    const folderMap = new Map<string, string>(
      (existingFolders ?? []).map((f) => [folderKey(f.name, f.parent_id), f.id]),
    );

    const seedFolders = async (
      specs: PresetFolderSpec[] | undefined,
      parentId: string | null,
    ) => {
      if (!specs?.length) return;
      let order = 0;
      for (const spec of specs) {
        const key = folderKey(spec.name, parentId);
        let folderId = folderMap.get(key);
        if (!folderId) {
          const { data: f, error } = await supabase
            .from("folders")
            .insert({
              workspace_id: workspaceId,
              division_id: divisionId!,
              parent_id: parentId,
              name: spec.name,
              folder_type: spec.folder_type ?? "generic",
              color: spec.color ?? null,
              description: spec.description ?? null,
              sort_order: order++,
              created_by: userId,
            })
            .select("id")
            .single();
          if (!error && f) {
            folderId = f.id;
            folderMap.set(key, folderId);
            foldersCreated++;
          }
        }
        if (folderId && spec.children?.length) {
          await seedFolders(spec.children, folderId);
        }
      }
    };

    await seedFolders(divSpec.folders, null);
  }

  return { divisionsCreated, foldersCreated };
}
