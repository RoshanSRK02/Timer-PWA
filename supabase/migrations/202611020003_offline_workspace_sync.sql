create table if not exists public.offline_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"sheets":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.offline_workspaces enable row level security;

create policy "Users can read their own offline workspace"
  on public.offline_workspaces
  for select
  using (auth.uid() = user_id);

grant select on public.offline_workspaces to authenticated;

create or replace function public.sync_offline_workspace(
  p_data jsonb,
  p_expected_updated_at timestamptz
)
returns table(conflict boolean, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_data jsonb;
  current_updated_at timestamptz;
  next_updated_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to synchronize a workspace.';
  end if;

  if jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_data -> 'sheets') <> 'array' then
    raise exception 'Workspace data must contain a sheets array.';
  end if;

  perform 1
    from auth.users
    where id = auth.uid()
    for update;

  select workspace.data, workspace.updated_at
    into current_data, current_updated_at
    from public.offline_workspaces as workspace
    where workspace.user_id = auth.uid()
    for update;

  if found then
    if p_expected_updated_at is null
      or current_updated_at <> p_expected_updated_at then
      return query
        select true, current_data, current_updated_at;
      return;
    end if;
  elsif p_expected_updated_at is not null then
    return query
      select true, null::jsonb, null::timestamptz;
    return;
  end if;

  next_updated_at := clock_timestamp();
  insert into public.offline_workspaces (user_id, data, updated_at)
    values (auth.uid(), p_data, next_updated_at)
    on conflict (user_id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at;

  return query
    select false, p_data, next_updated_at;
end;
$$;

revoke all on function public.sync_offline_workspace(jsonb, timestamptz)
  from public;
grant execute on function public.sync_offline_workspace(jsonb, timestamptz)
  to authenticated;
