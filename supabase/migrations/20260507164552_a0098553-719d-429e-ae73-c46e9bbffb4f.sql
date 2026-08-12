
create table if not exists public.workspace_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  scope_type text not null default 'workspace' check (scope_type in ('workspace','division','folder','project','page')),
  scope_target_id uuid,
  messages jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wsai_conv_user on public.workspace_ai_conversations(user_id, workspace_id, updated_at desc);

alter table public.workspace_ai_conversations enable row level security;

create policy "Owner can read own conversations"
  on public.workspace_ai_conversations for select
  using (auth.uid() = user_id and public.is_workspace_member(auth.uid(), workspace_id));

create policy "Owner can insert own conversations"
  on public.workspace_ai_conversations for insert
  with check (auth.uid() = user_id and public.is_workspace_member(auth.uid(), workspace_id));

create policy "Owner can update own conversations"
  on public.workspace_ai_conversations for update
  using (auth.uid() = user_id);

create policy "Owner can delete own conversations"
  on public.workspace_ai_conversations for delete
  using (auth.uid() = user_id);

create trigger trg_wsai_conv_updated
before update on public.workspace_ai_conversations
for each row execute function public.touch_updated_at();
