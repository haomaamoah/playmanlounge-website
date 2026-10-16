alter table public.admin_profiles add column if not exists is_blocked boolean not null default false;
alter table public.customer_profiles add column if not exists is_blocked boolean not null default false;

do $$
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
end
$$;

notify pgrst, 'reload schema';
