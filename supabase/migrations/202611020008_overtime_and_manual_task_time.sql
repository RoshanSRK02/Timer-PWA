alter table public.tasks
  alter column actual_minutes drop not null,
  alter column actual_minutes drop default;

alter table public.pomodoro_timer_state
  drop constraint if exists pomodoro_timer_state_status_check;

alter table public.pomodoro_timer_state
  add constraint pomodoro_timer_state_status_check
  check (status in ('idle', 'running', 'paused', 'awaiting-completion', 'overtime'));

alter table public.pomodoro_timer_sessions
  add column if not exists overtime_seconds integer not null default 0
  check (overtime_seconds >= 0);

update public.pomodoro_timer_sessions
set overtime_seconds = greatest(0, actual_seconds - duration_seconds)
where overtime_seconds = 0;
