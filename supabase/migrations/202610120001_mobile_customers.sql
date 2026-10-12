-- Mobile app customers.
--
-- Customers are ordinary Supabase Auth users created by the backend (src/app/api/mobile/**), never by the
-- browser: there is no custom password table. A customer is an auth user that also has a customer_profiles
-- row; admins are allowlisted separately in admin_profiles and never get a profile.
--
-- Every statement is safe to re-run. Web orders and the admin API keep working unchanged: the new order
-- and ticket columns default to "not linked to a customer" / source 'web'.

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  name text not null default '' check (char_length(name) <= 100),
  phone text not null default '' check (char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customer_profiles_email_key on public.customer_profiles (lower(email));
drop trigger if exists customer_profiles_updated on public.customer_profiles;
create trigger customer_profiles_updated before update on public.customer_profiles
  for each row execute function public.set_updated_at();

-- Orders and tickets stay with the kitchen when a customer deletes their account: the link is simply cleared.
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists source text not null default 'web'
  constraint orders_source_check check (source in ('web','mobile'));
alter table public.support_requests add column if not exists customer_id uuid references auth.users(id) on delete set null;
create index if not exists orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index if not exists support_customer_created_idx on public.support_requests (customer_id, created_at desc);

-- Same signature as before, so POST /api/orders (web) keeps calling it untouched. Mobile orders also persist
-- the authenticated customer and their origin. service_role only: the backend derives both values, never the app.
create or replace function public.create_order(p_order jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.orders;
begin
  insert into public.orders(order_ref,customer_name,customer_email,customer_phone,fulfilment,preferred_time,notes,total,lines,payment_status,transaction_id,request_key,customer_id,source)
  values(p_order->>'order_ref',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',
    p_order->>'fulfilment',p_order->>'preferred_time',p_order->>'notes',(p_order->>'total')::numeric,p_order->'lines',
    p_order->>'payment_status',p_order->>'transaction_id',p_order->>'request_key',
    nullif(p_order->>'customer_id','')::uuid,coalesce(nullif(p_order->>'source',''),'web')) returning * into saved;
  if saved.transaction_id is not null then
    insert into public.payment_attempts(transaction_id,order_id,amount)
    values(saved.transaction_id,saved.id,saved.total);
  end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- Row Level Security as a second line of defence: the mobile API filters by customer and also reads with the
-- caller's own JWT, so even a missing filter can never return another customer's rows. Customers get read access
-- to their own rows only (and only the columns the app shows); every write goes through the backend.
alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;
grant all on public.customer_profiles to service_role;
grant select on public.customer_profiles to authenticated;

revoke all on public.orders, public.support_requests from authenticated;
grant select (id, order_ref, customer_id, customer_name, customer_email, customer_phone, fulfilment, preferred_time,
  notes, status, payment_status, total, lines, source, created_at, updated_at) on public.orders to authenticated;
grant select (id, customer_id, customer_name, customer_email, phone, subject, message, status, created_at, updated_at)
  on public.support_requests to authenticated;

drop policy if exists "Own customer profile" on public.customer_profiles;
create policy "Own customer profile" on public.customer_profiles for select to authenticated
  using ((select auth.uid()) = id);
drop policy if exists "Own orders" on public.orders;
create policy "Own orders" on public.orders for select to authenticated
  using (customer_id = (select auth.uid()));
drop policy if exists "Own support requests" on public.support_requests;
create policy "Own support requests" on public.support_requests for select to authenticated
  using (customer_id = (select auth.uid()));

-- Hosted projects: make the Data API notice the new table and columns right away.
notify pgrst, 'reload schema';
