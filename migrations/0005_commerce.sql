create table if not exists payment_receipts (
 id text primary key, fingerprint text not null unique, request_hash text not null,
 sku text not null, payer text not null, amount_atomic numeric(78,0) not null check(amount_atomic>0),
 asset text not null, network text not null, referral text, response jsonb not null,
 requirement jsonb not null, state text not null check(state in ('PENDING','RECONCILE','FAILED','SETTLED','REFUNDED')),
 settlement jsonb, evidence jsonb, claim_token text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists payment_transaction_unique on payment_receipts ((settlement->>'transaction')) where settlement->>'success'='true' and settlement->>'transaction' <> '';
alter table revenue_events add column if not exists payment_receipt_id text unique references payment_receipts(id);
alter table revenue_events add column if not exists gross_atomic numeric(78,0);
alter table revenue_events add column if not exists net_atomic numeric(78,0);
alter table revenue_events add column if not exists network_cost_atomic numeric(78,0);
alter table revenue_events add column if not exists payer text;
alter table revenue_events add column if not exists confirmation_status text;
alter table revenue_events add column if not exists economic_valid boolean not null default false;
create index if not exists payment_reconcile_idx on payment_receipts(state,updated_at);
