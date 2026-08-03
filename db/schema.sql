begin;

create extension if not exists pgcrypto;

create table if not exists public.lmiere_profiles (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lmiere_wallets (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  reserved_cents integer not null default 0 check (reserved_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_cents <= balance_cents)
);

create table if not exists public.lmiere_account_grants (
  email text primary key check (email = lower(email)),
  credit_cents integer not null check (credit_cents > 0),
  from_name text not null default 'Lmiere',
  message text not null,
  claimed_by_user_id uuid references neon_auth."user"(id) on delete set null,
  claimed_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((claimed_at is null and claimed_by_user_id is null) or claimed_at is not null)
);

create unique index if not exists lmiere_account_grants_claimed_user_idx
  on public.lmiere_account_grants (claimed_by_user_id)
  where claimed_by_user_id is not null;

create table if not exists public.lmiere_generations (
  id text primary key,
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  outcome text not null check (outcome in ('fast', 'cinematic', 'quality')),
  model text not null,
  prompt text not null check (char_length(prompt) between 1 and 2000),
  status text not null default 'reserved'
    check (status in ('reserved', 'queued', 'in_queue', 'in_progress', 'complete', 'failed', 'cancelled')),
  charge_cents integer not null check (charge_cents > 0),
  provider_request_id text,
  progress smallint not null default 0 check (progress between 0 and 100),
  result_url text,
  provider_result_url text,
  result_content_type text,
  provider_payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists lmiere_generations_user_created_idx
  on public.lmiere_generations (user_id, created_at desc);

create unique index if not exists lmiere_generations_provider_request_idx
  on public.lmiere_generations (provider_request_id)
  where provider_request_id is not null;

create table if not exists public.lmiere_wallet_ledger (
  id bigserial primary key,
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  generation_id text references public.lmiere_generations(id) on delete restrict,
  kind text not null check (kind in ('initial_credit', 'founder_gift', 'credit', 'purchase', 'reserve', 'settle', 'release', 'refund')),
  balance_delta_cents integer not null default 0,
  reserved_delta_cents integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table public.lmiere_wallet_ledger
  drop constraint if exists lmiere_wallet_ledger_kind_check;

alter table public.lmiere_wallet_ledger
  add constraint lmiere_wallet_ledger_kind_check
  check (kind in ('initial_credit', 'founder_gift', 'credit', 'purchase', 'reserve', 'settle', 'release', 'refund'));

create index if not exists lmiere_wallet_ledger_user_created_idx
  on public.lmiere_wallet_ledger (user_id, created_at desc);

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

create table if not exists public.lmiere_email_events (
  id bigserial primary key,
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  kind text not null check (kind in ('welcome', 'founder_signup')),
  recipient text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'delivered', 'bounced', 'complained', 'suppressed')),
  provider_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

create unique index if not exists lmiere_email_events_provider_idx
  on public.lmiere_email_events (provider_id)
  where provider_id is not null;

create table if not exists public.lmiere_email_webhook_events (
  event_id text primary key,
  provider_id text,
  event_type text not null,
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.lmiere_ensure_wallet(
  p_user_id uuid,
  p_initial_credit_cents integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, neon_auth
as $$
declare
  v_email text;
  v_name text;
  v_inserted integer := 0;
  v_prior_credit_cents integer := 0;
  v_credit_delta_cents integer := 0;
  v_grant public.lmiere_account_grants%rowtype;
  v_has_grant boolean := false;
  v_wallet public.lmiere_wallets%rowtype;
begin
  select email, coalesce(name, '')
    into v_email, v_name
    from neon_auth."user"
    where id = p_user_id
      and coalesce(banned, false) = false
      and "emailVerified" is true;

  if not found then
    raise exception 'email_verification_required' using errcode = 'P0001';
  end if;

  insert into public.lmiere_profiles (user_id, email, display_name)
  values (p_user_id, v_email, v_name)
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now();

  select * into v_grant
    from public.lmiere_account_grants
    where email = lower(v_email)
      and (claimed_at is null or claimed_by_user_id = p_user_id)
    for update;
  v_has_grant := found;

  insert into public.lmiere_wallets (user_id, balance_cents)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_has_grant and v_grant.claimed_at is null then
    select coalesce(sum(greatest(balance_delta_cents, 0)), 0)::integer
      into v_prior_credit_cents
      from public.lmiere_wallet_ledger
      where user_id = p_user_id;

    v_credit_delta_cents := greatest(v_grant.credit_cents - v_prior_credit_cents, 0);

    if v_credit_delta_cents > 0 then
      update public.lmiere_wallets
        set balance_cents = balance_cents + v_credit_delta_cents,
            updated_at = now()
        where user_id = p_user_id;

      insert into public.lmiere_wallet_ledger (
        user_id, kind, balance_delta_cents, note
      ) values (
        p_user_id,
        'founder_gift',
        v_credit_delta_cents,
        'Founder allocation from ' || v_grant.from_name
      );
    end if;

    update public.lmiere_account_grants
      set claimed_by_user_id = p_user_id,
          claimed_at = now(),
          updated_at = now()
      where email = v_grant.email
      returning * into v_grant;
  elsif v_inserted = 1 and p_initial_credit_cents > 0 then
    update public.lmiere_wallets
      set balance_cents = greatest(p_initial_credit_cents, 0),
          updated_at = now()
      where user_id = p_user_id;

    insert into public.lmiere_wallet_ledger (
      user_id, kind, balance_delta_cents, note
    ) values (
      p_user_id, 'initial_credit', p_initial_credit_cents, 'Private test wallet'
    );
  end if;

  select * into v_wallet
    from public.lmiere_wallets
    where user_id = p_user_id;

  return jsonb_build_object(
    'userId', p_user_id,
    'email', v_email,
    'displayName', v_name,
    'balanceCents', v_wallet.balance_cents,
    'reservedCents', v_wallet.reserved_cents,
    'availableCents', v_wallet.balance_cents - v_wallet.reserved_cents,
    'gift', case
      when v_has_grant
        and v_grant.claimed_by_user_id = p_user_id
        and v_grant.acknowledged_at is null
      then jsonb_build_object(
        'creditCents', v_grant.credit_cents,
        'fromName', v_grant.from_name,
        'message', v_grant.message
      )
      else null
    end
  );
end;
$$;

create or replace function public.lmiere_acknowledge_account_grant(
  p_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lmiere_account_grants
    set acknowledged_at = coalesce(acknowledged_at, now()),
        updated_at = now()
    where claimed_by_user_id = p_user_id
      and claimed_at is not null
      and acknowledged_at is null;

  return found;
end;
$$;

create or replace function public.lmiere_reserve_generation_v2(
  p_generation_id text,
  p_user_id uuid,
  p_outcome text,
  p_model text,
  p_prompt text,
  p_charge_cents integer,
  p_initial_credit_cents integer default 0,
  p_user_daily_limit_cents integer default 0,
  p_global_daily_limit_cents integer default 0,
  p_max_active_generations integer default 2
) returns jsonb
language plpgsql
security definer
set search_path = public, neon_auth
as $$
declare
  v_wallet public.lmiere_wallets%rowtype;
  v_generation public.lmiere_generations%rowtype;
  v_user_daily_cents integer := 0;
  v_global_daily_cents integer := 0;
  v_active_generations integer := 0;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  perform public.lmiere_ensure_wallet(p_user_id, p_initial_credit_cents);

  -- One global lock makes daily cost caps reliable even when several users submit together.
  perform pg_advisory_xact_lock(4152862001::bigint);

  select * into v_wallet
    from public.lmiere_wallets
    where user_id = p_user_id
    for update;

  select count(*)::integer into v_active_generations
    from public.lmiere_generations
    where user_id = p_user_id
      and status in ('reserved', 'queued', 'in_queue', 'in_progress');

  if p_max_active_generations > 0 and v_active_generations >= p_max_active_generations then
    raise exception 'too_many_active_generations' using errcode = 'P0001';
  end if;

  select coalesce(sum(charge_cents), 0)::integer into v_user_daily_cents
    from public.lmiere_generations
    where user_id = p_user_id
      and created_at >= v_day_start
      and status not in ('failed', 'cancelled');

  if p_user_daily_limit_cents > 0
     and v_user_daily_cents + p_charge_cents > p_user_daily_limit_cents then
    raise exception 'user_daily_limit_reached' using errcode = 'P0001';
  end if;

  select coalesce(sum(charge_cents), 0)::integer into v_global_daily_cents
    from public.lmiere_generations
    where created_at >= v_day_start
      and status not in ('failed', 'cancelled');

  if p_global_daily_limit_cents > 0
     and v_global_daily_cents + p_charge_cents > p_global_daily_limit_cents then
    raise exception 'global_daily_limit_reached' using errcode = 'P0001';
  end if;

  if v_wallet.balance_cents - v_wallet.reserved_cents < p_charge_cents then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into public.lmiere_generations (
    id, user_id, outcome, model, prompt, charge_cents
  ) values (
    p_generation_id, p_user_id, p_outcome, p_model, p_prompt, p_charge_cents
  ) returning * into v_generation;

  update public.lmiere_wallets
    set reserved_cents = reserved_cents + p_charge_cents,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

  insert into public.lmiere_wallet_ledger (
    user_id, generation_id, kind, reserved_delta_cents, note
  ) values (
    p_user_id, p_generation_id, 'reserve', p_charge_cents, 'Generation approved'
  );

  return jsonb_build_object(
    'generation', to_jsonb(v_generation),
    'wallet', jsonb_build_object(
      'balanceCents', v_wallet.balance_cents,
      'reservedCents', v_wallet.reserved_cents,
      'availableCents', v_wallet.balance_cents - v_wallet.reserved_cents
    )
  );
end;
$$;

create or replace function public.lmiere_reserve_generation(
  p_generation_id text,
  p_user_id uuid,
  p_outcome text,
  p_model text,
  p_prompt text,
  p_charge_cents integer,
  p_initial_credit_cents integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, neon_auth
as $$
declare
  v_wallet public.lmiere_wallets%rowtype;
  v_generation public.lmiere_generations%rowtype;
begin
  perform public.lmiere_ensure_wallet(p_user_id, p_initial_credit_cents);

  select * into v_wallet
    from public.lmiere_wallets
    where user_id = p_user_id
    for update;

  if v_wallet.balance_cents - v_wallet.reserved_cents < p_charge_cents then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into public.lmiere_generations (
    id, user_id, outcome, model, prompt, charge_cents
  ) values (
    p_generation_id, p_user_id, p_outcome, p_model, p_prompt, p_charge_cents
  ) returning * into v_generation;

  update public.lmiere_wallets
    set reserved_cents = reserved_cents + p_charge_cents,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

  insert into public.lmiere_wallet_ledger (
    user_id, generation_id, kind, reserved_delta_cents, note
  ) values (
    p_user_id, p_generation_id, 'reserve', p_charge_cents, 'Generation approved'
  );

  return jsonb_build_object(
    'generation', to_jsonb(v_generation),
    'wallet', jsonb_build_object(
      'balanceCents', v_wallet.balance_cents,
      'reservedCents', v_wallet.reserved_cents,
      'availableCents', v_wallet.balance_cents - v_wallet.reserved_cents
    )
  );
end;
$$;

create or replace function public.lmiere_release_generation(
  p_generation_id text,
  p_user_id uuid,
  p_status text,
  p_error text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generation public.lmiere_generations%rowtype;
  v_wallet public.lmiere_wallets%rowtype;
begin
  select * into v_generation
    from public.lmiere_generations
    where id = p_generation_id and user_id = p_user_id
    for update;

  if not found then
    raise exception 'generation_not_found' using errcode = 'P0001';
  end if;

  if v_generation.status in ('complete', 'failed', 'cancelled') then
    return to_jsonb(v_generation);
  end if;

  update public.lmiere_wallets
    set reserved_cents = greatest(reserved_cents - v_generation.charge_cents, 0),
        updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

  update public.lmiere_generations
    set status = case when p_status = 'cancelled' then 'cancelled' else 'failed' end,
        error = left(coalesce(p_error, 'Generation failed'), 1000),
        updated_at = now(),
        completed_at = now()
    where id = p_generation_id
    returning * into v_generation;

  insert into public.lmiere_wallet_ledger (
    user_id, generation_id, kind, reserved_delta_cents, note
  ) values (
    p_user_id, p_generation_id, 'release', -v_generation.charge_cents, 'Charge released'
  );

  return to_jsonb(v_generation);
end;
$$;

create or replace function public.lmiere_settle_generation(
  p_generation_id text,
  p_user_id uuid,
  p_result_url text,
  p_provider_result_url text,
  p_content_type text,
  p_provider_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generation public.lmiere_generations%rowtype;
begin
  select * into v_generation
    from public.lmiere_generations
    where id = p_generation_id and user_id = p_user_id
    for update;

  if not found then
    raise exception 'generation_not_found' using errcode = 'P0001';
  end if;

  if v_generation.status = 'complete' then
    return to_jsonb(v_generation);
  end if;

  if v_generation.status in ('failed', 'cancelled') then
    raise exception 'generation_already_released' using errcode = 'P0001';
  end if;

  update public.lmiere_wallets
    set balance_cents = balance_cents - v_generation.charge_cents,
        reserved_cents = reserved_cents - v_generation.charge_cents,
        updated_at = now()
    where user_id = p_user_id;

  update public.lmiere_generations
    set status = 'complete',
        progress = 100,
        result_url = p_result_url,
        provider_result_url = p_provider_result_url,
        result_content_type = p_content_type,
        provider_payload = p_provider_payload,
        error = null,
        updated_at = now(),
        completed_at = now()
    where id = p_generation_id
    returning * into v_generation;

  insert into public.lmiere_wallet_ledger (
    user_id, generation_id, kind, balance_delta_cents, reserved_delta_cents, note
  ) values (
    p_user_id,
    p_generation_id,
    'settle',
    -v_generation.charge_cents,
    -v_generation.charge_cents,
    'Completed generation'
  );

  return to_jsonb(v_generation);
end;
$$;

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

revoke execute on function public.lmiere_ensure_wallet(uuid, integer) from public;
revoke execute on function public.lmiere_reserve_generation(text, uuid, text, text, text, integer, integer) from public;
revoke execute on function public.lmiere_reserve_generation_v2(text, uuid, text, text, text, integer, integer, integer, integer, integer) from public;
revoke execute on function public.lmiere_release_generation(text, uuid, text, text) from public;
revoke execute on function public.lmiere_settle_generation(text, uuid, text, text, text, jsonb) from public;
revoke execute on function public.lmiere_credit_stripe_checkout(text, text, text, text, text, uuid, text, integer, text) from public;

commit;
