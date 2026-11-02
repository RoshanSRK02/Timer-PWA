alter table public.pomodoro_timer_sessions
  add column if not exists notes text not null default '';
