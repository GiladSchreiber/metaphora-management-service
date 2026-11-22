-- Metaphora management — run this once in the Supabase SQL editor.
--
-- TODO(security): CWE-306 Missing Authentication for Critical Function
-- (OWASP Top 10 A01 Broken Access Control).
-- This app is internal for the three partners and has no login yet.
-- RLS is disabled and the attachments bucket is public, so anyone who has
-- the anon key can read and change every row and every file.
-- Do not put the anon key in the public GitHub repo.
-- Add authentication and tighten these policies before the site is public.

create table if not exists public.partners (
  id          text primary key,
  name        text not null unique,
  sort_order  int not null default 0
);

create table if not exists public.categories (
  id          text primary key,
  name        text not null unique,
  sort_order  int not null default 0
);

create table if not exists public.expenses (
  id           text primary key,
  date         date not null,
  topic        text not null,
  payer_id     text not null references public.partners(id),
  category_id  text not null references public.categories(id),
  amount       numeric(12,2) not null,
  description  text not null default '',
  receipt_url  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.tasks (
  id           text primary key,
  topic        text not null,
  description  text not null default '',
  category_id  text not null references public.categories(id),
  urgency      text not null default 'medium' check (urgency in ('low', 'medium', 'high')),
  status       text not null default 'open' check (status in ('open', 'done')),
  done_at      timestamptz,
  photo_url    text,
  created_at   timestamptz not null default now()
);

create table if not exists public.task_owners (
  task_id     text not null references public.tasks(id) on delete cascade,
  partner_id  text not null references public.partners(id),
  primary key (task_id, partner_id)
);

create table if not exists public.task_updates (
  id          text primary key,
  task_id     text not null references public.tasks(id) on delete cascade,
  body        text not null,
  partner_id  text references public.partners(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.contacts (
  id          text primary key,
  name        text not null,
  phone       text not null default '',
  role        text not null default '',
  email       text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.app_meta (
  key    text primary key,
  value  text not null
);

alter table public.partners      disable row level security;
alter table public.categories    disable row level security;
alter table public.expenses      disable row level security;
alter table public.tasks         disable row level security;
alter table public.task_owners   disable row level security;
alter table public.task_updates  disable row level security;
alter table public.contacts      disable row level security;
alter table public.app_meta      disable row level security;

grant select, insert, update, delete on public.partners to anon, authenticated;
grant select, insert, update, delete on public.categories to anon, authenticated;
grant select, insert, update, delete on public.expenses to anon, authenticated;
grant select, insert, update, delete on public.tasks to anon, authenticated;
grant select, insert, update, delete on public.task_owners to anon, authenticated;
grant select, insert, update, delete on public.task_updates to anon, authenticated;
grant select, insert, update, delete on public.contacts to anon, authenticated;
grant select, insert, update, delete on public.app_meta to anon, authenticated;

-- Receipts and task photos. Public because there is no login yet.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "metaphora attachments read" on storage.objects;
drop policy if exists "metaphora attachments insert" on storage.objects;
drop policy if exists "metaphora attachments update" on storage.objects;
drop policy if exists "metaphora attachments delete" on storage.objects;

create policy "metaphora attachments read"
  on storage.objects for select
  using (bucket_id = 'attachments');

create policy "metaphora attachments insert"
  on storage.objects for insert
  with check (bucket_id = 'attachments');

create policy "metaphora attachments update"
  on storage.objects for update
  using (bucket_id = 'attachments');

create policy "metaphora attachments delete"
  on storage.objects for delete
  using (bucket_id = 'attachments');

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
