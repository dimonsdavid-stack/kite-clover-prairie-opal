import { randomUUID } from 'node:crypto';
export interface Database { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> }
export interface Job { id: string; kind: string; input: Record<string, unknown>; state: string; attempts: number; max_attempts: number; lease_token: string; }
export class BlockedOperation extends Error {}
export function retryDelay(attempt: number) { return Math.min(3600, 5 * 2 ** Math.max(0, attempt - 1)); }
export async function enqueue(db: Database, kind: string, key: string, input: Record<string, unknown> = {}) {
 if (!kind || !key || key.length > 240) throw new Error('Invalid job identity');
 const rows = await db.query<Job>(`INSERT INTO operation_jobs(id,kind,idempotency_key,input) VALUES($1,$2,$3,$4::jsonb)
 ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`, [randomUUID(),kind,key,JSON.stringify(input)]);
 return rows[0];
}
/** Claim and attempt insertion are one atomic statement. Token is a fencing capability. */
export async function claim(db: Database, leaseSeconds = 60): Promise<Job | undefined> {
 if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 300) throw new Error('Invalid lease');
 // Expired final attempts must become terminal instead of lingering forever.
 await db.query(`WITH expired AS (UPDATE operation_jobs SET state='FAILED',error='Worker lease expired at retry limit',lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE state='RUNNING' AND lease_until<now() AND attempts>=max_attempts RETURNING id)
 UPDATE operation_attempts SET outcome='LEASE_EXPIRED',finished_at=now(),error='Worker lease expired' WHERE finished_at IS NULL AND job_id IN (SELECT id FROM expired)`);
 const rows = await db.query<Job>(`WITH candidate AS (
 SELECT id FROM operation_jobs WHERE ((state IN ('QUEUED','RETRY') AND available_at<=now()) OR (state='RUNNING' AND lease_until<now()))
 AND attempts<max_attempts ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
 ), claimed AS (UPDATE operation_jobs j SET state='RUNNING',attempts=attempts+1,lease_token=$1,
 lease_until=now()+($2::integer * interval '1 second'),updated_at=now() FROM candidate c WHERE j.id=c.id RETURNING j.*),
 expired AS (UPDATE operation_attempts SET outcome='LEASE_EXPIRED',finished_at=now(),error='Worker lease expired'
 WHERE finished_at IS NULL AND job_id IN(SELECT id FROM claimed) RETURNING id),
 attempt AS (INSERT INTO operation_attempts(id,job_id,attempt,lease_token) SELECT $3,id,attempts,lease_token FROM claimed RETURNING id)
 SELECT * FROM claimed`,[randomUUID(),leaseSeconds,randomUUID()]);
 return rows[0];
}
export async function finish(db: Database, job: Job, outcome: 'SUCCEEDED'|'RETRY'|'FAILED'|'BLOCKED', evidence: unknown, error?: string) {
 const rows = await db.query(`WITH finished AS (UPDATE operation_jobs SET state=$3,result=$4::jsonb,error=$5,
 available_at=now()+($6::integer * interval '1 second'),lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE id=$1 AND lease_token=$2 AND state='RUNNING' AND lease_until>now() RETURNING id)
 UPDATE operation_attempts SET outcome=$3,evidence=$4::jsonb,error=$5,finished_at=now()
 WHERE lease_token=$2 AND job_id IN(SELECT id FROM finished) RETURNING id`,[job.id,job.lease_token,outcome,JSON.stringify(evidence ?? null),error?.slice(0,1000) ?? null,retryDelay(job.attempts)]);
 return rows.length === 1;
}
export type Handler = (job: Job, signal: AbortSignal) => Promise<unknown>;
export async function workOnce(db: Database, handler: Handler, timeoutMs = 20000) {
 const job = await claim(db, Math.ceil(timeoutMs / 1000) + 15);
 if (!job) return { status: 'IDLE' };
 const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  const result = await Promise.race([handler(job,controller.signal),new Promise<never>((_,reject)=>{ timer=setTimeout(()=>{controller.abort(); reject(new Error('Operation timed out'));},timeoutMs); })]);
  const persisted = await finish(db,job,'SUCCEEDED',result);
  return { job: job.id, status: persisted ? 'SUCCEEDED' : 'LEASE_LOST', evidence: result };
 } catch(error) {
  const status = error instanceof BlockedOperation ? 'BLOCKED' : job.attempts>=job.max_attempts ? 'FAILED' : 'RETRY';
  // Adapter errors must contain safe diagnostics only, never URL credentials or response bodies.
  const message = error instanceof BlockedOperation ? error.message : 'Operation failed; inspect adapter health and attempt evidence';
  const persisted = await finish(db,job,status,null,message);
  return { job: job.id, status: persisted ? status : 'LEASE_LOST', error: message };
 } finally { if(timer) clearTimeout(timer); controller.abort(); }
}
