import { createHash } from 'node:crypto';
import { z } from 'zod';

export const NETWORK = 'eip155:8453' as const;
export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const atomic = z.string().regex(/^(0|[1-9][0-9]{0,77})$/);
export const requirementSchema = z.object({scheme:z.literal('exact'),network:z.literal(NETWORK),asset:address,amount:atomic,payTo:address,maxTimeoutSeconds:z.number().int().positive(),extra:z.record(z.string(),z.unknown())});
export type Requirement = z.infer<typeof requirementSchema>;
export const paymentSchema = z.object({x402Version:z.literal(2),accepted:requirementSchema,payload:z.object({signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),authorization:z.object({from:address,to:address,value:atomic,validAfter:atomic,validBefore:atomic,nonce:z.string().regex(/^0x[0-9a-fA-F]{64}$/)})}),resource:z.object({url:z.string()}).optional()});
export type Payment = z.infer<typeof paymentSchema>;
export type Settlement = {success:boolean;transaction:string;network:string;payer?:string};
export type Purchase = {id:string;fingerprint:string;requestHash:string;sku:string;payer:string;amount:string;referral:string|null;response:unknown;requirement:Requirement;state:string;settlement:Settlement|null;claimToken:string};
export interface Store {find(fingerprint:string):Promise<Purchase|null>;claim(purchase:Purchase):Promise<{created:boolean;purchase:Purchase}>;setSettlement(id:string,settlement:Settlement):Promise<void>;finish(id:string,evidence:unknown,eligible:boolean):Promise<void>;fail(id:string,state:string):Promise<void>;}
export interface Dependencies {store:Store;verify(payment:Payment,requirement:Requirement):Promise<{isValid:boolean;payer?:string}>;settle(payment:Payment,requirement:Requirement):Promise<Settlement>;confirm(settlement:Settlement,purchase:Purchase):Promise<unknown>;fulfill(input:unknown):Promise<unknown>;internalPayers:Set<string>;}
export const hash=(input:string)=>createHash('sha256').update(input).digest('hex');
export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
export function encode(value:unknown){return Buffer.from(JSON.stringify(value)).toString('base64');}
export function decodePayment(header:string,requirement:Requirement):Payment {
 if(header.length>16384||!/^[A-Za-z0-9+/]+={0,2}$/.test(header))throw new Error('Invalid payment header');
 const payment=paymentSchema.parse(JSON.parse(Buffer.from(header,'base64').toString('utf8')));
 const a=payment.payload.authorization;
 if(canonical(payment.accepted)!==canonical(requirement)||a.to.toLowerCase()!==requirement.payTo.toLowerCase()||a.value!==requirement.amount)throw new Error('Payment does not match requirement');
 return payment;
}
export function json(body:unknown,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});}
export async function executePaid(input:{request:Request;body:unknown;sku:string;requirement:Requirement;resource:string},deps:Dependencies):Promise<Response>{
 const {request,body,sku,requirement,resource}=input;
 const header=request.headers.get('payment-signature');
 if(!header){const challenge={x402Version:2,resource:{url:resource,mimeType:'application/json',description:sku},accepts:[requirement]};return json(challenge,402,{'PAYMENT-REQUIRED':encode(challenge)});}
 let payment:Payment;
 try{payment=decodePayment(header,requirement);}catch{return json({error:'INVALID_PAYMENT'},400);}
 const auth=payment.payload.authorization;
 const fingerprint=hash(NETWORK+':'+USDC.toLowerCase()+':'+auth.from.toLowerCase()+':'+auth.nonce.toLowerCase());
 const requestHash=hash(canonical({method:request.method,resource,body,sku}));
 const proofHash=hash(payment.payload.signature.toLowerCase());
 const existing=await deps.store.find(fingerprint);
 if(existing){
 if(existing.requestHash!==requestHash||existing.claimToken!==proofHash)return json({error:'PAYMENT_REPLAY_DIFFERENT_RESOURCE'},409);
 if(existing.state==='SETTLED')return json({receipt:existing.id,data:existing.response},200,{'PAYMENT-RESPONSE':encode(existing.settlement)});
 return json({error:'PAYMENT_RECONCILIATION_REQUIRED',receipt:existing.id,state:existing.state},409,{'Retry-After':'10'});
 }
 const referralHeader=request.headers.get('x-referral-code');
 const referral=referralHeader&&/^[A-Za-z0-9_-]{1,64}$/.test(referralHeader)?referralHeader:null;
 // Persist the actual purchased output before submitting any payment; retries deliver identical output.
 let output:unknown;
 try{output=await deps.fulfill(body);}catch{return json({error:'SERVICE_UNAVAILABLE',charged:false},503);}
 const candidate:Purchase={id:crypto.randomUUID(),fingerprint,requestHash,sku,payer:auth.from.toLowerCase(),amount:requirement.amount,referral,response:output,requirement,state:'PENDING',settlement:null,claimToken:proofHash};
 const claim=await deps.store.claim(candidate);const purchase=claim.purchase;
 if(purchase.requestHash!==requestHash||purchase.claimToken!==proofHash)return json({error:'PAYMENT_REPLAY_DIFFERENT_RESOURCE'},409);
 if(!claim.created){
   if(purchase.state==='SETTLED')return json({receipt:purchase.id,data:purchase.response},200,{'PAYMENT-RESPONSE':encode(purchase.settlement)});
   return json({error:'PAYMENT_RECONCILIATION_REQUIRED',receipt:purchase.id,state:purchase.state},409,{'Retry-After':'10'});
 }
 try{
   const verified=await deps.verify(payment,requirement);
   if(!verified.isValid||verified.payer?.toLowerCase()!==purchase.payer){await deps.store.fail(purchase.id,'FAILED');return json({error:'PAYMENT_VERIFICATION_FAILED'},402);}
 }catch{await deps.store.fail(purchase.id,'FAILED');return json({error:'VERIFICATION_UNAVAILABLE',charged:false},503);}
 // Once settle starts, any timeout/exception is indeterminate. Never re-submit blindly.
 let settlement:Settlement;
 try{settlement=await deps.settle(payment,requirement);await deps.store.setSettlement(purchase.id,settlement);}catch{await deps.store.fail(purchase.id,'RECONCILE');return json({error:'SETTLEMENT_RECONCILIATION_REQUIRED',receipt:purchase.id},503);}
 if(!settlement.success){await deps.store.fail(purchase.id,'RECONCILE');return json({error:'SETTLEMENT_NOT_CONFIRMED',receipt:purchase.id},503);}
 try{
 const evidence=await deps.confirm(settlement,purchase);
 const eligible=!deps.internalPayers.has(purchase.payer)&&purchase.payer!==requirement.payTo.toLowerCase();
 await deps.store.finish(purchase.id,evidence,eligible);
 return json({receipt:purchase.id,data:output},200,{'PAYMENT-RESPONSE':encode(settlement)});
 }catch{await deps.store.fail(purchase.id,'RECONCILE');return json({error:'CHAIN_CONFIRMATION_PENDING',receipt:purchase.id},503);}
}
