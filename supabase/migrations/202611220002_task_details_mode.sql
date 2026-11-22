-- Remember the selected task detail style, including an empty checklist or update feed.
alter table public.tasks
  add column if not exists details_mode text
  check (details_mode in ('checklist', 'updates'));

-- Preserve existing content. Tasks that used both keep their checklist as the
-- primary section; their older updates remain accessible in a collapsed section.
update public.tasks as task
set details_mode = case
  when jsonb_array_length(task.subtasks) > 0 then 'checklist'
  when exists (select 1 from public.task_updates where task_id = task.id) then 'updates'
  else null
end
where details_mode is null;
