CREATE TABLE IF NOT EXISTS deployment_requests (
 id text PRIMARY KEY, venture_id text NOT NULL UNIQUE REFERENCES ventures(id), state text NOT NULL,
 chain_id integer NOT NULL CHECK(chain_id=8453), factory text NOT NULL, creator text NOT NULL,
 template text NOT NULL, version integer NOT NULL, user_salt text NOT NULL,
 owner_address text NOT NULL, guardian_address text NOT NULL, parent_address text NOT NULL,
 implementation text NOT NULL, implementation_code_hash text NOT NULL, config_hex text NOT NULL,
 expected_address text NOT NULL, transaction_data text NOT NULL, transaction_hash text UNIQUE,
 approval_actor text NOT NULL, approval_evidence jsonb NOT NULL,
 evidence jsonb NOT NULL DEFAULT '{}', error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deployment_transitions (
 id text PRIMARY KEY, deployment_id text NOT NULL REFERENCES deployment_requests(id), state text NOT NULL,
 evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(deployment_id,state)
);
CREATE TABLE IF NOT EXISTS deployment_manifests (
 id text PRIMARY KEY, deployment_id text NOT NULL UNIQUE REFERENCES deployment_requests(id),
 manifest_version integer NOT NULL DEFAULT 1, chain_id integer NOT NULL CHECK(chain_id=8453),
 address text NOT NULL, transaction_hash text NOT NULL, code_hash text NOT NULL,
 implementation text NOT NULL, implementation_code_hash text NOT NULL, abi_reference text NOT NULL,
 initialization jsonb NOT NULL, authorities jsonb NOT NULL, evidence jsonb NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now()
);
