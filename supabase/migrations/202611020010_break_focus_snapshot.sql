alter table public.pomodoro_timer_state
  add column if not exists break_complete boolean not null default false,
  add column if not exists suspended_focus jsonb,
  add column if not exists display_reset boolean not null default false;

create or replace function public.sync_pomodoro_timer_state_last_modified(
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  incoming public.pomodoro_timer_state;
  winner public.pomodoro_timer_state;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to synchronize a timer.';
  end if;

  incoming := jsonb_populate_record(null::public.pomodoro_timer_state, p_snapshot);
  if incoming.user_id is distinct from auth.uid() or incoming.updated_at is null then
    raise exception 'Timer state must belong to the authenticated user and include updated_at.';
  end if;

  insert into public.pomodoro_timer_state (
    user_id, status, task_sheet_id, task_id, duration_seconds,
    accumulated_seconds, started_at, session_id, session_started_at,
    break_session, break_label, break_complete, suspended_focus, display_reset,
    updated_at, completed_sessions, completion_confirmed, last_session
  ) values (
    incoming.user_id, incoming.status, incoming.task_sheet_id, incoming.task_id,
    incoming.duration_seconds, incoming.accumulated_seconds, incoming.started_at,
    incoming.session_id, incoming.session_started_at, incoming.break_session,
    incoming.break_label, coalesce(incoming.break_complete, false),
    incoming.suspended_focus, coalesce(incoming.display_reset, false),
    incoming.updated_at, incoming.completed_sessions,
    incoming.completion_confirmed, incoming.last_session
  )
  on conflict (user_id) do update set
    status = excluded.status,
    task_sheet_id = excluded.task_sheet_id,
    task_id = excluded.task_id,
    duration_seconds = excluded.duration_seconds,
    accumulated_seconds = excluded.accumulated_seconds,
    started_at = excluded.started_at,
    session_id = excluded.session_id,
    session_started_at = excluded.session_started_at,
    break_session = excluded.break_session,
    break_label = excluded.break_label,
    break_complete = excluded.break_complete,
    suspended_focus = excluded.suspended_focus,
    display_reset = excluded.display_reset,
    updated_at = excluded.updated_at,
    completed_sessions = excluded.completed_sessions,
    completion_confirmed = excluded.completion_confirmed,
    last_session = excluded.last_session
  where public.pomodoro_timer_state.updated_at < excluded.updated_at
  returning * into winner;

  if not found then
    select * into winner
      from public.pomodoro_timer_state
      where user_id = auth.uid();
  end if;

  return to_jsonb(winner);
end;
$$;

revoke all on function public.sync_pomodoro_timer_state_last_modified(jsonb)
  from public;
grant execute on function public.sync_pomodoro_timer_state_last_modified(jsonb)
  to authenticated;
