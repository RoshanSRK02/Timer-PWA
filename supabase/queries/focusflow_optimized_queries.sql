-- FocusFlow query examples.
-- Run as an authenticated user so auth.uid() and row-level security apply.

-- Active sheets with active tasks, ordered for the task-list view.
select
  sheet.id as sheet_id,
  sheet.name as sheet_name,
  task.id as task_id,
  task.title,
  task.estimated_minutes,
  task.actual_minutes,
  task.status,
  task.completion_method,
  task.position
from public.sheets as sheet
left join public.tasks as task
  on task.sheet_id = sheet.id
  and task.user_id = sheet.user_id
  and task.deleted_at is null
where sheet.user_id = (select auth.uid())
  and sheet.deleted_at is null
order by sheet.position, sheet.created_at, task.position, task.created_at;

-- Recent focus sessions with optional sheet/task filters.
-- Add predicates for the selected filters before running, for example:
--   and session.sheet_id = '<sheet UUID>'::uuid
--   and session.task_id = '<task UUID>'::uuid
select
  session.id,
  task.title as task_title,
  sheet.name as sheet_name,
  session.started_at,
  session.ended_at,
  session.actual_seconds,
  session.status,
  session.notes
from public.focus_sessions as session
left join public.tasks as task on task.id = session.task_id
left join public.sheets as sheet on sheet.id = session.sheet_id
where session.user_id = (select auth.uid())
  and session.deleted_at is null
  and session.started_at >= now() - interval '30 days'
order by session.started_at desc
limit 100;

-- Recent break sessions.
select
  session.id,
  session.label,
  session.started_at,
  session.ended_at,
  session.actual_seconds,
  session.status,
  session.notes
from public.break_sessions as session
where session.user_id = (select auth.uid())
  and session.deleted_at is null
  and session.started_at >= now() - interval '30 days'
order by session.started_at desc
limit 100;

-- Daily focus/break/completion trend for the current UTC day and previous 29.
with days as (
  select generate_series(
    ((now() at time zone 'UTC')::date - 29)::timestamp,
    (now() at time zone 'UTC')::date::timestamp,
    interval '1 day'
  )::date as stat_date
)
select
  days.stat_date,
  coalesce(stat.focus_seconds, 0) as focus_seconds,
  coalesce(stat.break_seconds, 0) as break_seconds,
  coalesce(stat.completed_tasks, 0) as completed_tasks,
  stat.average_focus_session_seconds,
  stat.estimation_accuracy
from days
left join public.statistics as stat
  on stat.stat_date = days.stat_date
  and stat.user_id = (select auth.uid())
  and stat.deleted_at is null
order by days.stat_date;

-- Queue items awaiting retry or conflict resolution.
select
  queue.id,
  queue.idempotency_key,
  queue.entity_type,
  queue.entity_id,
  queue.operation,
  queue.payload,
  queue.base_updated_at,
  queue.status,
  queue.attempts,
  queue.last_error,
  queue.created_at
from public.sync_queue as queue
where queue.user_id = (select auth.uid())
  and queue.deleted_at is null
  and queue.status in ('pending', 'conflict', 'failed')
order by queue.created_at
limit 100;
