-- Run this full file in the Supabase SQL Editor after every ReadRoot schema update.
-- Running only one section can leave profile, sync, or group features missing.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  username text unique,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_logs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  openlibrary_key text,
  book_title text not null,
  book_author text,
  pages integer not null check (pages > 0),
  minutes integer not null default 0 check (minutes >= 0),
  read_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.reading_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.profiles alter column visibility set default 'private';

alter table public.profiles enable row level security;
alter table public.reading_logs enable row level security;
alter table public.reading_snapshots enable row level security;
alter table public.reading_groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Public logs are readable through leaderboard" on public.reading_logs;
drop policy if exists "Users can read own logs" on public.reading_logs;
drop policy if exists "Users can insert own logs" on public.reading_logs;
drop policy if exists "Users can update own logs" on public.reading_logs;
drop policy if exists "Users can read own snapshot" on public.reading_snapshots;
drop policy if exists "Users can insert own snapshot" on public.reading_snapshots;
drop policy if exists "Users can update own snapshot" on public.reading_snapshots;
drop policy if exists "Members can read their groups" on public.reading_groups;
drop policy if exists "Users can insert owned groups" on public.reading_groups;
drop policy if exists "Owners can update groups" on public.reading_groups;
drop policy if exists "Users can read own memberships" on public.group_members;
drop policy if exists "Users can join groups" on public.group_members;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own logs"
  on public.reading_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on public.reading_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own logs"
  on public.reading_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own snapshot"
  on public.reading_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own snapshot"
  on public.reading_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own snapshot"
  on public.reading_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Members can read their groups"
  on public.reading_groups for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.group_members
      where group_members.group_id = reading_groups.id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Users can insert owned groups"
  on public.reading_groups for insert
  with check (owner_id = auth.uid());

create policy "Owners can update groups"
  on public.reading_groups for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users can read own memberships"
  on public.group_members for select
  using (user_id = auth.uid());

create index if not exists reading_logs_user_id_idx on public.reading_logs (user_id);
create index if not exists reading_logs_read_at_idx on public.reading_logs (read_at desc);
create index if not exists reading_logs_user_read_at_idx on public.reading_logs (user_id, read_at desc);
create index if not exists reading_groups_invite_code_idx on public.reading_groups (invite_code);
create index if not exists group_members_user_id_idx on public.group_members (user_id);
create index if not exists group_members_group_id_idx on public.group_members (group_id);

create or replace function public.leaderboard(period text default 'week')
returns table (
  user_id uuid,
  display_name text,
  username text,
  total_pages bigint,
  total_minutes bigint,
  sessions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    logs.user_id,
    coalesce(nullif(profiles.display_name, ''), split_part(profiles.username, '@', 1), 'Reader') as display_name,
    profiles.username,
    sum(logs.pages)::bigint as total_pages,
    sum(logs.minutes)::bigint as total_minutes,
    count(*)::bigint as sessions
  from public.reading_logs logs
  join public.profiles profiles on profiles.id = logs.user_id
  where profiles.visibility = 'public'
    and (
      period = 'all'
      or (period = 'week' and logs.read_at >= date_trunc('week', now()))
      or (period = 'month' and logs.read_at >= date_trunc('month', now()))
    )
  group by logs.user_id, profiles.display_name, profiles.username
  order by total_pages desc, sessions asc
  limit 20;
$$;

create or replace function public.create_reading_group(group_name text)
returns public.reading_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  created_group public.reading_groups;
  generated_code text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if length(trim(group_name)) < 2 then
    raise exception 'Group name is too short';
  end if;

  loop
    generated_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    begin
      insert into public.reading_groups (owner_id, name, invite_code)
      values (auth.uid(), trim(group_name), generated_code)
      returning * into created_group;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.group_members (group_id, user_id, role)
  values (created_group.id, auth.uid(), 'owner')
  on conflict (group_id, user_id) do nothing;

  return created_group;
end;
$$;

create or replace function public.join_reading_group(code text)
returns public.reading_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  found_group public.reading_groups;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select *
  into found_group
  from public.reading_groups
  where invite_code = upper(trim(code));

  if found_group.id is null then
    raise exception 'Group not found';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (found_group.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return found_group;
end;
$$;

create or replace function public.my_reading_groups()
returns table (
  id uuid,
  name text,
  invite_code text,
  role text,
  member_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    groups.id,
    groups.name,
    groups.invite_code,
    memberships.role,
    (
      select count(*)
      from public.group_members all_members
      where all_members.group_id = groups.id
    )::bigint as member_count,
    groups.created_at
  from public.group_members memberships
  join public.reading_groups groups on groups.id = memberships.group_id
  where memberships.user_id = auth.uid()
  order by groups.created_at desc;
$$;

create or replace function public.group_leaderboard(group_id_input uuid, period text default 'week')
returns table (
  user_id uuid,
  display_name text,
  username text,
  total_pages bigint,
  total_minutes bigint,
  sessions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    members.user_id,
    coalesce(nullif(profiles.display_name, ''), profiles.username, 'Reader') as display_name,
    profiles.username,
    coalesce(sum(logs.pages), 0)::bigint as total_pages,
    coalesce(sum(logs.minutes), 0)::bigint as total_minutes,
    count(logs.id)::bigint as sessions
  from public.group_members requester
  join public.group_members members
    on members.group_id = requester.group_id
  join public.profiles profiles
    on profiles.id = members.user_id
  left join public.reading_logs logs
    on logs.user_id = members.user_id
    and (
      period = 'all'
      or (period = 'week' and logs.read_at >= date_trunc('week', now()))
      or (period = 'month' and logs.read_at >= date_trunc('month', now()))
    )
  where requester.group_id = group_id_input
    and requester.user_id = auth.uid()
  group by members.user_id, profiles.display_name, profiles.username
  order by total_pages desc, sessions asc, display_name asc
  limit 50;
$$;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.reading_logs to authenticated;
grant select, insert, update on public.reading_snapshots to authenticated;
grant select on public.reading_groups to authenticated;
grant select on public.group_members to authenticated;

grant execute on function public.leaderboard(text) to authenticated;
grant execute on function public.create_reading_group(text) to authenticated;
grant execute on function public.join_reading_group(text) to authenticated;
grant execute on function public.my_reading_groups() to authenticated;
grant execute on function public.group_leaderboard(uuid, text) to authenticated;

notify pgrst, 'reload schema';
