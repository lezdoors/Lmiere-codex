begin;

alter table public.lmiere_wallet_ledger
  drop constraint if exists lmiere_wallet_ledger_kind_check;

alter table public.lmiere_wallet_ledger
  add constraint lmiere_wallet_ledger_kind_check
  check (kind in ('initial_credit', 'founder_gift', 'credit', 'purchase', 'reserve', 'settle', 'release', 'refund'));

create table if not exists public.lmiere_stripe_checkouts (
  checkout_session_id text primary key,
  user_id uuid not null references neon_auth."user"(id) on delete restrict,
  pack_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = lower(currency)),
  status text not null default 'created'
    check (status in ('created', 'paid', 'expired', 'failed', 'refunded', 'partially_refunded')),
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  credited_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lmiere_stripe_checkouts_user_created_idx
  on public.lmiere_stripe_checkouts (user_id, created_at desc);

create table if not exists public.lmiere_stripe_events (
  event_id text primary key,
  event_type text not null,
  checkout_session_id text,
  processed_at timestamptz not null default now()
);

create or replace function public.lmiere_credit_stripe_checkout(
  p_event_id text,
  p_event_type text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_stripe_customer_id text,
  p_user_id uuid,
  p_pack_id text,
  p_amount_cents integer,
  p_currency text
) returns jsonb
language plpgsql
security definer
set search_path = public, neon_auth
as $$
declare
  v_event_inserted integer := 0;
  v_checkout public.lmiere_stripe_checkouts%rowtype;
begin
  if p_amount_cents <= 0 or lower(p_currency) <> 'usd' then
    raise exception 'invalid_stripe_credit' using errcode = 'P0001';
  end if;

  insert into public.lmiere_stripe_events (
    event_id, event_type, checkout_session_id
  ) values (
    p_event_id, p_event_type, p_checkout_session_id
  )
  on conflict (event_id) do nothing;
  get diagnostics v_event_inserted = row_count;

  if v_event_inserted = 0 then
    return jsonb_build_object('applied', false, 'duplicateEvent', true);
  end if;

  perform public.lmiere_ensure_wallet(p_user_id, 0);

  insert into public.lmiere_stripe_checkouts (
    checkout_session_id,
    user_id,
    pack_id,
    amount_cents,
    currency,
    status,
    stripe_payment_intent_id,
    stripe_customer_id,
    paid_at,
    updated_at
  ) values (
    p_checkout_session_id,
    p_user_id,
    p_pack_id,
    p_amount_cents,
    lower(p_currency),
    'paid',
    p_payment_intent_id,
    p_stripe_customer_id,
    now(),
    now()
  )
  on conflict (checkout_session_id) do update
    set status = 'paid',
        stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, public.lmiere_stripe_checkouts.stripe_payment_intent_id),
        stripe_customer_id = coalesce(excluded.stripe_customer_id, public.lmiere_stripe_checkouts.stripe_customer_id),
        paid_at = coalesce(public.lmiere_stripe_checkouts.paid_at, now()),
        updated_at = now()
    where public.lmiere_stripe_checkouts.user_id = excluded.user_id
      and public.lmiere_stripe_checkouts.pack_id = excluded.pack_id
      and public.lmiere_stripe_checkouts.amount_cents = excluded.amount_cents
      and public.lmiere_stripe_checkouts.currency = excluded.currency
  returning * into v_checkout;

  if not found then
    raise exception 'stripe_checkout_mismatch' using errcode = 'P0001';
  end if;

  if v_checkout.credited_at is not null then
    return jsonb_build_object('applied', false, 'duplicateCheckout', true);
  end if;

  update public.lmiere_wallets
    set balance_cents = balance_cents + p_amount_cents,
        updated_at = now()
    where user_id = p_user_id;

  insert into public.lmiere_wallet_ledger (
    user_id, kind, balance_delta_cents, note
  ) values (
    p_user_id,
    'purchase',
    p_amount_cents,
    'Stripe credit purchase / ' || p_pack_id
  );

  update public.lmiere_stripe_checkouts
    set credited_at = now(),
        updated_at = now()
    where checkout_session_id = p_checkout_session_id
    returning * into v_checkout;

  return jsonb_build_object(
    'applied', true,
    'checkoutSessionId', v_checkout.checkout_session_id,
    'amountCents', v_checkout.amount_cents
  );
end;
$$;

revoke execute on function public.lmiere_credit_stripe_checkout(text, text, text, text, text, uuid, text, integer, text) from public;

commit;
