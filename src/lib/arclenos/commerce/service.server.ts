import { HTTPFacilitatorClient } from '@x402/core/server';
import { z } from 'zod';
import { COMMERCE_SKUS } from '../catalog';
import { listOpportunities, listVentures, getOpportunity } from '../runtime.server';
import { simulateComposition, BASE_ASSUMPTIONS } from '../simulation';
import { reviewComposition } from '../security';
import { AccessError } from '../access-policy';
import { enforceRequestLimit } from '../access.server';
import { executePaid, json, NETWORK, USDC, type Requirement, type Purchase } from './core';
import { purchaseStore, reconciliationCandidates } from './store.server';
import { confirmUsdcSettlement } from './chain';
const archetype=z.enum(['yield-vault','launch-controller','x402-commerce','liquidity-router','market-instrument','attribution-network']);
const bps=z.number().int().min(0).max(10000);
const compositionSchema=z.object({archetype,primitives:z.array(z.string().min(1).max(80)).min(1).max(40),feeBps:z.object({protocol:bps,creator:bps,referrer:bps,builder:bps,treasury:bps}).refine(v=>Object.values(v).reduce((a,b)=>a+b,0)===10000),caps:z.object({maxTvlUsd:z.number().finite().min(0).max(1e9),maxDepositUsd:z.number().finite().min(0).max(1e9),maxDailyOutflowUsd:z.number().finite().min(0).max(1e9)}),pauseGuards:z.boolean(),circuitBreaker:z.boolean()});
function configuration(){const treasury=process.env.ARCLENOS_TREASURY_ADDRESS;const facilitator=process.env.X402_FACILITATOR_URL;const rpcUrl=process.env.BASE_RPC_URL;const origin=process.env.ARCLENOS_PUBLIC_ORIGIN;const internal=process.env.ARCLENOS_INTERNAL_PAYER_ADDRESSES;
 if(!process.env.DATABASE_URL||!treasury||!/^0x[0-9a-fA-F]{40}$/.test(treasury)||/^0x0{40}$/i.test(treasury)||!facilitator||!rpcUrl||!origin||!internal)throw new Error('Commerce configuration incomplete');
 for(const url of [facilitator,rpcUrl,origin])if(new URL(url).protocol!=='https:')throw new Error('HTTPS required');
 const internalPayers=new Set(internal.split(',').map(x=>x.trim().toLowerCase()));for(const payer of internalPayers)if(!/^0x[0-9a-f]{40}$/.test(payer))throw new Error('Invalid internal payer');
 internalPayers.add(treasury.toLowerCase());
 const client=new HTTPFacilitatorClient({url:facilitator,timeoutMs:20000,createAuthHeaders:process.env.X402_FACILITATOR_BEARER?async()=>{const h={Authorization:`Bearer ${process.env.X402_FACILITATOR_BEARER}`};return{verify:h,settle:h,supported:h};}:undefined});
 const rpc=async(method:string,params:unknown[])=>{const r=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('RPC unavailable');const data=await r.json();if(data.error)throw new Error('RPC error');return data.result;};
 return{treasury,origin,client,rpc,internalPayers};}
export async function reconcileCommerce(){const config=configuration();const items=await reconciliationCandidates();let confirmed=0;for(const purchase of items){try{const evidence=await confirmUsdcSettlement(config.rpc,purchase.settlement!,purchase);await purchaseStore.finish(purchase.id,evidence,!config.internalPayers.has(purchase.payer));confirmed++;}catch{/* Retain unresolved evidence for the next bounded reconciliation run. */}}return{examined:items.length,confirmed,unknownSettlementRequiresOperatorEvidence:true};}
async function fulfill(sku:string,body:unknown){if(sku==='intel.opportunity'){const {opportunityId}=body as {opportunityId:string};const opportunity=await getOpportunity(opportunityId);if(!opportunity)throw new Error('Opportunity unavailable');return{opportunity,analysisType:'deterministic-factor-brief',summary:`${opportunity.title}: score ${opportunity.score}; sourced from ${opportunity.source}`,freshness:opportunity.updatedAt};}const composition=(body as {composition:z.infer<typeof compositionSchema>}).composition;if(sku==='sim.stress')return{assumptionClass:'ASSUMED',assumptions:BASE_ASSUMPTIONS,scenarios:simulateComposition(composition)};if(sku==='risk.review')return{reviewType:'deterministic-configuration-review',onchainAudit:false,findings:reviewComposition(composition)};return{composition,simulation:simulateComposition(composition),security:reviewComposition(composition),deploymentStatus:'NOT_SUBMITTED',calldata:null,blocker:'A versioned implementation, initialization ABI and approved deployment authority are required for executable calldata.'};}
export async function handleCommerceRequest(request:Request):Promise<Response>{try{
 await enforceRequestLimit(request,'commerce',60,60);
 const url=new URL(request.url);const path=url.pathname;
 if(request.method==='GET'&&path==='/api/v1/pricing')return json({x402Version:2,network:NETWORK,asset:USDC,skus:COMMERCE_SKUS,facilitatorConfigured:!!process.env.X402_FACILITATOR_URL,liveSettlementVerified:false});
 if(request.method==='GET'&&path==='/api/v1/opportunities')return json({items:await listOpportunities(48)});
 if(request.method==='GET'&&path==='/api/v1/atlas')return json({items:await listVentures()});
 const sku=COMMERCE_SKUS.find(s=>s.resource===path);if(!sku)return json({error:'NOT_FOUND'},404);
 if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405,{'Allow':'POST'});
 let config:ReturnType<typeof configuration>;try{config=configuration();}catch{return json({error:'COMMERCE_NOT_COMMISSIONED',charged:false},503);}
 const reader=request.body?.getReader();let text='';let total=0;if(reader){const decoder=new TextDecoder();for(;;){const{done,value}=await reader.read();if(done)break;total+=value.length;if(total>32768){await reader.cancel();return json({error:'BODY_TOO_LARGE'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
 let body:unknown;try{body=JSON.parse(text||'{}');body=sku.id==='intel.brief'?z.object({opportunityId:z.string().min(1).max(200)}).strict().parse(body):z.object({composition:compositionSchema}).strict().parse(body);}catch{return json({error:'INVALID_REQUEST'},400);}
 const supported=await config.client.getSupported();if(!supported.kinds.some(k=>k.x402Version===2&&k.scheme==='exact'&&k.network===NETWORK))return json({error:'FACILITATOR_BASE_UNSUPPORTED'},503);
 const requirement:Requirement={scheme:'exact',network:NETWORK,asset:USDC,amount:String(Math.round(Number(sku.usdc)*1e6)),payTo:config.treasury,maxTimeoutSeconds:300,extra:{name:'USD Coin',version:'2'}};
 return await executePaid({request,body,sku:sku.id,requirement,resource:new URL(path,config.origin).href},{store:purchaseStore,verify:(p,r)=>config.client.verify(p,r),settle:(p,r)=>config.client.settle(p,r),confirm:(s,p:Purchase)=>confirmUsdcSettlement(config.rpc,s,p),fulfill:b=>fulfill(sku.id,b),internalPayers:config.internalPayers});
 }catch(error){if(error instanceof Response)return error;if(error instanceof AccessError)return json({error:'REQUEST_DENIED'},error.status);return json({error:'SERVICE_UNAVAILABLE'},503);}}
