begin;

alter table public.admin_profiles add column if not exists is_blocked boolean not null default false;
alter table public.customer_profiles add column if not exists is_blocked boolean not null default false;

do $$
declare
  manager_id uuid;
  manager_email text := 'man@playmanlounge.com';
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and conname = 'admin_profiles_role_check'
  ) then
    alter table public.admin_profiles drop constraint admin_profiles_role_check;
  end if;

  alter table public.admin_profiles
    add constraint admin_profiles_role_check check (role in ('admin', 'manager'));

  select id into manager_id
  from auth.users
  where lower(email) = manager_email;

  if manager_id is null then
    raise exception 'Create % in Supabase Auth first, then run this script again.', manager_email;
  end if;

  insert into public.admin_profiles (id, email, role)
  values (manager_id, manager_email, 'manager')
  on conflict (id) do update
    set email = excluded.email, role = excluded.role;
end
$$;

notify pgrst, 'reload schema';
commit;
