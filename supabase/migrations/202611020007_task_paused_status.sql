-- Support paused task state and enforce one in-progress task per user.
alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (
    status in ('pending', 'in_progress', 'paused', 'completed', 'skipped', 'archived')
  );

with ranked_active_tasks as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, created_at, id
    ) as active_rank
  from public.tasks
  where status = 'in_progress'
    and deleted_at is null
)
update public.tasks as task
  set status = 'paused'
  from ranked_active_tasks as ranked
  where task.id = ranked.id
    and ranked.active_rank > 1;

create unique index if not exists tasks_one_in_progress_per_user_idx
  on public.tasks (user_id)
  where status = 'in_progress' and deleted_at is null;
