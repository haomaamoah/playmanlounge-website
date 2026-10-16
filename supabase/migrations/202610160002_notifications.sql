create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('customer', 'staff')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  app_id text not null check (app_id in ('playmanlounge_mobile', 'playman_admin', 'playman_manager')),
  token text not null unique check (char_length(token) between 32 and 4096),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (owner_kind = 'customer' and app_id = 'playmanlounge_mobile')
    or (owner_kind = 'staff' and app_id in ('playman_admin', 'playman_manager'))
  )
);
create index notification_devices_owner_idx
  on public.notification_devices(owner_kind, owner_id) where revoked_at is null;
create trigger notification_devices_updated before update on public.notification_devices
  for each row execute function public.set_updated_at();
alter table public.notification_devices enable row level security;
revoke all on public.notification_devices from anon, authenticated;
grant all on public.notification_devices to service_role;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in ('order.created', 'support.created', 'order.status_changed')),
  entity_id uuid not null,
  recipient_kind text not null check (recipient_kind in ('staff', 'customer')),
  recipient_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'dead')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  claimed_at timestamptz,
  delivered_device_ids uuid[] not null default '{}',
  email_sent boolean not null default false,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_outbox_claim_idx on public.notification_outbox(next_attempt_at, created_at)
  where status in ('pending', 'processing');
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
grant all on public.notification_outbox to service_role;

create function public.enqueue_order_created_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_outbox(event_key, event_type, entity_id, recipient_kind, payload)
  values (
    'order-created:' || new.id::text,
    'order.created',
    new.id,
    'staff',
    jsonb_build_object('orderId', new.id, 'orderRef', new.order_ref, 'paymentStatus', new.payment_status)
  ) on conflict (event_key) do nothing;
  return new;
end $$;
create trigger orders_enqueue_created_notification after insert on public.orders
  for each row execute function public.enqueue_order_created_notification();

create function public.enqueue_support_created_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_outbox(event_key, event_type, entity_id, recipient_kind, payload)
  values (
    'support-created:' || new.id::text,
    'support.created',
    new.id,
    'staff',
    jsonb_build_object('ticketId', new.id, 'subject', new.subject)
  ) on conflict (event_key) do nothing;
  return new;
end $$;
create trigger support_enqueue_created_notification after insert on public.support_requests
  for each row execute function public.enqueue_support_created_notification();

create function public.enqueue_order_status_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    insert into public.notification_outbox(event_key, event_type, entity_id, recipient_kind, recipient_id, payload)
    values (
      'order-status:' || new.id::text || ':' || new.status,
      'order.status_changed',
      new.id,
      'customer',
      new.customer_id,
      jsonb_build_object('orderId', new.id, 'orderRef', new.order_ref, 'status', new.status)
    ) on conflict (event_key) do nothing;
  end if;
  return new;
end $$;
create trigger orders_enqueue_status_notification after update of status on public.orders
  for each row execute function public.enqueue_order_status_notification();

create function public.claim_notification_outbox(p_limit integer default 20, p_lease_seconds integer default 120)
returns table(
  id uuid, event_key text, event_type text, entity_id uuid, recipient_kind text, recipient_id uuid,
  payload jsonb, attempts integer, claim_token uuid, delivered_device_ids uuid[], email_sent boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit < 1 or p_limit > 100 or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'invalid notification claim parameters';
  end if;

  update public.notification_outbox n
    set status = 'dead',
        claim_token = null,
        claimed_at = null,
        last_error = coalesce(n.last_error, 'Delivery worker lease expired on final attempt')
    where n.attempts >= 10
      and n.status = 'processing'
      and n.claimed_at < now() - make_interval(secs => p_lease_seconds);
  return query
  with claimable as (
    select n.id from public.notification_outbox n
    where n.attempts < 10
      and n.next_attempt_at <= now()
      and (n.status = 'pending' or (n.status = 'processing' and n.claimed_at < now() - make_interval(secs => p_lease_seconds)))
    order by n.created_at
    for update skip locked
    limit p_limit
  )
  update public.notification_outbox n
    set status = 'processing', claim_token = gen_random_uuid(), claimed_at = now(), attempts = n.attempts + 1
    from claimable c
    where n.id = c.id
    returning n.id, n.event_key, n.event_type, n.entity_id, n.recipient_kind, n.recipient_id,
      n.payload, n.attempts, n.claim_token, n.delivered_device_ids, n.email_sent;
end $$;

create function public.complete_notification_outbox(
  p_id uuid, p_token uuid, p_sent boolean, p_delivered_device_ids uuid[], p_email_sent boolean, p_error text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.notification_outbox n
    set delivered_device_ids = array(
          select distinct x from unnest(n.delivered_device_ids || coalesce(p_delivered_device_ids, '{}')) x
        ),
        email_sent = n.email_sent or p_email_sent,
        status = case when p_sent then 'sent' when n.attempts >= 10 then 'dead' else 'pending' end,
        sent_at = case when p_sent then now() else n.sent_at end,
        next_attempt_at = now() + make_interval(secs => least(3600, 15 * (2 ^ least(n.attempts, 8))::integer)),
        last_error = case when p_sent then null else left(coalesce(p_error, 'Notification delivery failed'), 500) end,
        claim_token = null,
        claimed_at = null
    where n.id = p_id and n.claim_token = p_token and n.status = 'processing';
  return found;
end $$;

revoke all on function public.enqueue_order_created_notification() from public, anon, authenticated;
revoke all on function public.enqueue_support_created_notification() from public, anon, authenticated;
revoke all on function public.enqueue_order_status_notification() from public, anon, authenticated;
revoke all on function public.claim_notification_outbox(integer,integer) from public, anon, authenticated;
revoke all on function public.complete_notification_outbox(uuid,uuid,boolean,uuid[],boolean,text) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer,integer) to service_role;
grant execute on function public.complete_notification_outbox(uuid,uuid,boolean,uuid[],boolean,text) to service_role;

notify pgrst, 'reload schema';
