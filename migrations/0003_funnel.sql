create table if not exists funnel_events (
  id text primary key,
  name text not null,
  path text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_name_idx on funnel_events (name, created_at desc);

create table if not exists lineage_events (
  id text primary key,
  venture_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lineage_events_venture_idx on lineage_events (venture_id, created_at);
