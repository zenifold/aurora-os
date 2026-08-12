
-- 1) Block-level AI attribution
create table if not exists public.page_block_attributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  page_id uuid not null references public.pages(id) on delete cascade,
  block_id text not null,
  source text not null default 'ai' check (source in ('ai','human','agent')),
  agent_name text,
  agent_id uuid,
  model text,
  prompt text,
  reasoning text,
  status text not null default 'draft' check (status in ('draft','review','published','reverted')),
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, block_id)
);
create index if not exists idx_page_block_attr_page on public.page_block_attributions(page_id, status);
create index if not exists idx_page_block_attr_ws on public.page_block_attributions(workspace_id);
alter table public.page_block_attributions enable row level security;
create policy "pba_select_members" on public.page_block_attributions for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "pba_insert_members" on public.page_block_attributions for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy "pba_update_members" on public.page_block_attributions for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id))
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy "pba_delete_members" on public.page_block_attributions for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create trigger pba_touch before update on public.page_block_attributions
  for each row execute function public.touch_updated_at();

-- 2) Portal publish flag on pages
alter table public.pages
  add column if not exists is_portal_published boolean not null default false,
  add column if not exists portal_published_at timestamptz,
  add column if not exists portal_published_by uuid;
create index if not exists idx_pages_portal_published on public.pages(scope_id) where is_portal_published = true;

-- 3) Page graph metadata on page_links
alter table public.page_links
  add column if not exists link_type text not null default 'wiki' check (link_type in ('wiki','binding','embed','mention','task')),
  add column if not exists target_project_id uuid,
  add column if not exists source_block_id text;
create index if not exists idx_page_links_target_project on public.page_links(target_project_id);
create index if not exists idx_page_links_link_type on public.page_links(source_page_id, link_type);
