import { getSql } from '../../db';
import { USDC, NETWORK, type Purchase, type Settlement, type Store } from './core';
function decode(r:Record<string,unknown>):Purchase{return {id:String(r.id),fingerprint:String(r.fingerprint),requestHash:String(r.request_hash),sku:String(r.sku),payer:String(r.payer),amount:String(r.amount_atomic),referral:r.referral as string|null,response:r.response,requirement:r.requirement as Purchase['requirement'],state:String(r.state),settlement:r.settlement as Settlement|null,claimToken:String(r.claim_token)};}
export const purchaseStore:Store={
 async find(fingerprint){const sql=await getSql();const rows=await sql.query("select * from payment_receipts where fingerprint=$1",[fingerprint]);return rows.length?decode(rows[0]):null;},
 async claim(p){const sql=await getSql();const rows=await sql.query(`insert into payment_receipts(id,fingerprint,request_hash,sku,payer,amount_atomic,asset,network,referral,response,requirement,state,claim_token) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,'PENDING',$12) on conflict(fingerprint) do nothing returning *`,[p.id,p.fingerprint,p.requestHash,p.sku,p.payer,p.amount,USDC,NETWORK,p.referral,JSON.stringify(p.response),JSON.stringify(p.requirement),p.claimToken]);if(rows.length)return{created:true,purchase:decode(rows[0])};const existing=await sql.query('select * from payment_receipts where fingerprint=$1',[p.fingerprint]);if(!existing.length)throw new Error('Concurrent payment visibility');return{created:false,purchase:decode(existing[0])};},
 async setSettlement(id,settlement){const sql=await getSql();await sql.query("update payment_receipts set settlement=$2::jsonb,updated_at=now() where id=$1 and state='PENDING'",[id,JSON.stringify(settlement)]);},
 async fail(id,state){const sql=await getSql();await sql.query("update payment_receipts set state=$2,updated_at=now() where id=$1 and state<>'SETTLED'",[id,state]);},
 async finish(id,evidence,eligible){const sql=await getSql();await sql.query(`with receipt as (
 update payment_receipts set state='SETTLED',evidence=$2::jsonb,updated_at=now() where id=$1 and state in ('PENDING','RECONCILE') and settlement->>'success'='true' returning *
 ), revenue as (
 insert into revenue_events(id,product,amount_usd,asset,tx_id,classification,attribution,evidence,payment_receipt_id,gross_atomic,net_atomic,payer,confirmation_status,economic_valid)
 select 'payment:'||id,sku,amount_atomic/1000000,'USDC',settlement->>'transaction',case when $3 then 'x402' else 'blocked' end,referral,$2::jsonb,id,amount_atomic,null,payer,'SETTLED',$3 from receipt
 on conflict(payment_receipt_id) do nothing returning attribution,economic_valid
 ) update referrals set conversions=conversions+1 where code in(select attribution from revenue where economic_valid=true)`,[id,JSON.stringify(evidence),eligible]);}
};
export async function reconciliationCandidates(limit=25):Promise<Purchase[]>{const sql=await getSql();return(await sql.query("select * from payment_receipts where state in ('RECONCILE','PENDING') and settlement->>'success'='true' and updated_at<now()-interval '2 minutes' order by created_at limit $1",[Math.min(limit,100)])).map(decode);}
