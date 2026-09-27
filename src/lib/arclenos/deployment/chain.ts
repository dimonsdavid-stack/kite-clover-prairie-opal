import { encodeFunctionData, decodeFunctionResult, parseAbi, keccak256, type Address, type Hex } from 'viem';
import type { Database } from '../operations/queue.ts';
export const FACTORY_ABI=parseAbi([
 'function deploy(bytes32 template,uint32 version,bytes32 userSalt,address owner,address guardian,address parent,bytes config) returns (address)',
 'function predict(bytes32 template,uint32 version,address creator,bytes32 userSalt) view returns (address)',
 'function registry() view returns (address)',
 'function emergency() view returns (address)',
 'function hasRole(bytes32 role,address account) view returns (bool)',
 'event VentureDeployed(address indexed venture,address indexed creator,bytes32 indexed template,uint32 version,bytes32 salt,bytes32 configHash)',
]);
export const MODULE_ABI=parseAbi(['function owner() view returns (address)','function guardian() view returns (address)','function initialized() view returns (bool)','function asset() view returns (address)','function cap() view returns (uint256)']);
export const REGISTRY_ABI=parseAbi(['function resolve(bytes32 template,uint32 version) view returns (address)']);
export const EMERGENCY_ABI=parseAbi(['function paused() view returns (bool)']);
export class DeploymentError extends Error { status: number; constructor(message: string,status=409){super(message);this.status=status;} }
export type Rpc = (method:string,params:unknown[])=>Promise<unknown>;
export function address(value:unknown): Address {if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value))throw new DeploymentError('Invalid address',400);return value.toLowerCase() as Address;}
export function hash(value:unknown): Hex {if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))throw new DeploymentError('Invalid hash',400);return value.toLowerCase() as Hex;}
export const ZERO='0x0000000000000000000000000000000000000000' as Address;
export function nonzero(value:unknown): Address {const result=address(value);if(result===ZERO)throw new DeploymentError('Zero authority or asset address',400);return result;}
export function same(a:unknown,b:unknown){return typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();}
/** Every selected provider must itself attest Base; fallback performs the actual RPC request. */
export function createRpc(db: Database,endpoints:string[],signal=AbortSignal.timeout(20000),fetcher:typeof fetch=fetch): Rpc {
 return async(method,params)=>{
  if(!endpoints.length)throw new DeploymentError('BASE_RPC_URL is not configured',503);
  for(let i=0;i<endpoints.length;i++) {
   const endpoint=endpoints[i];if(new URL(endpoint).protocol!=='https:')continue;
   try {
    const response=await fetcher(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify([{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]},{jsonrpc:'2.0',id:2,method,params}]),signal:AbortSignal.any([signal,AbortSignal.timeout(7000)])});
    if(!response.ok)continue;
    const rows=await response.json() as Array<{id:number;result?:unknown;error?:unknown}>;
    const result=rows.find(row=>row.id===2);
    if(rows.find(row=>row.id===1)?.result!=='0x2105'||!result||result.error)continue;
    await db.query(`INSERT INTO operation_health(adapter,failures,last_success,evidence) VALUES($1,0,now(),$2::jsonb)
 ON CONFLICT(adapter) DO UPDATE SET failures=0,last_success=now(),evidence=$2::jsonb,updated_at=now()`,[`deployment-rpc-${i}`,JSON.stringify({chainId:8453,method,failoverPerformed:i>0})]);
    return result.result;
   } catch {if(signal.aborted)break;}
  }
  throw new DeploymentError('Configured Base RPC providers failed verification or rejected the request',503);
 };
}
export interface FactoryConfig { address:Address; codeHash:Hex; implementations:ImplementationConfig[] }
export interface ImplementationConfig {template:Hex;version:number;address:Address;codeHash:Hex;asset:Address;maxCap:string}
export function loadFactoryConfig(env:Record<string,string|undefined>=process.env): FactoryConfig {
 if(!env.ARCLENOS_FACTORY_ADDRESS || !env.ARCLENOS_FACTORY_CODE_HASH)throw new DeploymentError('Verified factory deployment configuration missing',503);
 let rows:unknown;try{rows=JSON.parse(env.ARCLENOS_IMPLEMENTATIONS_JSON??'[]');}catch{throw new DeploymentError('Implementation manifest configuration invalid',503);}
 if(!Array.isArray(rows))throw new DeploymentError('Implementation manifest configuration invalid',503);
 const implementations=rows.map(row=>{if(!row||typeof row!=='object')throw new DeploymentError('Invalid implementation entry',503);const x=row as Record<string,unknown>;
 if(!Number.isInteger(x.version)||Number(x.version)<1||Number(x.version)>4294967295||typeof x.maxCap!=='string'||!/^\d+$/.test(x.maxCap)||BigInt(x.maxCap)<=0n)throw new DeploymentError('Invalid implementation policy',503);
 return {template:hash(x.template),version:Number(x.version),address:nonzero(x.address),codeHash:hash(x.codeHash),asset:nonzero(x.asset),maxCap:x.maxCap};});
 return {address:nonzero(env.ARCLENOS_FACTORY_ADDRESS),codeHash:hash(env.ARCLENOS_FACTORY_CODE_HASH),implementations};
}
export async function verifiedCode(rpc:Rpc,where:Address,expected:Hex,block='latest') {
 const code=await rpc('eth_getCode',[where,block]);
 if(typeof code!=='string'||!/^0x[0-9a-f]+$/i.test(code)||code==='0x'||keccak256(code as Hex)!==expected)throw new DeploymentError('Onchain bytecode does not match trusted deployment manifest');return code as Hex;
}
export async function getFactoryHealth(db:Database,env:Record<string,string|undefined>=process.env) {
 try {
 const config=loadFactoryConfig(env);const endpoints=[env.BASE_RPC_URL,env.BASE_RPC_FALLBACK_URL].filter((x):x is string=>Boolean(x));
 const rpc=createRpc(db,endpoints);const code=await verifiedCode(rpc,config.address,config.codeHash);
 const emergency=decodeFunctionResult({abi:FACTORY_ABI,functionName:'emergency',data:await rpc('eth_call',[{to:config.address,data:encodeFunctionData({abi:FACTORY_ABI,functionName:'emergency'})},'latest']) as Hex});
 const paused=decodeFunctionResult({abi:EMERGENCY_ABI,functionName:'paused',data:await rpc('eth_call',[{to:emergency,data:encodeFunctionData({abi:EMERGENCY_ABI,functionName:'paused'})},'latest']) as Hex});
 return {verified:true,deployed:true,chainId:8453,address:config.address,codeHash:keccak256(code),paused,operational:!paused,checkedAt:new Date().toISOString()};
 }catch(error){return {verified:false,deployed:false,chainId:8453,operational:false,reason:error instanceof DeploymentError?error.message:'Factory verification unavailable',checkedAt:new Date().toISOString()};}
}
