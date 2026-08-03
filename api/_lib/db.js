import { neon } from "@neondatabase/serverless";

let client;

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}

export function initialCreditCents() {
  const parsed = Number.parseInt(process.env.LMIERE_INITIAL_CREDIT_CENTS ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function nonNegativeInteger(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function userDailyLimitCents() {
  return nonNegativeInteger("LMIERE_DAILY_USER_LIMIT_CENTS", 500);
}

export function globalDailyLimitCents() {
  return nonNegativeInteger("LMIERE_DAILY_GLOBAL_LIMIT_CENTS", 2000);
}

export function maxActiveGenerations() {
  return nonNegativeInteger("LMIERE_MAX_ACTIVE_GENERATIONS", 2);
}

function mapGeneration(row) {
  if (!row) return null;
  return {
    id: row.id,
    outcome: row.outcome,
    model: row.model,
    prompt: row.prompt,
    status: row.status,
    chargeCents: row.charge_cents,
    progress: row.progress,
    resultUrl: row.result_url,
    resultContentType: row.result_content_type,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapLedgerEntry(row) {
  return {
    id: row.id,
    generationId: row.generation_id,
    kind: row.kind,
    balanceDeltaCents: row.balance_delta_cents,
    reservedDeltaCents: row.reserved_delta_cents,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function getAccount(userId) {
  const sql = db();
  const [accountRow] = await sql`
    select public.lmiere_ensure_wallet(${userId}::uuid, ${initialCreditCents()}::integer) as account
  `;
  const { gift = null, ...account } = accountRow.account;
  const runs = await sql`
    select id, outcome, model, prompt, status, charge_cents, progress,
           result_url, result_content_type, error, created_at, completed_at
      from public.lmiere_generations
      where user_id = ${userId}::uuid
      order by created_at desc
      limit 30
  `;
  const ledger = await sql`
    select id::text, generation_id, kind, balance_delta_cents,
           reserved_delta_cents, note, created_at
      from public.lmiere_wallet_ledger
      where user_id = ${userId}::uuid
      order by created_at desc
      limit 50
  `;
  return {
    account,
    gift,
    runs: runs.map(mapGeneration),
    ledger: ledger.map(mapLedgerEntry),
  };
}

export async function acknowledgeAccountGrant(userId) {
  const sql = db();
  const [row] = await sql`
    select public.lmiere_acknowledge_account_grant(${userId}::uuid) as acknowledged
  `;
  return row?.acknowledged === true;
}

export async function reserveGeneration({ id, userId, outcome, model, prompt, chargeCents }) {
  const sql = db();
  const [row] = await sql`
    select public.lmiere_reserve_generation_v2(
      ${id}, ${userId}::uuid, ${outcome}, ${model}, ${prompt},
      ${chargeCents}::integer,
      ${initialCreditCents()}::integer,
      ${userDailyLimitCents()}::integer,
      ${globalDailyLimitCents()}::integer,
      ${maxActiveGenerations()}::integer
    ) as reservation
  `;
  return row.reservation;
}

export async function claimEmailEvent({ userId, kind, recipient }) {
  const sql = db();
  const [row] = await sql`
    insert into public.lmiere_email_events (
      user_id, kind, recipient, status, attempts, updated_at
    ) values (
      ${userId}::uuid, ${kind}, ${recipient}, 'sending', 1, now()
    )
    on conflict (user_id, kind) do update
      set recipient = excluded.recipient,
          status = 'sending',
          attempts = public.lmiere_email_events.attempts + 1,
          last_error = null,
          next_attempt_at = null,
          updated_at = now()
      where (
        public.lmiere_email_events.status = 'failed'
        and coalesce(public.lmiere_email_events.next_attempt_at, now()) <= now()
      ) or (
        public.lmiere_email_events.status = 'sending'
        and public.lmiere_email_events.updated_at < now() - interval '5 minutes'
      )
    returning id::text, kind, recipient, attempts
  `;
  return row ?? null;
}

export async function markEmailEventSent(id, providerId) {
  const sql = db();
  await sql`
    update public.lmiere_email_events
      set status = 'sent',
          provider_id = ${providerId},
          sent_at = now(),
          last_error = null,
          next_attempt_at = null,
          updated_at = now()
      where id = ${id}::bigint
  `;
}

export async function markEmailEventFailed(id, error) {
  const sql = db();
  await sql`
    update public.lmiere_email_events
      set status = 'failed',
          last_error = left(${error}, 1000),
          next_attempt_at = now() + interval '15 minutes',
          updated_at = now()
      where id = ${id}::bigint
  `;
}

export async function recordEmailDeliveryEvent({ eventId, providerId, eventType, occurredAt }) {
  const sql = db();
  const [inserted] = await sql`
    insert into public.lmiere_email_webhook_events (
      event_id, provider_id, event_type, occurred_at
    ) values (
      ${eventId}, ${providerId}, ${eventType}, ${occurredAt}::timestamptz
    )
    on conflict (event_id) do nothing
    returning event_id
  `;
  if (!inserted || !providerId) return false;

  const status = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
    "email.failed": "failed",
  }[eventType];
  if (!status) return true;

  await sql`
    update public.lmiere_email_events
      set status = ${status},
          delivered_at = case when ${status} = 'delivered' then ${occurredAt}::timestamptz else delivered_at end,
          updated_at = now()
      where provider_id = ${providerId}
  `;
  return true;
}

export async function getDatabaseReadiness() {
  const sql = db();
  const [auth] = await sql`
    select email_and_password, email_provider, allow_localhost, webhook_config
      from neon_auth.project_config
      limit 1
  `;
  const [schema] = await sql`
    select
      to_regclass('public.lmiere_wallets') is not null as wallets,
      to_regclass('public.lmiere_account_grants') is not null as account_grants,
      to_regclass('public.lmiere_email_events') is not null as email_events,
      to_regprocedure('public.lmiere_acknowledge_account_grant(uuid)') is not null as grant_acknowledgement,
      to_regprocedure('public.lmiere_reserve_generation_v2(text,uuid,text,text,text,integer,integer,integer,integer,integer)') is not null as guarded_reservations
  `;
  const [users] = await sql`
    select
      count(*)::integer as total,
      count(*) filter (where "emailVerified" is true)::integer as verified
      from neon_auth."user"
  `;

  return {
    auth: {
      requireEmailVerification: auth?.email_and_password?.requireEmailVerification === true,
      verificationMethod: auth?.email_and_password?.emailVerificationMethod ?? null,
      customEmailProvider: auth?.email_provider?.type === "custom",
      localhostAllowed: auth?.allow_localhost === true,
      authWebhookEnabled: auth?.webhook_config?.enabled === true,
    },
    schema,
    users,
  };
}

export async function markGenerationQueued(id, userId, providerRequestId) {
  const sql = db();
  const [row] = await sql`
    update public.lmiere_generations
      set status = 'queued', provider_request_id = ${providerRequestId}, progress = 5, updated_at = now()
      where id = ${id} and user_id = ${userId}::uuid and status = 'reserved'
      returning *
  `;
  return mapGeneration(row);
}

export async function getGeneration(id, userId) {
  const sql = db();
  const [row] = await sql`
    select * from public.lmiere_generations
      where id = ${id} and user_id = ${userId}::uuid
  `;
  return row ?? null;
}

export async function updateGenerationProgress(id, userId, status, progress) {
  const sql = db();
  const [row] = await sql`
    update public.lmiere_generations
      set status = ${status}, progress = greatest(progress, ${progress}::smallint), updated_at = now()
      where id = ${id} and user_id = ${userId}::uuid
        and status not in ('complete', 'failed', 'cancelled')
      returning *
  `;
  return mapGeneration(row);
}

export async function releaseGeneration(id, userId, status, error) {
  const sql = db();
  const [row] = await sql`
    select public.lmiere_release_generation(
      ${id}, ${userId}::uuid, ${status}, ${error}
    ) as generation
  `;
  return mapGeneration(row.generation);
}

export async function settleGeneration({
  id,
  userId,
  resultUrl,
  providerResultUrl,
  contentType,
  providerPayload,
}) {
  const sql = db();
  const [row] = await sql`
    select public.lmiere_settle_generation(
      ${id},
      ${userId}::uuid,
      ${resultUrl},
      ${providerResultUrl},
      ${contentType},
      ${JSON.stringify(providerPayload)}::jsonb
    ) as generation
  `;
  return mapGeneration(row.generation);
}

export { mapGeneration };
