alter table public.orders
  add column payment_retries integer not null default 0
  check (payment_retries between 0 and 2);

create function public.retry_payment_attempt(p_old text, p_new text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare attempt public.payment_attempts; saved public.orders;
begin
  select * into attempt from public.payment_attempts
    where transaction_id = p_old for update;
  if not found then raise exception 'unknown payment attempt'; end if;
  if attempt.state not in ('pending','failed') then
    raise exception 'payment attempt is %', attempt.state;
  end if;

  update public.payment_attempts set state = 'superseded'
    where transaction_id = p_old;
  insert into public.payment_attempts(transaction_id, order_id, amount)
    values (p_new, attempt.order_id, attempt.amount);
  update public.orders set transaction_id = p_new, payment_status = 'pending',
      payment_retries = payment_retries + 1
    where id = attempt.order_id and payment_status in ('pending','failed')
      and transaction_id = p_old and payment_retries < 2
    returning * into saved;
  if not found then raise exception 'order cannot be retried'; end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.retry_payment_attempt(text,text) from public, anon, authenticated;
grant execute on function public.retry_payment_attempt(text,text) to service_role;

create function public.switch_payment_to_delivery(p_transaction text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare attempt public.payment_attempts; saved public.orders;
begin
  select * into attempt from public.payment_attempts
    where transaction_id = p_transaction for update;
  if not found then raise exception 'unknown payment attempt'; end if;
  if attempt.state not in ('pending','failed') then
    raise exception 'payment attempt is %', attempt.state;
  end if;

  update public.payment_attempts set state = 'superseded'
    where transaction_id = p_transaction;
  update public.orders set payment_status = 'cod', transaction_id = null
    where id = attempt.order_id and payment_status in ('pending','failed')
      and transaction_id = p_transaction
    returning * into saved;
  if not found then raise exception 'order is no longer awaiting this payment'; end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.switch_payment_to_delivery(text) from public, anon, authenticated;
grant execute on function public.switch_payment_to_delivery(text) to service_role;
