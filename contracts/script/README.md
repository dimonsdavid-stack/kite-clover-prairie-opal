# ARCLENØS Base mainnet bootstrap

This script deploys the minimum verified ARCLENØS factory stack on Base mainnet:

1. `ImplementationRegistry`
2. `LineageRegistry`
3. `EmergencyPause`
4. `ArclenosFactory`
5. `VentureModule` implementation
6. register template/version/codehash
7. grant the Factory `RECORDER_ROLE` in Lineage
8. grant the approved signer `DEPLOYER_ROLE` in Factory

It does **not** deploy a customer venture, move customer capital, or load a private key from source code.

## Required local environment

Set these locally in your shell. Never commit secrets.

```bash
export BASE_RPC_URL='https://...'
export ARCLENOS_ADMIN='0x...'
export ARCLENOS_GUARDIAN='0x...'
export ARCLENOS_DEPLOYER='0x...'
export ARCLENOS_ASSET='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export ARCLENOS_MAX_CAP='25000000000'
```

`ARCLENOS_MAX_CAP` is the policy ceiling in the asset's atomic units. For Base USDC,
`25000000000` is 25,000 USDC.

The account used to broadcast must be the address supplied as `ARCLENOS_ADMIN`,
because the script performs the initial registry and role configuration using that
administrator. For production, use a hardware wallet or encrypted Foundry keystore.
Do not put a raw private key in shell history.

## Dry run

From `contracts/`:

```bash
forge script script/DeployArclenos.s.sol:DeployArclenos \
  --rpc-url "$BASE_RPC_URL" \
  --sender "$ARCLENOS_ADMIN" \
  -vvvv
```

Review every simulated transaction and the emitted `ArclenosDeploymentManifest`.

## Broadcast

Example using a Foundry encrypted keystore account named `arclenos-admin`:

```bash
forge script script/DeployArclenos.s.sol:DeployArclenos \
  --rpc-url "$BASE_RPC_URL" \
  --account arclenos-admin \
  --sender "$ARCLENOS_ADMIN" \
  --broadcast \
  --slow \
  -vvvv
```

Your wallet/keystore signs locally. ARCLENØS source code never receives the secret key.

## Production environment values after finality

Copy only public deployment evidence into the Vercel **Production** environment:

- `ARCLENOS_FACTORY_ADDRESS` = manifest `factory`
- `ARCLENOS_FACTORY_CODE_HASH` = manifest `factoryCodeHash`
- `ARCLENOS_IMPLEMENTATIONS_JSON` =

```json
[
  {
    "template": "<manifest template>",
    "version": 1,
    "address": "<manifest implementation>",
    "codeHash": "<manifest implementationCodeHash>",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "maxCap": "25000000000"
  }
]
```

Also configure `BASE_RPC_URL` and, preferably, `BASE_RPC_FALLBACK_URL` with HTTPS Base
mainnet providers.

After Vercel redeploys, verify:

```bash
curl -s https://www.arclenos.com/api/health
```

The Factory gate must report `VERIFIED`. Do not manually change the health state.

## Canary venture

The root bootstrap is not a customer venture. After Factory becomes VERIFIED, use the
ARCLENØS operator deployment lifecycle to prepare a bounded canary. That workflow
simulates the exact unsigned Factory transaction, requires external founder signing,
binds the resulting transaction hash, waits for Base finality, verifies the
`VentureDeployed` event, clone bytecode, implementation codehash and initialization
postconditions, and only then publishes the venture as `CANARY`.
