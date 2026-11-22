-- Link full tasks without turning them into plain checklist entries.
alter table public.tasks
  add column if not exists parent_task_id text references public.tasks(id) on delete set null
  check (parent_task_id is distinct from id);

create index if not exists tasks_parent_task_id_idx on public.tasks(parent_task_id);

-- Serialize hierarchy changes so simultaneous attachments cannot create a cycle.
-- Ordinary checkbox updates do not take this lock.
create or replace function public.check_task_parent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.parent_task_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(188621751, 1);

  if exists (
    with recursive ancestors as (
      select id, parent_task_id from public.tasks where id = new.parent_task_id
      union
      select task.id, task.parent_task_id
      from public.tasks task
      join ancestors on task.id = ancestors.parent_task_id
    )
    select 1 from ancestors where id = new.id
  ) or new.parent_task_id = new.id then
    raise exception 'אי אפשר לשייך משימה לעצמה או לאחת מתתי המשימות שלה';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_check_parent on public.tasks;
create trigger tasks_check_parent
  before insert or update of parent_task_id on public.tasks
  for each row execute function public.check_task_parent();
