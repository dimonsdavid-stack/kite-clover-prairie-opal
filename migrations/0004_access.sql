create table if not exists arclenos_roles (
  user_id text not null references "user"(id),
  role text not null check(role in ('creator','distributor','operator','treasury','guardian')),
  granted_by text not null,
  created_at timestamptz not null default now(),
  primary key(user_id, role)
);
create table if not exists access_audit (
  id text primary key,
  actor_id text not null,
  action text not null,
  decision text not null check(decision in ('ALLOW','DENY')),
  request_id text not null,
  created_at timestamptz not null default now()
);
create table if not exists request_quotas (
  bucket text not null,
  subject text not null,
  window_start bigint not null,
  count integer not null default 0,
  primary key(bucket,subject,window_start)
);
