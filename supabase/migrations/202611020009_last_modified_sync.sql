drop function if exists public.sync_offline_workspace(jsonb, timestamptz);

create or replace function public.sync_offline_workspace_last_modified(
  p_data jsonb,
  p_updated_at timestamptz
)
returns table(data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  winner public.offline_workspaces;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to synchronize a workspace.';
  end if;

  if p_updated_at is null
    or jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_data -> 'sheets') <> 'array' then
    raise exception 'Workspace data and its updated_at timestamp are required.';
  end if;

  insert into public.offline_workspaces (user_id, data, updated_at)
    values (auth.uid(), p_data, p_updated_at)
    on conflict (user_id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at
      where public.offline_workspaces.updated_at < excluded.updated_at
    returning * into winner;

  if not found then
    select * into winner
      from public.offline_workspaces
      where user_id = auth.uid();
  end if;

  return query select winner.data, winner.updated_at;
end;
$$;

revoke all on function public.sync_offline_workspace_last_modified(jsonb, timestamptz)
  from public;
grant execute on function public.sync_offline_workspace_last_modified(jsonb, timestamptz)
  to authenticated;

alter table public.pomodoro_timer_sessions
  add column if not exists updated_at timestamptz not null default now();

alter table public.sync_queue
  drop constraint if exists sync_queue_status_check;

update public.sync_queue
  set status = 'pending'
  where status = 'conflict';

alter table public.sync_queue
  add constraint sync_queue_status_check
  check (status in ('pending', 'processing', 'failed', 'applied'));

drop index if exists public.sync_queue_pending_entity_idx;
create index sync_queue_pending_entity_idx
  on public.sync_queue (user_id, entity_type, entity_id)
  where deleted_at is null and status in ('pending', 'failed');

alter table public.push_subscriptions
  add column if not exists updated_at timestamptz not null default now();

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
    break_session, break_label, updated_at, completed_sessions,
    completion_confirmed, last_session
  ) values (
    incoming.user_id, incoming.status, incoming.task_sheet_id, incoming.task_id,
    incoming.duration_seconds, incoming.accumulated_seconds, incoming.started_at,
    incoming.session_id, incoming.session_started_at, incoming.break_session,
    incoming.break_label, incoming.updated_at, incoming.completed_sessions,
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

create or replace function public.sync_pomodoro_timer_session_last_modified(
  p_session jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  incoming public.pomodoro_timer_sessions;
  winner public.pomodoro_timer_sessions;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to synchronize a timer session.';
  end if;

  incoming := jsonb_populate_record(null::public.pomodoro_timer_sessions, p_session);
  if incoming.user_id is distinct from auth.uid()
    or incoming.updated_at is null
    or incoming.id is null then
    raise exception 'Timer session must belong to the authenticated user and include id and updated_at.';
  end if;

  insert into public.pomodoro_timer_sessions (
    id, user_id, task_sheet_id, task_id, break_session, break_label,
    duration_seconds, actual_seconds, overtime_seconds, started_at,
    ended_at, outcome, notes, updated_at
  ) values (
    incoming.id, incoming.user_id, incoming.task_sheet_id, incoming.task_id,
    incoming.break_session, incoming.break_label, incoming.duration_seconds,
    incoming.actual_seconds, incoming.overtime_seconds, incoming.started_at,
    incoming.ended_at, incoming.outcome, incoming.notes, incoming.updated_at
  )
  on conflict (id) do update set
    task_sheet_id = excluded.task_sheet_id,
    task_id = excluded.task_id,
    break_session = excluded.break_session,
    break_label = excluded.break_label,
    duration_seconds = excluded.duration_seconds,
    actual_seconds = excluded.actual_seconds,
    overtime_seconds = excluded.overtime_seconds,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    outcome = excluded.outcome,
    notes = excluded.notes,
    updated_at = excluded.updated_at
  where public.pomodoro_timer_sessions.updated_at < excluded.updated_at
  returning * into winner;

  if not found then
    select * into winner
      from public.pomodoro_timer_sessions
      where id = incoming.id and user_id = auth.uid();
  end if;

  return to_jsonb(winner);
end;
$$;

revoke all on function public.sync_pomodoro_timer_session_last_modified(jsonb)
  from public;
grant execute on function public.sync_pomodoro_timer_session_last_modified(jsonb)
  to authenticated;

create or replace function public.update_pomodoro_timer_session_notes(
  p_session_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to update session notes.';
  end if;

  update public.pomodoro_timer_sessions
    set notes = p_notes, updated_at = clock_timestamp()
    where id = p_session_id and user_id = auth.uid();

  if not found then
    raise exception 'Timer session was not found.';
  end if;
end;
$$;

revoke all on function public.update_pomodoro_timer_session_notes(uuid, text)
  from public;
grant execute on function public.update_pomodoro_timer_session_notes(uuid, text)
  to authenticated;
