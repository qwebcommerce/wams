-- WAMS first version. Run this once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Qatar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);

create table public.whatsapp_connections (
  company_id uuid primary key references public.companies (id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null unique,
  display_phone_number text,
  verified_name text,
  status text not null default 'connected' check (status in ('connected', 'error')),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Token is not readable by the browser role. Only the service role can select it.
create table public.whatsapp_secrets (
  company_id uuid primary key references public.companies (id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  tags text[] not null default '{}',
  notes text,
  service_opt_in boolean not null default false,
  service_opt_in_at timestamptz,
  service_opt_in_source text,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  marketing_opt_in_source text,
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  whatsapp_reachable text not null default 'unknown' check (whatsapp_reachable in ('unknown', 'reachable', 'unreachable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, phone_e164)
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  meta_id text,
  name text not null,
  language text not null,
  category text not null,
  status text not null,
  header_text text,
  body text not null default '',
  footer_text text,
  header_variables integer[] not null default '{}',
  body_variables integer[] not null default '{}',
  supported boolean not null default false,
  unsupported_reason text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name, language)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  template_id uuid not null references public.message_templates (id) on delete restrict,
  service_name text not null,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly', 'every_n_days')),
  interval_days integer check (interval_days is null or interval_days between 1 and 365),
  weekday integer check (weekday is null or weekday between 0 and 6),
  day_of_month integer check (day_of_month is null or day_of_month between 1 and 28),
  send_time text not null check (send_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  timezone text not null,
  variable_mapping jsonb not null default '{"header":{},"body":{}}',
  starts_on date not null,
  ends_on date,
  max_occurrences integer check (max_occurrences is null or max_occurrences between 1 and 500),
  occurrences_sent integer not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  schedule_id uuid references public.schedules (id) on delete set null,
  template_id uuid references public.message_templates (id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  meta_message_id text,
  preview text,
  status text not null check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'received')),
  error text,
  occurrence_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  occurrence_at timestamptz not null,
  message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (schedule_id, occurrence_at)
);

create unique index messages_meta_message_id_idx
  on public.messages (meta_message_id)
  where meta_message_id is not null;

create index customers_company_idx on public.customers (company_id, first_name);
create index schedules_due_idx on public.schedules (status, next_run_at);
create index messages_company_created_idx on public.messages (company_id, created_at desc);
create index profiles_company_idx on public.profiles (company_id);

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger connections_updated_at
  before update on public.whatsapp_connections
  for each row execute function public.set_updated_at();

create trigger secrets_updated_at
  before update on public.whatsapp_secrets
  for each row execute function public.set_updated_at();

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger templates_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

create trigger schedules_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

create trigger messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
  requested_timezone text;
begin
  requested_timezone := coalesce(new.raw_user_meta_data->>'timezone', 'Asia/Qatar');
  begin
    perform requested_timezone::text;
    perform now() at time zone requested_timezone;
  exception when others then
    requested_timezone := 'Asia/Qatar';
  end;

  insert into public.companies (name, timezone)
  values (
    coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), 'My company'),
    requested_timezone
  )
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, email)
  values (
    new.id,
    new_company_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_secrets enable row level security;
alter table public.customers enable row level security;
alter table public.message_templates enable row level security;
alter table public.schedules enable row level security;
alter table public.messages enable row level security;
alter table public.schedule_occurrences enable row level security;

create policy companies_select on public.companies
  for select to authenticated
  using (id = public.current_company_id());

create policy companies_update on public.companies
  for update to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.current_company_id());

create policy connections_all on public.whatsapp_connections
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy customers_all on public.customers
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy templates_all on public.message_templates
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy schedules_all on public.schedules
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy messages_select on public.messages
  for select to authenticated
  using (company_id = public.current_company_id());

create policy occurrences_select on public.schedule_occurrences
  for select to authenticated
  using (
    exists (
      select 1 from public.schedules
      where schedules.id = schedule_occurrences.schedule_id
        and schedules.company_id = public.current_company_id()
    )
  );

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_company_id() from public, anon;
grant execute on function public.current_company_id() to authenticated;

grant select, update on public.companies to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.whatsapp_connections to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.message_templates to authenticated;
grant select, insert, update, delete on public.schedules to authenticated;
grant select on public.messages to authenticated;
grant select on public.schedule_occurrences to authenticated;

revoke all on public.whatsapp_secrets from anon, authenticated;
revoke all on public.companies from anon;
revoke all on public.profiles from anon;
revoke all on public.whatsapp_connections from anon;
revoke all on public.customers from anon;
revoke all on public.message_templates from anon;
revoke all on public.schedules from anon;
revoke all on public.messages from anon;
revoke all on public.schedule_occurrences from anon;
