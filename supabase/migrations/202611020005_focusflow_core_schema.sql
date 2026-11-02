-- FocusFlow normalized workspace, session, analytics, and sync schema.
-- All application timestamps are UTC timestamptz values.

create or replace function public.set_audit_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := auth.uid();

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, clock_timestamp());
    new.updated_at := new.created_at;
    if tg_table_name = 'profiles' then
      new.created_by := coalesce(actor_id, new.id);
      new.updated_by := coalesce(actor_id, new.id);
    else
      new.created_by := coalesce(actor_id, new.created_by, new.user_id);
      new.updated_by := coalesce(actor_id, new.updated_by, new.user_id);
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := clock_timestamp();
    new.updated_by := coalesce(actor_id, old.updated_by, old.created_by);
  end if;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint sheets_id_user_id_key unique (id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  sheet_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text,
  estimated_minutes integer not null default 25
    check (estimated_minutes between 1 and 10080),
  actual_minutes numeric(10, 2) not null default 0
    check (actual_minutes >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'skipped', 'archived')),
  position integer not null default 0 check (position >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint tasks_sheet_user_fk
    foreign key (sheet_id, user_id)
    references public.sheets (id, user_id)
    on delete cascade,
  constraint tasks_id_sheet_user_key unique (id, sheet_id, user_id)
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  sheet_id uuid references public.sheets (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_seconds integer not null check (planned_seconds > 0),
  actual_seconds integer not null default 0 check (actual_seconds >= 0),
  status text not null default 'running'
    check (status in ('running', 'completed', 'stopped', 'incomplete')),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint focus_sessions_end_after_start
    check (ended_at is null or ended_at >= started_at),
  constraint focus_sessions_task_sheet_pair
    check (task_id is null or sheet_id is not null),
  constraint focus_sessions_status_end_pair
    check (
      (status = 'running' and ended_at is null)
      or (status <> 'running' and ended_at is not null)
    )
);

create table if not exists public.break_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  label text not null default 'Break'
    check (char_length(btrim(label)) between 1 and 120),
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_seconds integer not null check (planned_seconds > 0),
  actual_seconds integer not null default 0 check (actual_seconds >= 0),
  status text not null default 'running'
    check (status in ('running', 'completed', 'stopped')),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint break_sessions_end_after_start
    check (ended_at is null or ended_at >= started_at),
  constraint break_sessions_status_end_pair
    check (
      (status = 'running' and ended_at is null)
      or (status <> 'running' and ended_at is not null)
    )
);

create table if not exists public.statistics (
  user_id uuid not null references auth.users (id) on delete cascade,
  stat_date date not null,
  focus_seconds bigint not null default 0 check (focus_seconds >= 0),
  break_seconds bigint not null default 0 check (break_seconds >= 0),
  completed_tasks integer not null default 0 check (completed_tasks >= 0),
  focus_session_count integer not null default 0 check (focus_session_count >= 0),
  average_focus_session_seconds numeric(12, 2) not null default 0
    check (average_focus_session_seconds >= 0),
  estimation_accuracy numeric(12, 4)
    check (estimation_accuracy is null or estimation_accuracy >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  primary key (user_id, stat_date)
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  idempotency_key uuid not null default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('sheet', 'task', 'focus_session', 'break_session')),
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'delete')),
  payload jsonb not null default '{}'::jsonb,
  base_updated_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'conflict', 'failed', 'applied')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint sync_queue_user_idempotency_key unique (user_id, idempotency_key)
);

create index if not exists sheets_user_position_idx
  on public.sheets (user_id, position, created_at)
  where deleted_at is null;

create index if not exists tasks_sheet_status_position_idx
  on public.tasks (sheet_id, status, position)
  where deleted_at is null;

create index if not exists tasks_sheet_position_idx
  on public.tasks (sheet_id, user_id, position, created_at)
  where deleted_at is null;

create index if not exists tasks_user_completed_at_idx
  on public.tasks (user_id, completed_at desc)
  where deleted_at is null and status = 'completed';

create index if not exists focus_sessions_user_started_at_idx
  on public.focus_sessions (user_id, started_at desc)
  where deleted_at is null;

create index if not exists focus_sessions_task_started_at_idx
  on public.focus_sessions (task_id, started_at desc)
  where deleted_at is null and task_id is not null;

create index if not exists focus_sessions_sheet_started_at_idx
  on public.focus_sessions (sheet_id, started_at desc)
  where deleted_at is null and sheet_id is not null;

create unique index if not exists focus_sessions_one_running_per_user_idx
  on public.focus_sessions (user_id)
  where deleted_at is null and status = 'running';

create index if not exists break_sessions_user_started_at_idx
  on public.break_sessions (user_id, started_at desc)
  where deleted_at is null;

create index if not exists sync_queue_user_status_created_at_idx
  on public.sync_queue (user_id, status, created_at)
  where deleted_at is null;

create index if not exists sync_queue_pending_entity_idx
  on public.sync_queue (user_id, entity_type, entity_id)
  where deleted_at is null and status in ('pending', 'conflict', 'failed');

create or replace function public.set_task_completion_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' then
      new.completed_at := coalesce(new.completed_at, clock_timestamp());
    elsif old.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, old.completed_at, clock_timestamp());
    else
      new.completed_at := coalesce(new.completed_at, clock_timestamp());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.validate_focus_session_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.task_id is null then
    if new.sheet_id is not null and not exists (
      select 1
        from public.sheets as sheet
        where sheet.id = new.sheet_id
          and sheet.user_id = new.user_id
    ) then
      raise exception 'The focus session sheet must belong to its user.';
    end if;
    return new;
  end if;

  if not exists (
    select 1
      from public.tasks as task
      where task.id = new.task_id
        and task.sheet_id = new.sheet_id
        and task.user_id = new.user_id
  ) then
    raise exception 'The focus session task and sheet must belong to its user.';
  end if;
  return new;
end;
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
    values (
      new.id,
      left(coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(new.email, '@', 1)
      ), 120),
      new.raw_user_meta_data ->> 'avatar_url'
    )
    on conflict (id) do update
      set display_name = coalesce(
            excluded.display_name,
            public.profiles.display_name
          ),
          avatar_url = coalesce(
            excluded.avatar_url,
            public.profiles.avatar_url
          );
  return new;
end;
$$;

drop trigger if exists auth_user_create_profile on auth.users;
create trigger auth_user_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'profiles',
    'sheets',
    'tasks',
    'focus_sessions',
    'break_sessions',
    'statistics',
    'sync_queue'
  ]
  loop
    execute format(
      'drop trigger if exists set_audit_columns on public.%I',
      relation_name
    );
    execute format(
      'create trigger set_audit_columns before insert or update on public.%I for each row execute function public.set_audit_columns()',
      relation_name
    );
  end loop;
end;
$$;

drop trigger if exists tasks_set_completion_timestamp on public.tasks;
create trigger tasks_set_completion_timestamp
  before insert or update of status, completed_at on public.tasks
  for each row execute function public.set_task_completion_timestamp();

drop trigger if exists focus_sessions_validate_task on public.focus_sessions;
create trigger focus_sessions_validate_task
  before insert or update of task_id, sheet_id, user_id
  on public.focus_sessions
  for each row execute function public.validate_focus_session_task();

create or replace function public.refresh_daily_statistics(
  target_user_id uuid,
  target_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  range_start timestamptz;
  range_end timestamptz;
  focus_total bigint;
  break_total bigint;
  session_total integer;
  average_session numeric(12, 2);
  completed_total integer;
  accuracy numeric(12, 4);
begin
  if target_user_id is null or target_date is null then
    return;
  end if;

  if not exists (
    select 1
      from auth.users as account
      where account.id = target_user_id
  ) then
    return;
  end if;

  perform 1
    from public.profiles
    where id = target_user_id
    for update;

  range_start := target_date::timestamp at time zone 'UTC';
  range_end := (target_date + 1)::timestamp at time zone 'UTC';

  select
    coalesce(sum(session.actual_seconds), 0)::bigint,
    count(*)::integer,
    coalesce(avg(session.actual_seconds), 0)::numeric(12, 2)
    into focus_total, session_total, average_session
    from public.focus_sessions as session
    where session.user_id = target_user_id
      and session.deleted_at is null
      and session.started_at >= range_start
      and session.started_at < range_end;

  select coalesce(sum(session.actual_seconds), 0)::bigint
    into break_total
    from public.break_sessions as session
    where session.user_id = target_user_id
      and session.deleted_at is null
      and session.started_at >= range_start
      and session.started_at < range_end;

  select count(*)::integer
    into completed_total
    from public.tasks as task
    where task.user_id = target_user_id
      and task.status = 'completed'
      and task.deleted_at is null
      and task.completed_at >= range_start
      and task.completed_at < range_end;

  select avg(task.estimated_minutes / task.actual_minutes)::numeric(12, 4)
    into accuracy
    from public.tasks as task
    where task.user_id = target_user_id
      and task.status = 'completed'
      and task.deleted_at is null
      and task.completed_at >= range_start
      and task.completed_at < range_end
      and task.actual_minutes > 0;

  insert into public.statistics (
    user_id,
    stat_date,
    focus_seconds,
    break_seconds,
    completed_tasks,
    focus_session_count,
    average_focus_session_seconds,
    estimation_accuracy
  )
  values (
    target_user_id,
    target_date,
    focus_total,
    break_total,
    completed_total,
    session_total,
    average_session,
    accuracy
  )
  on conflict (user_id, stat_date) do update
    set focus_seconds = excluded.focus_seconds,
        break_seconds = excluded.break_seconds,
        completed_tasks = excluded.completed_tasks,
        focus_session_count = excluded.focus_session_count,
        average_focus_session_seconds =
          excluded.average_focus_session_seconds,
        estimation_accuracy = excluded.estimation_accuracy,
        deleted_at = null,
        updated_at = clock_timestamp(),
        updated_by = auth.uid();
end;
$$;

create or replace function public.refresh_statistics_for_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_daily_statistics(
      old.user_id,
      (old.started_at at time zone 'UTC')::date
    );
  end if;
  if tg_op <> 'DELETE' then
    perform public.refresh_daily_statistics(
      new.user_id,
      (new.started_at at time zone 'UTC')::date
    );
  end if;
  return null;
end;
$$;

create or replace function public.refresh_statistics_for_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' and old.completed_at is not null then
    perform public.refresh_daily_statistics(old.user_id, (old.completed_at at time zone 'UTC')::date);
  end if;
  if tg_op <> 'DELETE' and new.completed_at is not null then
    perform public.refresh_daily_statistics(new.user_id, (new.completed_at at time zone 'UTC')::date);
  end if;
  return null;
end;
$$;

drop trigger if exists focus_sessions_refresh_statistics on public.focus_sessions;
create trigger focus_sessions_refresh_statistics
  after insert or update or delete on public.focus_sessions
  for each row execute function public.refresh_statistics_for_session_change();

drop trigger if exists break_sessions_refresh_statistics on public.break_sessions;
create trigger break_sessions_refresh_statistics
  after insert or update or delete on public.break_sessions
  for each row execute function public.refresh_statistics_for_session_change();

drop trigger if exists tasks_refresh_statistics on public.tasks;
create trigger tasks_refresh_statistics
  after insert or update or delete on public.tasks
  for each row execute function public.refresh_statistics_for_task_change();

revoke all on function public.refresh_daily_statistics(uuid, date) from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.sheets enable row level security;
alter table public.tasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.break_sessions enable row level security;
alter table public.statistics enable row level security;
alter table public.sync_queue enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and deleted_at is null);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and deleted_at is null);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

drop policy if exists sheets_select_own on public.sheets;
create policy sheets_select_own on public.sheets
  for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists sheets_insert_own on public.sheets;
create policy sheets_insert_own on public.sheets
  for insert to authenticated
  with check (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists sheets_update_own on public.sheets;
create policy sheets_update_own on public.sheets
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

drop policy if exists focus_sessions_select_own on public.focus_sessions;
create policy focus_sessions_select_own on public.focus_sessions
  for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists focus_sessions_insert_own on public.focus_sessions;
create policy focus_sessions_insert_own on public.focus_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists focus_sessions_update_own on public.focus_sessions;
create policy focus_sessions_update_own on public.focus_sessions
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

drop policy if exists break_sessions_select_own on public.break_sessions;
create policy break_sessions_select_own on public.break_sessions
  for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists break_sessions_insert_own on public.break_sessions;
create policy break_sessions_insert_own on public.break_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists break_sessions_update_own on public.break_sessions;
create policy break_sessions_update_own on public.break_sessions
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

drop policy if exists statistics_select_own on public.statistics;
create policy statistics_select_own on public.statistics
  for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

drop policy if exists sync_queue_select_own on public.sync_queue;
create policy sync_queue_select_own on public.sync_queue
  for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists sync_queue_insert_own on public.sync_queue;
create policy sync_queue_insert_own on public.sync_queue
  for insert to authenticated
  with check (user_id = (select auth.uid()) and deleted_at is null);
drop policy if exists sync_queue_update_own on public.sync_queue;
create policy sync_queue_update_own on public.sync_queue
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

revoke all on public.profiles, public.sheets, public.tasks,
  public.focus_sessions, public.break_sessions, public.statistics,
  public.sync_queue from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.sheets to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert, update on public.focus_sessions to authenticated;
grant select, insert, update on public.break_sessions to authenticated;
grant select on public.statistics to authenticated;
grant select, insert, update on public.sync_queue to authenticated;

-- Statistics are maintained by trusted triggers, never by client writes.
revoke insert, update, delete on public.statistics from authenticated;

do $$
declare
  relation_name text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  foreach relation_name in array array[
    'profiles',
    'sheets',
    'tasks',
    'focus_sessions',
    'break_sessions',
    'statistics',
    'sync_queue'
  ]
  loop
    if not exists (
      select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = relation_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        relation_name
      );
    end if;
    execute format(
      'alter table public.%I replica identity full',
      relation_name
    );
  end loop;
end;
$$;

-- Existing identities receive a profile as part of this migration.
insert into public.profiles (id, display_name, avatar_url)
  select
    account.id,
    left(coalesce(
      account.raw_user_meta_data ->> 'full_name',
      account.raw_user_meta_data ->> 'name',
      split_part(account.email, '@', 1)
    ), 120),
    account.raw_user_meta_data ->> 'avatar_url'
  from auth.users as account
  on conflict (id) do nothing;
