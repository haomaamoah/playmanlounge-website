begin;

-- Block profile writes until normalization and the unique index are installed.
lock table public.customer_profiles in access exclusive mode;

-- Keep the customer-facing phone as entered; this private lookup key only represents recognized Ghana numbers.
alter table public.customer_profiles add column if not exists phone_normalized text;

create or replace function public.normalize_customer_ghana_phone(value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare digits text;
begin
  digits := regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g');
  if digits ~ '^0[0-9]{9}$' then
    return digits;
  end if;
  if digits ~ '^233[0-9]{9}$' then
    return '0' || substr(digits, 4, 9);
  end if;
  return null;
end;
$$;

create or replace function public.sync_customer_profile_phone_normalized()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone_normalized := public.normalize_customer_ghana_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists customer_profiles_phone_normalized on public.customer_profiles;
create trigger customer_profiles_phone_normalized
  before insert or update of phone on public.customer_profiles
  for each row execute function public.sync_customer_profile_phone_normalized();

-- Duplicate legacy numbers remain usable as profile data but cannot identify either account;
-- new signup/update writes are race-safe once the index below is in place.
update public.customer_profiles set phone_normalized = null;
with normalized as (
  select id, public.normalize_customer_ghana_phone(phone) as phone_normalized
  from public.customer_profiles
),
unique_numbers as (
  select phone_normalized
  from normalized
  where phone_normalized is not null
  group by phone_normalized
  having count(*) = 1
)
update public.customer_profiles as profile
set phone_normalized = normalized.phone_normalized
from normalized
join unique_numbers using (phone_normalized)
where profile.id = normalized.id;

create unique index if not exists customer_profiles_phone_normalized_key
  on public.customer_profiles (phone_normalized)
  where phone_normalized is not null;

revoke all on function public.normalize_customer_ghana_phone(text) from public, anon, authenticated;
revoke all on function public.sync_customer_profile_phone_normalized() from public, anon, authenticated;
grant execute on function public.normalize_customer_ghana_phone(text) to service_role;

notify pgrst, 'reload schema';
commit;
