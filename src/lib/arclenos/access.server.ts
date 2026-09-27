import { createHash, timingSafeEqual } from 'node:crypto';
import { getRequest } from '@tanstack/react-start/server';
import { getSql } from '../db';
import { AccessError, assertOrigin, assertRole, type Permission } from './access-policy';

export function matchesServiceToken(actual: string | null, expected: string | undefined) {
  if (!expected || expected.length < 32 || !actual) return false;
  const a = createHash('sha256').update(actual).digest();
  const b = createHash('sha256').update(`Bearer ${expected}`).digest();
  return timingSafeEqual(a, b);
}

export async function enforceRequestLimit(request: Request, bucket: string, limit = 60, windowSeconds = 60) {
  // A global bucket is deliberate when no trusted edge identifier exists; forged
  // forwarded headers must never let a caller bypass a deployment-wide quota.
  const trustedIp = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') : null;
  const subject = createHash('sha256').update(trustedIp ?? 'deployment').digest('hex');
  const start = Math.floor(Date.now() / (windowSeconds * 1000));
  const sql = await getSql();
  const rows = await sql<{ count: number }>`insert into request_quotas(bucket,subject,window_start,count)
    values (${bucket},${subject},${start},1)
    on conflict(bucket,subject,window_start) do update set count=request_quotas.count+1
    where request_quotas.count < ${limit} returning count`;
  if (!rows.length) throw new AccessError('Request quota exceeded', 429);
}

export async function authorizeRequest(request: Request, permission: Permission) {
  assertOrigin(request, process.env.BETTER_AUTH_URL);
  await enforceRequestLimit(request, `access:${permission}`);
  if (permission === 'public') return { id: 'anonymous', role: 'public' };
  const service = matchesServiceToken(request.headers.get('authorization'), process.env.ARCLENOS_AGENT_TOKEN);
  let id: string | null = null;
  let roles: string[] = [];
  if (service) { id = 'service:agent'; roles = ['agent']; }
  else {
    // Direct session verification; never use the preview dev-user fallback.
    const { auth } = await import('../auth/server');
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    id = session?.user.id ?? null;
    if (id) {
      const sql = await getSql();
      roles = (await sql<{role:string}>`select role from arclenos_roles where user_id=${id}`).map(row => row.role);
    }
  }
  const sql = await getSql();
  let denied: unknown;
  try { assertRole(permission,id,roles); } catch (error) { denied = error; }
  await sql`insert into access_audit(id,actor_id,action,decision,request_id)
    values (${crypto.randomUUID()},${id ?? 'anonymous'},${permission},${denied ? 'DENY' : 'ALLOW'},${crypto.randomUUID()})`;
  if (denied) throw denied;
  return { id: id!, role: service ? 'agent' : permission };
}

export async function authorizeAction(permission: Permission) {
  return authorizeRequest(getRequest(), permission);
}
