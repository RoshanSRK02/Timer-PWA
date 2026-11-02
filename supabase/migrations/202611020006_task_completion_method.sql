-- Record whether a task was completed manually or through a focus timer.
alter table public.tasks
  add column if not exists completion_method text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conrelid = 'public.tasks'::regclass
        and conname = 'tasks_completion_method_check'
  ) then
    alter table public.tasks
      add constraint tasks_completion_method_check
      check (completion_method is null or completion_method in ('manual', 'timer'));
  end if;
end;
$$;

comment on column public.tasks.completion_method is
  'Manual quick completion or completion through a focus timer; NULL for unknown legacy records.';
