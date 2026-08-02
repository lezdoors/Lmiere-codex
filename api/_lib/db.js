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

export async function getAccount(userId) {
  const sql = db();
  const [accountRow] = await sql`
    select public.lmiere_ensure_wallet(${userId}::uuid, ${initialCreditCents()}::integer) as account
  `;
  const runs = await sql`
    select id, outcome, model, prompt, status, charge_cents, progress,
           result_url, result_content_type, error, created_at, completed_at
      from public.lmiere_generations
      where user_id = ${userId}::uuid
      order by created_at desc
      limit 30
  `;
  return { account: accountRow.account, runs: runs.map(mapGeneration) };
}

export async function reserveGeneration({ id, userId, outcome, model, prompt, chargeCents }) {
  const sql = db();
  const [row] = await sql`
    select public.lmiere_reserve_generation(
      ${id}, ${userId}::uuid, ${outcome}, ${model}, ${prompt},
      ${chargeCents}::integer, ${initialCreditCents()}::integer
    ) as reservation
  `;
  return row.reservation;
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
