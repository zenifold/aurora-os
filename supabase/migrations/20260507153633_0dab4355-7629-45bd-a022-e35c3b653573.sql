
-- 1) Auto-create notifications when channel messages mention users
create or replace function public.notify_channel_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned_id uuid;
  ch record;
  link_target text;
begin
  if new.mentions is null or array_length(new.mentions, 1) is null then
    return new;
  end if;

  select id, name, scope, scope_id, workspace_id into ch
    from public.channels where id = new.channel_id;
  if ch.id is null then return new; end if;

  if ch.scope = 'project' and ch.scope_id is not null then
    link_target := '/app/p/' || ch.scope_id::text || '/chat';
  else
    link_target := '/app/chat?c=' || ch.id::text;
  end if;

  foreach mentioned_id in array new.mentions loop
    if mentioned_id is null or mentioned_id = new.author_id then continue; end if;
    insert into public.notifications
      (workspace_id, recipient_id, actor_id, type, title, body, link, project_id)
    values (
      new.workspace_id,
      mentioned_id,
      new.author_id,
      'mention',
      'You were mentioned in #' || coalesce(ch.name, 'channel'),
      left(coalesce(new.body_md, ''), 200),
      link_target,
      case when ch.scope = 'project' then ch.scope_id else null end
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_channel_mentions on public.channel_messages;
create trigger trg_notify_channel_mentions
after insert on public.channel_messages
for each row execute function public.notify_channel_mentions();

-- 2) Auto-add members for workspace-scope channels (so unread counts work for everyone)
create or replace function public.backfill_workspace_channel_members(_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.channels where id = _channel_id;
  if ws is null then return; end if;
  insert into public.channel_members (channel_id, workspace_id, user_id)
  select _channel_id, ws, wm.user_id
    from public.workspace_members wm
   where wm.workspace_id = ws
  on conflict do nothing;
end;
$$;

create or replace function public.add_workspace_channel_members_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scope = 'workspace' and new.is_private = false then
    perform public.backfill_workspace_channel_members(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_add_ws_channel_members on public.channels;
create trigger trg_add_ws_channel_members
after insert on public.channels
for each row execute function public.add_workspace_channel_members_trigger();

-- Backfill existing
do $$
declare c record;
begin
  for c in select id from public.channels where scope = 'workspace' and is_private = false loop
    perform public.backfill_workspace_channel_members(c.id);
  end loop;
end $$;

-- 3) When a new workspace member joins, add them to all workspace public channels
create or replace function public.add_member_to_workspace_channels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.channel_members (channel_id, workspace_id, user_id)
  select c.id, c.workspace_id, new.user_id
    from public.channels c
   where c.workspace_id = new.workspace_id
     and c.scope = 'workspace'
     and c.is_private = false
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_add_member_ws_channels on public.workspace_members;
create trigger trg_add_member_ws_channels
after insert on public.workspace_members
for each row execute function public.add_member_to_workspace_channels();

-- 4) When a project channel is created, add all current project members
create or replace function public.add_project_members_to_channel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scope = 'project' and new.scope_id is not null and new.is_private = false then
    insert into public.channel_members (channel_id, workspace_id, user_id)
    select new.id, new.workspace_id, pm.user_id
      from public.project_members pm
     where pm.project_id = new.scope_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_add_project_members_to_channel on public.channels;
create trigger trg_add_project_members_to_channel
after insert on public.channels
for each row execute function public.add_project_members_to_channel();

-- 5) Mark channel as read RPC
create or replace function public.mark_channel_read(_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.channels where id = _channel_id;
  if ws is null then return; end if;
  insert into public.channel_members (channel_id, workspace_id, user_id, last_read_at)
  values (_channel_id, ws, auth.uid(), now())
  on conflict (channel_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

-- 6) Unread counts RPC
create or replace function public.channel_unread_counts(_workspace_id uuid)
returns table(channel_id uuid, unread_count integer, has_mention boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    cm.channel_id,
    (
      select count(*)::int from public.channel_messages msg
       where msg.channel_id = cm.channel_id
         and msg.author_id <> auth.uid()
         and msg.deleted_at is null
         and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
    ) as unread_count,
    exists(
      select 1 from public.channel_messages msg
       where msg.channel_id = cm.channel_id
         and msg.author_id <> auth.uid()
         and msg.deleted_at is null
         and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
         and auth.uid() = ANY(msg.mentions)
    ) as has_mention
  from public.channel_members cm
  where cm.user_id = auth.uid()
    and cm.workspace_id = _workspace_id;
$$;
