create table if not exists public.pomodoro_timer_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'idle'
    check (status in ('idle', 'running', 'paused', 'awaiting-completion')),
  task_sheet_id text,
  task_id text,
  duration_seconds integer not null default 1500
    check (duration_seconds > 0),
  accumulated_seconds integer not null default 0
    check (accumulated_seconds >= 0),
  started_at timestamptz,
  session_id uuid,
  session_started_at timestamptz,
  break_session boolean not null default false,
  break_label text,
  updated_at timestamptz not null default now(),
  completed_sessions integer not null default 0
    check (completed_sessions >= 0),
  completion_confirmed boolean not null default false,
  last_session jsonb
);

alter table public.pomodoro_timer_state enable row level security;

create policy "Users can read their own Pomodoro timer state"
  on public.pomodoro_timer_state
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Pomodoro timer state"
  on public.pomodoro_timer_state
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Pomodoro timer state"
  on public.pomodoro_timer_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update
  on public.pomodoro_timer_state
  to authenticated;

create table if not exists public.pomodoro_timer_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_sheet_id text,
  task_id text,
  break_session boolean not null default false,
  break_label text,
  duration_seconds integer not null check (duration_seconds > 0),
  actual_seconds integer not null check (actual_seconds > 0),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  outcome text not null check (outcome in ('stopped', 'completed', 'incomplete'))
);

create index if not exists pomodoro_timer_sessions_user_ended_at_idx
  on public.pomodoro_timer_sessions (user_id, ended_at desc);

alter table public.pomodoro_timer_sessions enable row level security;

create policy "Users can read their own Pomodoro timer sessions"
  on public.pomodoro_timer_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Pomodoro timer sessions"
  on public.pomodoro_timer_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Pomodoro timer sessions"
  on public.pomodoro_timer_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update
  on public.pomodoro_timer_sessions
  to authenticated;
