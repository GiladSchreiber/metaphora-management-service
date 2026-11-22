-- Optional supplier details. Existing contacts retain their information.
-- Passwords stay in the external password manager; only its item URL is stored here.
alter table public.contacts
  add column if not exists supplier_categories text[] not null default '{}'::text[]
    check (supplier_categories <@ array['food', 'alcohol', 'coffee_tea', 'professionals']::text[]),
  add column if not exists delivery_days int[] not null default '{}'::int[]
    check (delivery_days <@ array[0, 1, 2, 3, 4, 5, 6]::int[]),
  add column if not exists ordering_methods text[] not null default '{}'::text[]
    check (ordering_methods <@ array['app', 'website', 'whatsapp']::text[]),
  add column if not exists app_url text not null default '',
  add column if not exists website_url text not null default '',
  add column if not exists whatsapp_number text not null default '',
  add column if not exists customer_number text not null default '',
  add column if not exists account_username text not null default '',
  add column if not exists password_manager_url text not null default '';
