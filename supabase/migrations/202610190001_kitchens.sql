create table public.kitchens (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 100),
  address text not null check (char_length(address) between 3 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger kitchen_updated before update on public.kitchens
  for each row execute function public.set_updated_at();

alter table public.admin_profiles add column kitchen_id uuid references public.kitchens(id) on delete set null;
alter table public.orders add column kitchen_id uuid references public.kitchens(id);
alter table public.orders add column delivery_address text not null default '';
alter table public.orders add column delivery_latitude double precision;
alter table public.orders add column delivery_longitude double precision;

alter table public.orders add constraint orders_delivery_coordinates_check check (
  (delivery_latitude is null and delivery_longitude is null)
  or (delivery_latitude is not null and delivery_longitude is not null
    and delivery_latitude between -90 and 90 and delivery_longitude between -180 and 180)
);

insert into public.kitchens (name, address, latitude, longitude)
values
  ('Adenta Kitchen', 'Adenta, Greater Accra Region, Ghana', 5.7062, -0.1657),
  ('Dansoman Kitchen', 'Dansoman, Greater Accra Region, Ghana', 5.5377, -0.2674)
on conflict (name) do update set
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

update public.orders
set delivery_address = coalesce(nullif(substring(notes from '^Delivery address: ([^\n]+)'), ''), '')
where fulfilment = 'delivery' and delivery_address = '';

with ranked_admins as (
  select id, row_number() over (order by created_at, id) as row_number
  from public.admin_profiles
  where role = 'admin'
)
update public.admin_profiles as admin
set kitchen_id = kitchen.id
from ranked_admins
join public.kitchens as kitchen
  on kitchen.name = case when ranked_admins.row_number % 2 = 1 then 'Adenta Kitchen' else 'Dansoman Kitchen' end
where admin.id = ranked_admins.id;

update public.orders as orders
set kitchen_id = (
  select kitchen.id from public.kitchens as kitchen
  where kitchen.is_active
  order by md5(orders.id::text || kitchen.id::text)
  limit 1
)
where orders.kitchen_id is null;

alter table public.orders alter column kitchen_id set not null;
create index orders_kitchen_created_idx on public.orders (kitchen_id, created_at desc);
create index admin_profiles_kitchen_idx on public.admin_profiles (kitchen_id) where kitchen_id is not null;

alter table public.kitchens enable row level security;
revoke all on public.kitchens from anon, authenticated;
grant all on public.kitchens to service_role;
grant select (delivery_address, delivery_latitude, delivery_longitude) on public.orders to authenticated;

create or replace function public.create_order(p_order jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.orders;
begin
  insert into public.orders(
    order_ref,customer_name,customer_email,customer_phone,fulfilment,preferred_time,notes,total,lines,
    payment_status,transaction_id,request_key,customer_id,source,kitchen_id,delivery_address,
    delivery_latitude,delivery_longitude
  )
  values(
    p_order->>'order_ref',p_order->>'customer_name',p_order->>'customer_email',p_order->>'customer_phone',
    p_order->>'fulfilment',p_order->>'preferred_time',p_order->>'notes',(p_order->>'total')::numeric,p_order->'lines',
    p_order->>'payment_status',p_order->>'transaction_id',p_order->>'request_key',
    nullif(p_order->>'customer_id','')::uuid,coalesce(nullif(p_order->>'source',''),'web'),
    coalesce(nullif(p_order->>'kitchen_id','')::uuid,(
      select id from public.kitchens where is_active order by random() limit 1
    )),
    coalesce(p_order->>'delivery_address',''),
    nullif(p_order->>'delivery_latitude','')::double precision,
    nullif(p_order->>'delivery_longitude','')::double precision
  ) returning * into saved;
  if saved.transaction_id is not null then
    insert into public.payment_attempts(transaction_id,order_id,amount)
    values(saved.transaction_id,saved.id,saved.total);
  end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

notify pgrst, 'reload schema';
