create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text not null default '' check (char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_profiles_name_idx on public.customer_profiles (lower(name));
create index customer_profiles_email_idx on public.customer_profiles (lower(email));
create unique index customer_profiles_phone_idx on public.customer_profiles (phone) where phone <> '';

create trigger customer_profile_updated
  before update on public.customer_profiles
  for each row execute function public.set_updated_at();

create function public.sync_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data->>'customer_portal' = 'true' then
    insert into public.customer_profiles (id, name, email, phone)
    values (
      new.id,
      new.raw_user_meta_data->>'full_name',
      lower(new.email),
      new.raw_user_meta_data->>'phone'
    )
    on conflict (id) do update set
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone;
  else
    update public.customer_profiles set
      name = coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), name),
      email = lower(new.email),
      phone = coalesce(new.raw_user_meta_data->>'phone', phone)
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger customer_auth_profile_sync
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_customer_profile();

alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from public, anon, authenticated;
grant all on public.customer_profiles to service_role;
grant select (id, name, email, phone, created_at, updated_at) on public.customer_profiles to authenticated;
drop policy if exists "Own customer profile" on public.customer_profiles;
create policy "Own customer profile" on public.customer_profiles
  for select to authenticated using ((select auth.uid()) = id);
revoke all on function public.sync_customer_profile() from public, anon, authenticated;
