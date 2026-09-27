import { randomUUID } from 'node:crypto';
import { BlockedOperation, type Database, type Job } from './queue.ts';
export const ROLE_SPECS = Object.fromEntries([
 ['Scout','intelligence.ingest'],['Opportunity Engine','opportunity.rank'],['Venture Architect','architecture.propose'],
 ['Protocol Composer','composition.prepare'],['Economic Simulator','simulation.run'],['Security Sentinel','security.review'],
 ['Launch','deployment.reconcile'],['Capital','treasury.reconcile'],['Liquidity','liquidity.monitor'],['Distribution','distribution.propose'],
 ['Revenue','payment.reconcile'],['Treasury','treasury.reconcile'],['Auditor','audit.daily'],['Healing','rpc.health'],
 ['Optimization','optimization.propose'],['Guardian','policy.audit'],['Audit Oracle','audit.daily'],
].map(([role,kind])=>[role,{version:1,kind,inputSchema:{type:'object',additionalProperties:false},tools:['read-only configured adapters'],authority:'READ_ONLY',timeoutMs:20000,maxAttempts:3,costBudgetUsd:0,escalation:'BLOCKED requires operator configuration',states:['QUEUED','RUNNING','RETRY','SUCCEEDED','FAILED','BLOCKED']}])) ;
export function configuredRpcEndpoints(env: Record<string,string|undefined>) {
 const values = [env.BASE_RPC_URL,env.BASE_RPC_FALLBACK_URL].filter((x): x is string=>Boolean(x));
 return values.filter((value)=>{ try { return new URL(value).protocol==='https:'; } catch { return false; } });
}
async function health(db: Database,adapter: string,ok: boolean,evidence: unknown) {
 await db.query(`INSERT INTO operation_health(adapter,failures,last_success,last_error,evidence,circuit_until)
 VALUES($1,$2,CASE WHEN $3 THEN now() ELSE NULL END,CASE WHEN $3 THEN NULL ELSE 'Adapter request failed' END,$4::jsonb,NULL)
 ON CONFLICT(adapter) DO UPDATE SET failures=CASE WHEN $3 THEN 0 ELSE operation_health.failures+1 END,
 last_success=CASE WHEN $3 THEN now() ELSE operation_health.last_success END,last_error=CASE WHEN $3 THEN NULL ELSE 'Adapter request failed' END,
 circuit_until=CASE WHEN $3 THEN NULL WHEN operation_health.failures>=2 THEN now()+interval '5 minutes' ELSE NULL END,evidence=$4::jsonb,updated_at=now()`,[adapter,ok?0:1,ok,JSON.stringify(evidence)]);
}
async function circuitOpen(db: Database,adapter: string) {
 const rows=await db.query(`SELECT adapter FROM operation_health WHERE adapter=$1 AND circuit_until>now()`,[adapter]); return rows.length>0;
}
export async function rpcHealth(db: Database,signal: AbortSignal,endpoints: string[],fetcher: typeof fetch=fetch) {
 if(!endpoints.length) throw new BlockedOperation('BASE_RPC_URL is not configured with an HTTPS endpoint');
 const failures: string[]=[];
 for(let i=0;i<endpoints.length;i++) {
  const adapter=`base-rpc-${i}`;
  if(await circuitOpen(db,adapter)){ failures.push(`${adapter}: circuit open`); continue; }
  try {
   const response=await fetcher(endpoints[i],{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify([{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]},{jsonrpc:'2.0',id:2,method:'eth_blockNumber',params:[]}]),signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])});
   if(!response.ok) throw new Error('RPC HTTP failure');
   const data: Array<{id:number;result?:string}>=await response.json();
   const chain=data.find(row=>row.id===1)?.result; const block=data.find(row=>row.id===2)?.result;
   if(chain!=='0x2105' || !block || !/^0x[0-9a-f]+$/i.test(block)) throw new Error('Invalid Base RPC evidence');
   const evidence={chainId:8453,blockNumber:parseInt(block,16),adapter,failedAdapters:failures,failoverPerformed:i>0,verifiedAt:new Date().toISOString()};
   await health(db,adapter,true,evidence); return evidence;
  } catch { if(signal.aborted) throw new Error('Aborted'); failures.push(`${adapter}: unavailable or wrong chain`); await health(db,adapter,false,{reason:'RPC unavailable or wrong chain'}); }
 }
 throw new Error('All configured Base RPC endpoints unavailable');
}
export async function ingest(db: Database,signal: AbortSignal,fetcher: typeof fetch=fetch) {
 const adapter='defillama-protocols'; if(await circuitOpen(db,adapter)) throw new Error('Source circuit open');
 try {
  const response=await fetcher('https://api.llama.fi/protocols',{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
  if(!response.ok) throw new Error('Source HTTP failure');
  const body: unknown=await response.json(); if(!Array.isArray(body)) throw new Error('Source schema invalid');
  const now=new Date(); const bucket=now.toISOString().slice(0,13); let count=0;
  for(const value of body.filter((row)=>row && typeof row==='object' && Array.isArray(row.chains) && row.chains.includes('Base')).slice(0,100)) {
   if(signal.aborted) throw new Error('Aborted');
   const row=value as Record<string,unknown>; if(typeof row.slug!=='string' || typeof row.tvl!=='number' || !Number.isFinite(row.tvl)) continue;
   // TVL is protocol-wide unless chainTvls.Base is provided. No volume is invented.
   const chainTvls=row.chainTvls as Record<string,unknown>|undefined;
   const baseTvl=typeof chainTvls?.Base==='number' ? chainTvls.Base : null;
   await db.query(`INSERT INTO source_observations(id,source,source_key,observed_at,classification,confidence,payload,anomaly_flags)
 VALUES($1,'defillama',$2,$3,'OBSERVED',0.8,$4::jsonb,$5::jsonb) ON CONFLICT(source,source_key) DO NOTHING`,[randomUUID(),`${row.slug}:${bucket}`,now.toISOString(),JSON.stringify({slug:row.slug,name:row.name,protocolTvl:row.tvl,baseTvl,volume:null,sourceUrl:'https://api.llama.fi/protocols',timestampMeaning:'retrieved_at; upstream observation time unavailable'}),JSON.stringify(row.tvl<0?['NEGATIVE_TVL']:[])]); count++;
  }
  const evidence={source:adapter,observationsProcessed:count,observedAt:now.toISOString(),volume:'UNAVAILABLE'}; await health(db,adapter,true,evidence); return evidence;
 } catch(error) {await health(db,adapter,false,{reason:'Source HTTP or schema failure'}); throw error;}
}
export async function executeOperation(db: Database,job: Job,signal: AbortSignal,env: Record<string,string|undefined>=process.env): Promise<unknown> {
 if(job.kind==='rpc.health') return rpcHealth(db,signal,configuredRpcEndpoints(env));
 if(job.kind==='intelligence.ingest') return ingest(db,signal);
 if(job.kind==='deployment.reconcile') {
  const id=job.input.deploymentId;
  if(typeof id!=='string'||!id||id.length>100)throw new BlockedOperation('Invalid deployment job ID');
  const {loadFactoryConfig,createRpc}=await import('../deployment/chain');
  const {reconcileDeployment}=await import('../deployment/lifecycle');
  return reconcileDeployment(db,createRpc(db,configuredRpcEndpoints(env),signal),loadFactoryConfig(env),id);
 }
 if(job.kind==='payment.reconcile') {
  const {reconcileCommerce}=await import('../commerce/service.server');
  return reconcileCommerce();
 }
 if(job.kind==='audit.daily' || job.kind==='policy.audit') {
  const [jobs]=await db.query(`SELECT count(*) FILTER(WHERE state='FAILED')::integer AS failed,count(*) FILTER(WHERE state='RUNNING' AND lease_until<now())::integer AS expired FROM operation_jobs`);
  const unhealthy=await db.query(`SELECT adapter,failures,last_success,circuit_until FROM operation_health WHERE failures>0`);
  const [sources]=await db.query(`SELECT count(*)::integer AS observations,max(received_at) AS freshest FROM source_observations`);
  const evidence={scope:['job leases','source ingestion','adapter health'],unverified:['contracts','wallets','payments','revenue','liquidity','treasury','frontend','dependencies','referrals','conversion'],jobs,unhealthy,sources};
  const status=Number(jobs.failed)>0 || Number(jobs.expired)>0 || unhealthy.length>0 ? 'FAILED' : 'LIMITED';
  await db.query(`INSERT INTO operation_audits(id,job_id,status,evidence) VALUES($1,$2,$3,$4::jsonb)`,[randomUUID(),job.id,status,JSON.stringify(evidence)]); return {status,...evidence};
 }
 throw new BlockedOperation(`No verified execution adapter for ${job.kind}; operator integration required`);
}
