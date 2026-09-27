create table if not exists opportunities (
  id text primary key,
  source text not null,
  title text not null,
  protocol text not null default '',
  symbol text not null default '',
  chain_id integer not null default 8453,
  tvl_usd double precision,
  apy double precision,
  apy_base double precision,
  volume_usd_1d double precision,
  score double precision not null default 0,
  factors jsonb not null default '{}'::jsonb,
  pool_address text,
  url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ventures (
  id text primary key,
  name text not null,
  archetype text not null,
  status text not null,
  opportunity_id text,
  config jsonb not null default '{}'::jsonb,
  composition jsonb,
  simulation jsonb,
  security jsonb,
  lineage jsonb not null default '{}'::jsonb,
  risk_status text not null default 'unreviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id text primary key,
  agent text not null,
  venture_id text,
  state_from text,
  state_to text,
  reason text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audits (
  id text primary key,
  scope text not null,
  score integer,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists revenue_events (
  id text primary key,
  product text not null,
  amount_usd double precision not null,
  asset text not null,
  tx_id text,
  classification text not null,
  attribution text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists health_snapshots (
  id text primary key,
  overall integer not null,
  components jsonb not null,
  chain_id integer,
  block_number bigint,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  code text primary key,
  clicks integer not null default 0,
  conversions integer not null default 0,
  quality double precision,
  created_at timestamptz not null default now()
);

create table if not exists incidents (
  id text primary key,
  severity text not null,
  component text not null,
  title text not null,
  status text not null,
  remediation text,
  created_at timestamptz not null default now()
);

create table if not exists briefs (
  id text primary key,
  body text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists opportunities_score_idx on opportunities (score desc);
create index if not exists ventures_status_idx on ventures (status);
create index if not exists agent_runs_created_idx on agent_runs (created_at desc);
