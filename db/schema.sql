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
  kind text not null check (kind in ('initial_credit', 'credit', 'reserve', 'settle', 'release', 'refund')),
  balance_delta_cents integer not null default 0,
  reserved_delta_cents integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists lmiere_wallet_ledger_user_created_idx
  on public.lmiere_wallet_ledger (user_id, created_at desc);

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
  v_wallet public.lmiere_wallets%rowtype;
begin
  select email, coalesce(name, '')
    into v_email, v_name
    from neon_auth."user"
    where id = p_user_id and coalesce(banned, false) = false;

  if not found then
    raise exception 'invalid_user' using errcode = 'P0001';
  end if;

  insert into public.lmiere_profiles (user_id, email, display_name)
  values (p_user_id, v_email, v_name)
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now();

  insert into public.lmiere_wallets (user_id, balance_cents)
  values (p_user_id, greatest(p_initial_credit_cents, 0))
  on conflict (user_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 and p_initial_credit_cents > 0 then
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
    'availableCents', v_wallet.balance_cents - v_wallet.reserved_cents
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

revoke execute on function public.lmiere_ensure_wallet(uuid, integer) from public;
revoke execute on function public.lmiere_reserve_generation(text, uuid, text, text, text, integer, integer) from public;
revoke execute on function public.lmiere_release_generation(text, uuid, text, text) from public;
revoke execute on function public.lmiere_settle_generation(text, uuid, text, text, text, jsonb) from public;

commit;
