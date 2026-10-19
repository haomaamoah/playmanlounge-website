create table public.rider_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 5 and 30),
  bike_model text not null default '' check (char_length(bike_model) <= 100),
  bike_color text not null default '' check (char_length(bike_color) <= 60),
  license_plate text not null default '' check (char_length(license_plate) <= 30),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rider_profiles_phone_key on public.rider_profiles (phone);
drop trigger if exists rider_profiles_updated on public.rider_profiles;
create trigger rider_profiles_updated before update on public.rider_profiles
  for each row execute function public.set_updated_at();

create table public.rider_locations (
  rider_id uuid primary key references public.rider_profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);
create index rider_locations_updated_idx on public.rider_locations (updated_at desc);

alter table public.orders
  add column rider_id uuid references public.rider_profiles(id) on delete restrict,
  add column rider_delivery_status text check (rider_delivery_status in ('assigned','picked_up','delivered'));
alter table public.orders add constraint orders_rider_assignment_check
  check ((rider_id is null and rider_delivery_status is null) or (rider_id is not null and rider_delivery_status is not null));
create index orders_rider_delivery_idx on public.orders (rider_id, rider_delivery_status, created_at desc);

create table public.rider_support_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.rider_profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rider_support_owner_created_idx on public.rider_support_requests (rider_id, created_at desc);
drop trigger if exists rider_support_requests_updated on public.rider_support_requests;
create trigger rider_support_requests_updated before update on public.rider_support_requests
  for each row execute function public.set_updated_at();

alter table public.rider_profiles enable row level security;
alter table public.rider_locations enable row level security;
alter table public.rider_support_requests enable row level security;
revoke all on public.rider_profiles, public.rider_locations, public.rider_support_requests from anon, authenticated;
grant all on public.rider_profiles, public.rider_locations, public.rider_support_requests to service_role;
grant usage on schema public to service_role;

grant select on public.rider_profiles to authenticated;
grant select (rider_id, rider_delivery_status) on public.orders to authenticated;
create policy "Riders read own profile and managers read rider profiles"
  on public.rider_profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.admin_profiles a
      where a.id = (select auth.uid()) and a.role in ('manager','admin') and not a.is_blocked
    )
  );

grant select on public.rider_locations to authenticated;
create policy "Rider locations visible only to owner, staff, and assigned customer"
  on public.rider_locations for select to authenticated
  using (
    rider_id = (select auth.uid())
    or exists (
      select 1 from public.admin_profiles a
      where a.id = (select auth.uid()) and a.role in ('manager','admin') and not a.is_blocked
    )
    or exists (
      select 1 from public.orders o
      where o.rider_id = rider_locations.rider_id
        and (o.customer_id = (select auth.uid()) or lower(o.customer_email) = lower((select auth.jwt())->>'email'))
        and o.rider_delivery_status in ('assigned','picked_up')
    )
  );

grant select on public.rider_support_requests to authenticated;
create policy "Riders read own support requests"
  on public.rider_support_requests for select to authenticated
  using (rider_id = (select auth.uid()));

create or replace function public.claim_delivery_order(p_order uuid, p_rider uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved jsonb;
begin
  update public.orders o
    set rider_id = p_rider, rider_delivery_status = 'assigned'
    where o.id = p_order
      and o.fulfilment = 'delivery'
      and o.rider_id is null
      and o.rider_delivery_status is null
      and o.status in ('pending','cooking','ready')
      and o.payment_status in ('paid','cod')
      and exists (select 1 from public.rider_profiles r where r.id = p_rider and not r.is_blocked)
    returning to_jsonb(o.*) into saved;
  return saved;
end $$;
revoke all on function public.claim_delivery_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_delivery_order(uuid,uuid) to service_role;

create or replace function public.pickup_delivery_order(p_order uuid, p_rider uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved jsonb;
begin
  update public.orders o
    set rider_delivery_status = 'picked_up', status = 'out'
    where o.id = p_order
      and o.rider_id = p_rider
      and o.rider_delivery_status = 'assigned'
      and o.status = 'ready'
      and o.payment_status in ('paid','cod')
      and exists (select 1 from public.rider_profiles r where r.id = p_rider and not r.is_blocked)
    returning to_jsonb(o.*) into saved;
  return saved;
end $$;
revoke all on function public.pickup_delivery_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.pickup_delivery_order(uuid,uuid) to service_role;

create or replace function public.complete_delivery_order(p_order uuid, p_rider uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved jsonb;
begin
  update public.orders o
    set rider_delivery_status = 'delivered', status = 'completed'
    where o.id = p_order
      and o.rider_id = p_rider
      and o.rider_delivery_status = 'picked_up'
      and o.status = 'out'
      and exists (select 1 from public.rider_profiles r where r.id = p_rider and not r.is_blocked)
    returning to_jsonb(o.*) into saved;
  return saved;
end $$;
revoke all on function public.complete_delivery_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.complete_delivery_order(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
