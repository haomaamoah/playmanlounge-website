create extension if not exists pgcrypto;

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.menu_items (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null, description text not null default '',
  price numeric(12,2) not null check (price > 0),
  category text not null check (category in ('food','drinks')),
  image_url text not null,
  width integer not null check (width > 0), height integer not null check (height > 0),
  group_id text not null, group_title text not null, group_blurb text not null default '',
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_ref text not null,
  customer_name text not null, customer_email text not null, customer_phone text not null,
  fulfilment text not null check (fulfilment in ('delivery','pickup')),
  preferred_time text not null, notes text not null default '',
  status text not null default 'pending' check (status in ('pending','cooking','ready','out','completed','cancelled')),
  payment_status text not null check (payment_status in ('pending','paid','cod','failed')),
  transaction_id text unique,
  request_key text unique,
  total numeric(12,2) not null check (total > 0), lines jsonb not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payment_attempts (
  transaction_id text primary key,
  order_id uuid not null references public.orders(id),
  state text not null default 'pending' check (state in ('pending','paid','failed')),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null, customer_email text not null, phone text not null default '',
  subject text not null, message text not null,
  status text not null default 'open' check (status in ('open','closed')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, resource_id text, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.rate_limits (
  key text primary key, hits integer not null, reset_at timestamptz not null
);
create index orders_created_idx on public.orders(created_at desc);
create index orders_status_idx on public.orders(status, payment_status);
create index support_status_idx on public.support_requests(status, created_at desc);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger admin_updated before update on public.admin_profiles for each row execute function public.set_updated_at();
create trigger menu_updated before update on public.menu_items for each row execute function public.set_updated_at();
create trigger order_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger support_updated before update on public.support_requests for each row execute function public.set_updated_at();
create trigger payment_updated before update on public.payment_attempts for each row execute function public.set_updated_at();

-- Atomic fixed-window limits are shared by every application instance.
create function public.consume_rate_limit(p_key text, p_max integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.rate_limits as r(key,hits,reset_at)
    values(p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(key) do update set
    hits=case when r.reset_at <= now() then 1 else r.hits+1 end,
    reset_at=case when r.reset_at <= now() then now()+make_interval(secs=>p_seconds) else r.reset_at end
  returning hits into n;
  return n <= p_max;
end $$;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;

create function public.dashboard_revenue() returns numeric language sql security definer set search_path = '' as $$
  select coalesce(sum(total),0) from public.orders where payment_status='paid' and not is_demo;
$$;
revoke all on function public.dashboard_revenue() from public, anon, authenticated;
grant execute on function public.dashboard_revenue() to service_role;

-- One transaction records both the order snapshot and genuine gateway attempt.
create function public.create_order(p_order jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.orders;
begin
  insert into public.orders(order_ref,customer_name,customer_email,customer_phone,fulfilment,preferred_time,notes,total,lines,payment_status,transaction_id,request_key)
  values(p_order->>'order_ref',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',
    p_order->>'fulfilment',p_order->>'preferred_time',p_order->>'notes',(p_order->>'total')::numeric,p_order->'lines',
    p_order->>'payment_status',p_order->>'transaction_id',p_order->>'request_key') returning * into saved;
  if saved.transaction_id is not null then
    insert into public.payment_attempts(transaction_id,order_id,amount)
    values(saved.transaction_id,saved.id,saved.total);
  end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

create function public.record_payment(p_transaction text, p_state text)
returns void language plpgsql security definer set search_path = '' as $$
declare attempt public.payment_attempts;
begin
  if p_state not in ('paid','failed') then return; end if;
  select * into attempt from public.payment_attempts where transaction_id=p_transaction for update;
  if not found or attempt.state='paid' then return; end if;
  update public.payment_attempts set state=p_state where transaction_id=p_transaction;
  update public.orders set payment_status=p_state where id=attempt.order_id and payment_status <> 'paid';
end $$;
revoke all on function public.record_payment(text,text) from public, anon, authenticated;
grant execute on function public.record_payment(text,text) to service_role;

alter table public.admin_profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.support_requests enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.admin_profiles, public.menu_items, public.orders, public.payment_attempts, public.support_requests, public.audit_events, public.rate_limits from anon, authenticated;
grant usage on schema public to service_role, authenticated;
grant all on public.admin_profiles, public.menu_items, public.orders, public.payment_attempts, public.support_requests, public.audit_events, public.rate_limits to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;
-- Support projects with automatic table exposure disabled. Future application
-- migrations explicitly expose only reviewed tables/functions.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant execute on functions to service_role;
grant select on public.admin_profiles to authenticated;
create policy "Own allowlisted profile" on public.admin_profiles for select to authenticated using ((select auth.uid()) = id);
-- No signup/profile insertion policy: only an operator using service_role can allowlist an admin.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('menu-images','menu-images',true,5242880,array['image/webp'])
on conflict(id) do nothing;
-- Public bucket URLs are readable without a storage.objects policy; omitting one prevents anonymous object listing.
-- Writes are server-only service_role; no browser upload/delete privileges.
