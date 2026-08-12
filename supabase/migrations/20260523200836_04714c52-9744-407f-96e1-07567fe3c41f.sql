do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_primary_role') then
    create type public.user_primary_role as enum (
      'partner', 'sales', 'account_manager', 'pm', 'delivery', 'client_user'
    );
  end if;
end $$;

alter table public.profiles
  add column if not exists primary_role public.user_primary_role not null default 'delivery',
  add column if not exists default_landing text;