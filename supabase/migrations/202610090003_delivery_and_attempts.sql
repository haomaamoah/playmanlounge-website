-- Per-recipient receipt delivery ledger: retries resend only unsent mail and
-- concurrent submissions cannot claim the same job twice.
create table public.order_notifications (
  order_id uuid not null references public.orders(id) on delete cascade,
  job_key text not null check (length(job_key) between 3 and 200),
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  claim_token uuid, claimed_at timestamptz, sent_at timestamptz,
  attempts integer not null default 0, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (order_id, job_key)
);
create trigger notification_updated before update on public.order_notifications for each row execute function public.set_updated_at();
alter table public.order_notifications enable row level security;
revoke all on public.order_notifications from anon, authenticated;
grant all on public.order_notifications to service_role;

create function public.claim_order_notifications(p_order uuid, p_keys text[], p_lease_seconds integer default 600)
returns table(job_key text, state text, claim_token uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if p_lease_seconds < 60 then raise exception 'lease too short'; end if;
  insert into public.order_notifications(order_id, job_key)
    select p_order, k from unnest(p_keys) as k on conflict do nothing;
  return query
  with claimable as (
    select n.job_key from public.order_notifications n
    where n.order_id = p_order and n.job_key = any(p_keys)
      and (n.state in ('pending','failed')
        or (n.state = 'sending' and n.claimed_at < now() - make_interval(secs => p_lease_seconds)))
    for update skip locked
  ), claimed as (
    update public.order_notifications n
      set state = 'sending', claim_token = gen_random_uuid(), claimed_at = now(), attempts = n.attempts + 1
      from claimable c where n.order_id = p_order and n.job_key = c.job_key
      returning n.job_key, n.state, n.claim_token
  )
  select c.job_key, c.state, c.claim_token from claimed c
  union all
  -- Unclaimed rows are either already sent or being delivered by another request.
  select n.job_key, n.state, null::uuid from public.order_notifications n
  where n.order_id = p_order and n.job_key = any(p_keys)
    and not exists (select 1 from claimed c where c.job_key = n.job_key);
end $$;

create function public.complete_order_notification(p_order uuid, p_key text, p_token uuid, p_sent boolean, p_error text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.order_notifications
    set state = case when p_sent then 'sent' else 'failed' end,
        sent_at = case when p_sent then now() else sent_at end,
        last_error = case when p_sent then null else left(p_error, 500) end,
        claim_token = null
    where order_id = p_order and job_key = p_key and claim_token = p_token and state = 'sending';
  return found;
end $$;
revoke all on function public.claim_order_notifications(uuid,text[],integer) from public, anon, authenticated;
revoke all on function public.complete_order_notification(uuid,text,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.claim_order_notifications(uuid,text[],integer) to service_role;
grant execute on function public.complete_order_notification(uuid,text,uuid,boolean,text) to service_role;

-- A definitively refused direct charge is superseded by hosted checkout on the
-- same order instead of creating a second order.
alter table public.payment_attempts drop constraint payment_attempts_state_check;
alter table public.payment_attempts add constraint payment_attempts_state_check
  check (state in ('pending','paid','failed','superseded'));

create function public.supersede_payment_attempt(p_old text, p_new text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare attempt public.payment_attempts; saved public.orders;
begin
  select * into attempt from public.payment_attempts where transaction_id = p_old for update;
  if not found then raise exception 'unknown payment attempt'; end if;
  if attempt.state not in ('pending','failed') then raise exception 'payment attempt is %', attempt.state; end if;
  update public.payment_attempts set state = 'superseded' where transaction_id = p_old;
  insert into public.payment_attempts(transaction_id, order_id, amount) values (p_new, attempt.order_id, attempt.amount);
  update public.orders set transaction_id = p_new, payment_status = 'pending'
    where id = attempt.order_id and payment_status <> 'paid' and transaction_id = p_old
    returning * into saved;
  if not found then raise exception 'order is no longer awaiting this attempt'; end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.supersede_payment_attempt(text,text) from public, anon, authenticated;
grant execute on function public.supersede_payment_attempt(text,text) to service_role;

-- Only the order's current attempt can fail it; a provider-verified payment on
-- any attempt still marks the order paid.
create or replace function public.record_payment(p_transaction text, p_state text)
returns void language plpgsql security definer set search_path = '' as $$
declare attempt public.payment_attempts;
begin
  if p_state not in ('paid','failed') then return; end if;
  select * into attempt from public.payment_attempts where transaction_id = p_transaction for update;
  if not found or attempt.state = 'paid' then return; end if;
  if attempt.state = 'superseded' and p_state <> 'paid' then return; end if;
  update public.payment_attempts set state = p_state where transaction_id = p_transaction;
  if p_state = 'paid' then
    update public.orders set payment_status = 'paid' where id = attempt.order_id;
  else
    update public.orders set payment_status = 'failed'
      where id = attempt.order_id and payment_status <> 'paid' and transaction_id = p_transaction;
  end if;
end $$;
revoke all on function public.record_payment(text,text) from public, anon, authenticated;
grant execute on function public.record_payment(text,text) to service_role;
