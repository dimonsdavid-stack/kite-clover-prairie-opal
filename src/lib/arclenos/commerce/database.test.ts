import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('commerce migration enforces replay and settlement transaction uniqueness without erasing revenue',async()=>{
 const pg=new PGlite();await pg.waitReady;
 try{
 await pg.exec(`create table revenue_events(id text primary key,product text not null,amount_usd double precision not null,asset text not null,tx_id text,classification text not null,attribution text,evidence jsonb not null default '{}',created_at timestamptz default now());insert into revenue_events(id,product,amount_usd,asset,classification) values('historical','test',1,'USDC','x402');`);
 await pg.exec(await readFile(new URL('../../../../migrations/0005_commerce.sql',import.meta.url),'utf8'));
 await pg.exec(`insert into payment_receipts(id,fingerprint,request_hash,sku,payer,amount_atomic,asset,network,response,requirement,state,claim_token) values('one','nonce','request','brief','payer',250000,'USDC','eip155:8453','{}','{}','PENDING','proof');`);
 await assert.rejects(()=>pg.exec(`insert into payment_receipts(id,fingerprint,request_hash,sku,payer,amount_atomic,asset,network,response,requirement,state,claim_token) values('two','nonce','request','brief','payer',250000,'USDC','eip155:8453','{}','{}','PENDING','proof');`),/unique/);
 await pg.exec(`update payment_receipts set state='SETTLED',settlement='{"transaction":"0xabc","success":true}' where id='one';`);
 await assert.rejects(()=>pg.exec(`insert into payment_receipts(id,fingerprint,request_hash,sku,payer,amount_atomic,asset,network,response,requirement,state,claim_token,settlement) values('two','nonce2','request','brief','payer',250000,'USDC','eip155:8453','{}','{}','SETTLED','proof','{"transaction":"0xabc","success":true}');`),/unique/);
 assert.equal((await pg.query<{id:string}>("select id from revenue_events where id='historical'")).rows[0].id,'historical');
 }finally{await pg.close();}
});
