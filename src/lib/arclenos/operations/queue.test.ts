import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { enqueue, claim, finish, workOnce, BlockedOperation, retryDelay, type Database } from './queue.ts';
import { rpcHealth, executeOperation, ROLE_SPECS } from './adapters.ts';
async function fixture() { const pg=new PGlite(); await pg.exec(await readFile(new URL('../../../../migrations/0006_operations.sql',import.meta.url),'utf8')); const db:Database={query:async <T>(sql:string,params:unknown[]=[]) =>(await pg.query<T>(sql,params)).rows}; return {pg,db}; }
test('idempotency, exclusive claims, stale-worker fencing, expired lease recovery',async()=>{ const {pg,db}=await fixture(); try {
 const a=await enqueue(db,'audit.daily','same'); assert.equal((await enqueue(db,'audit.daily','same')).id,a.id);
 const [one,two]=await Promise.all([claim(db),claim(db)]); assert.equal([one,two].filter(Boolean).length,1); const first=(one ?? two)!;
 await db.query(`UPDATE operation_jobs SET lease_until=now()-interval '1 second' WHERE id=$1`,[a.id]);
 const next=(await claim(db))!; assert.equal(next.attempts,2); assert.notEqual(next.lease_token,first.lease_token);
 assert.equal(await finish(db,first,'SUCCEEDED',{}),false); assert.equal(await finish(db,next,'SUCCEEDED',{receipt:'verified'}),true);
 const attempts=await db.query('SELECT outcome FROM operation_attempts ORDER BY attempt'); assert.deepEqual(attempts.map(x=>x.outcome),['LEASE_EXPIRED','SUCCEEDED']);
 } finally {await pg.close();} });
test('retry backoff and explicit unsupported role blockage',async()=>{const {pg,db}=await fixture(); try {
 await enqueue(db,'missing','retry'); const failed=await workOnce(db,async()=>{throw new Error('secret must not leak');}); assert.equal(failed.status,'RETRY'); assert.doesNotMatch(JSON.stringify(failed),/secret/); assert.equal(await claim(db),undefined);
 await enqueue(db,'launch','blocked'); assert.equal((await workOnce(db,async()=>{throw new BlockedOperation('Signer is not configured');})).status,'BLOCKED'); assert.equal(retryDelay(20),3600); assert.equal(Object.keys(ROLE_SPECS).length,17);
 } finally {await pg.close();}});
test('RPC failover verifies Base chain and stores verified adapter evidence',async()=>{const {pg,db}=await fixture(); try {
 let calls=0; const fetcher:typeof fetch=async()=>{calls++; return Response.json([{id:1,result:calls===1?'0x1':'0x2105'},{id:2,result:'0x123'}]);};
 const result=await rpcHealth(db,new AbortController().signal,['https://first.example','https://second.example'],fetcher); assert.equal(result.failoverPerformed,true); assert.equal(result.chainId,8453); assert.equal(calls,2);
 assert.equal((await db.query('SELECT failures FROM operation_health WHERE adapter=$1',['base-rpc-1']))[0].failures,0);
 }finally{await pg.close();}});
test('daily audit explicitly records unverified domains',async()=>{const {pg,db}=await fixture();try{await enqueue(db,'audit.daily','audit'); const result=await workOnce(db,(job,signal)=>executeOperation(db,job,signal));assert.equal(result.status,'SUCCEEDED'); const rows=await db.query('SELECT status,evidence FROM operation_audits'); assert.equal(rows[0].status,'LIMITED'); assert.match(JSON.stringify(rows[0].evidence),/contracts/);}finally{await pg.close();}});
test('last crashed lease is terminal and does not remain RUNNING',async()=>{const {pg,db}=await fixture();try{
 const job=await enqueue(db,'rpc.health','exhausted');await db.query('UPDATE operation_jobs SET max_attempts=1 WHERE id=$1',[job.id]);await claim(db);
 await db.query(`UPDATE operation_jobs SET lease_until=now()-interval '1 second' WHERE id=$1`,[job.id]); assert.equal(await claim(db),undefined);
 assert.equal((await db.query('SELECT state FROM operation_jobs WHERE id=$1',[job.id]))[0].state,'FAILED');
 assert.equal((await db.query('SELECT outcome FROM operation_attempts WHERE job_id=$1',[job.id]))[0].outcome,'LEASE_EXPIRED');
 }finally{await pg.close();}});
test('bounded timeout aborts adapter and persists retry without success',async()=>{const {pg,db}=await fixture();try{
 await enqueue(db,'rpc.health','timeout');let aborted=false;
 const result=await workOnce(db,async(_job,signal)=>{signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});},20);
 assert.equal(result.status,'RETRY');assert.equal(aborted,true);
 }finally{await pg.close();}});
