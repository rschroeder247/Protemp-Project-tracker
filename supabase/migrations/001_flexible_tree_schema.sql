-- ========================================================
-- Protemp Project Tracker: Flexible Tree Data Model
-- Supports Master Project + Subprojects with arbitrary WBS tree depth
-- ========================================================

-- 1. Projects (Master & Linked Subprojects)
create table if not exists tracker_projects (
  id text primary key,
  title text not null,
  short_title text not null,
  reference text default '',
  is_subproject boolean default false,
  parent_project_id text references tracker_projects(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 2. Tasks / WBS Tree (can have 1 to 20+ subtasks, arbitrary depth)
create table if not exists tracker_tasks (
  id text primary key,
  project_id text not null references tracker_projects(id) on delete cascade,
  parent_task_id text references tracker_tasks(id) on delete cascade,
  wbs text not null default '',
  outline_level int not null default 1,
  name text not null,
  is_summary boolean not null default false,
  quoted_hours numeric(8,2) not null default 0,
  duration_days numeric(8,2) default 0,
  sort_order int not null default 0,
  notes text default '',
  created_at timestamptz default now()
);

-- 3. Profiles
create table if not exists tracker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null default 'crew' check (role in ('owner','crew','viewer')),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- 4. Task Progress (row exists = saved and locked)
create table if not exists tracker_task_progress (
  task_id text primary key references tracker_tasks(id) on delete cascade,
  project_id text not null references tracker_projects(id) on delete cascade,
  done_by_name text not null default '',
  ticked_at timestamptz not null,
  saved_at timestamptz not null default now(),
  saved_by uuid references auth.users(id)
);

-- 5. Progress Audit Log
create table if not exists tracker_progress_log (
  id bigserial primary key,
  action text not null check (action in ('saved','unlocked','notes')),
  task_id text,
  project_id text,
  done_by_name text,
  ticked_at timestamptz,
  detail text,
  actor uuid references auth.users(id),
  at timestamptz not null default now()
);

-- 6. Enable Realtime
alter publication supabase_realtime add table tracker_task_progress;
alter publication supabase_realtime add table tracker_tasks;

-- 7. Atomic Save RPC Function
create or replace function save_tree_progress(changes jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  change record;
  saved_count int := 0;
  unlocked_count int := 0;
  caller_role text;
  v_user_id uuid := auth.uid();
begin
  select role into caller_role from tracker_profiles where user_id = v_user_id and active = true;
  if caller_role is null then
    caller_role := 'crew'; -- Default for demo/initial seed if auth is not yet set
  end if;

  for change in select * from jsonb_to_recordset(changes) as x(
    kind text,
    task_id text,
    project_id text,
    done_by_name text,
    ticked_at timestamptz,
    notes text
  )
  loop
    if change.kind = 'tick' then
      if caller_role not in ('owner', 'crew') then
        raise exception 'view_only_cannot_save';
      end if;

      insert into tracker_task_progress (task_id, project_id, done_by_name, ticked_at, saved_at, saved_by)
      values (change.task_id, change.project_id, coalesce(change.done_by_name, 'Unknown'), coalesce(change.ticked_at, now()), now(), v_user_id)
      on conflict (task_id) do nothing;

      insert into tracker_progress_log (action, task_id, project_id, done_by_name, ticked_at, actor)
      values ('saved', change.task_id, change.project_id, change.done_by_name, change.ticked_at, v_user_id);

      saved_count := saved_count + 1;

    elsif change.kind = 'unlock' then
      if caller_role <> 'owner' then
        raise exception 'not_owner';
      end if;

      delete from tracker_task_progress where task_id = change.task_id;

      insert into tracker_progress_log (action, task_id, project_id, detail, actor)
      values ('unlocked', change.task_id, change.project_id, 'Stage unlocked by owner', v_user_id);

      unlocked_count := unlocked_count + 1;

    elsif change.kind = 'notes' then
      update tracker_tasks set notes = change.notes where id = change.task_id;
    end if;
  end loop;

  return jsonb_build_object('saved', saved_count, 'unlocked', unlocked_count);
end;
$$;
