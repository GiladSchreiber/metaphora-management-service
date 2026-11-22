-- Apply to existing databases before deploying the subtask UI.
alter table public.tasks
  add column if not exists subtasks jsonb not null default '[]'::jsonb
  check (jsonb_typeof(subtasks) = 'array');

-- Update one checkbox atomically so different subtask clicks do not overwrite each other.
create or replace function public.set_task_subtask_done(task_id text, subtask_id text, is_done boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.tasks
  set subtasks = (
    select jsonb_agg(
      case when item->>'id' = subtask_id
        then jsonb_set(item, '{done}', to_jsonb(is_done))
        else item end order by position
    )
    from jsonb_array_elements(subtasks) with ordinality as entries(item, position)
  )
  where id = task_id and subtasks @> jsonb_build_array(jsonb_build_object('id', subtask_id));
  if not found then
    raise exception 'תת המשימה לא נמצאה';
  end if;
end;
$$;

grant execute on function public.set_task_subtask_done(text, text, boolean) to anon, authenticated;
