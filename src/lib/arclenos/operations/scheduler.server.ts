import { createHash, timingSafeEqual } from 'node:crypto';
import { getSql, dbSource } from '../../db';
import { enqueue, workOnce } from './queue';
import { executeOperation } from './adapters';
export function validSchedulerToken(request: Request, secret: string|undefined) {
 if(!secret || secret.length<32) return false;
 const incoming=request.headers.get('authorization') ?? '';
 return timingSafeEqual(createHash('sha256').update(incoming).digest(),createHash('sha256').update(`Bearer ${secret}`).digest());
}
export async function schedulerTick(request: Request) {
 if(!validSchedulerToken(request,process.env.CRON_SECRET)) return Response.json({error:'UNAUTHORIZED'},{status:401});
 if(dbSource!=='neon') return Response.json({error:'PERSISTENT_DATABASE_REQUIRED'},{status:503});
 const db=await getSql(); const now=new Date(); const quarter=Math.floor(now.getTime()/900000);
 for(const kind of ['intelligence.ingest','rpc.health']) await enqueue(db,kind,`${kind}:${quarter}`);
 await enqueue(db,'audit.daily',`audit.daily:${now.toISOString().slice(0,10)}`);
 const results=[]; const deadline=Date.now()+45000;
 for(let i=0;i<3 && Date.now()<deadline;i++) { const result=await workOnce(db,(job,signal)=>executeOperation(db,job,signal)); results.push(result); if(result.status==='IDLE') break; }
 return Response.json({timestamp:now.toISOString(),durability:'postgres',results});
}
