CREATE TABLE IF NOT EXISTS operation_jobs (
 id text PRIMARY KEY, kind text NOT NULL, idempotency_key text NOT NULL UNIQUE,
 input jsonb NOT NULL DEFAULT '{}', state text NOT NULL DEFAULT 'QUEUED'
 CHECK (state IN ('QUEUED','RUNNING','RETRY','SUCCEEDED','FAILED','BLOCKED')),
 attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 lease_token text, result jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operation_jobs_ready ON operation_jobs(state,available_at);
CREATE TABLE IF NOT EXISTS operation_attempts (
 id text PRIMARY KEY, job_id text NOT NULL REFERENCES operation_jobs(id), attempt integer NOT NULL,
 lease_token text NOT NULL UNIQUE, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 outcome text NOT NULL DEFAULT 'RUNNING', evidence jsonb, error text, UNIQUE(job_id,attempt)
);
CREATE TABLE IF NOT EXISTS source_observations (
 id text PRIMARY KEY, source text NOT NULL, source_key text NOT NULL, observed_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(), classification text NOT NULL CHECK(classification IN ('OBSERVED','DERIVED','ESTIMATED','ASSUMED')),
 confidence numeric NOT NULL CHECK(confidence >= 0 AND confidence <= 1), payload jsonb NOT NULL,
 anomaly_flags jsonb NOT NULL DEFAULT '[]', UNIQUE(source,source_key)
);
CREATE TABLE IF NOT EXISTS operation_health (
 adapter text PRIMARY KEY, failures integer NOT NULL DEFAULT 0, circuit_until timestamptz,
 last_success timestamptz, last_error text, evidence jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operation_audits (
 id text PRIMARY KEY, job_id text REFERENCES operation_jobs(id), status text NOT NULL,
 evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
