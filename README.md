# contractatlas-core

A protocol's audit should not silently describe yesterday's code.

ContractAtlas compares what is **live on a Soroban network** with what a protocol **declares in a manifest**: the expected WASM hash for each contract and the audit references that list reviewed artifacts. It reports one of four states per contract and renders the same report in a terminal, in CI and (via [contractatlas-studio](https://github.com/Anasabubakar/contractatlas-studio)) on a public page.

| Status | Meaning |
|---|---|
| `match` | Live WASM hash equals the declared hash, and an audit lists that hash as reviewed |
| `drift` | Live hash differs from the declared hash, or matches it but no audit lists it |
| `incomplete` | Evidence is not enough to compare: no declared hash, no audit, a source-commit-only audit, or a non-WASM executable |
| `unavailable` | The ledger could not be read, or the instance is not a live entry (archived, expired or undeployed: not distinguishable) |

A failed read is never reported as drift, and a missing artifact mapping is never reported as audited.

## What it does not do

No safety score, no "audited" label, no inference of privileged roles (they are declarations you write), no source rebuild. A match means the deployed hash equals a hash an audit says it reviewed. It does not mean the audit covered dependencies, configuration or roles. See [SPEC.md](SPEC.md) and [ADR 0001](docs/adr/0001-incremental-value-over-existing-tools.md) for how this compares with Stellar Lab and others.

## Install and run

Published to npm as `@anas.abubakar/contractatlas-core` (`npm install @anas.abubakar/contractatlas-core`). To work from source: From a clone (Node 22 or newer, pnpm):

```bash
git clone https://github.com/Anasabubakar/contractatlas-core.git
cd contractatlas-core
pnpm install --frozen-lockfile
pnpm build
node dist/cli.js check fixtures/testnet/manifest.json --rpc https://soroban-testnet.stellar.org
```

```bash
node dist/cli.js validate manifest.json            # offline schema check
node dist/cli.js check manifest.json --rpc <url> --format markdown >> "$GITHUB_STEP_SUMMARY"
node dist/cli.js check manifest.json --rpc <url> --out report.json --strict
```

Exit codes: `0` ok, `1` a failing status found (`--fail-on` defaults to `drift,unavailable`; `--strict` adds `incomplete`), `2` invalid manifest or usage, `3` unexpected error.

## Manifest

```json
{
  "schemaVersion": "1",
  "protocol": { "name": "My protocol" },
  "network": { "name": "testnet", "passphrase": "Test SDF Network ; September 2015" },
  "contracts": [{
    "id": "C...",
    "name": "Vault",
    "declaredWasmHash": "<64 hex>",
    "audits": [{
      "id": "audit-2026-01", "auditor": "...", "report": "https://...", "date": "2026-01-15",
      "reviewedWasmHashes": ["<64 hex>"],
      "limitations": ["Did not cover the oracle adapter."]
    }],
    "privileges": [{ "role": "upgrade authority", "holder": "G..." }]
  }]
}
```

JSON Schemas: `schema/manifest.v1.schema.json` and `schema/report.v1.schema.json` (generated from the runtime schemas; CI fails when stale).

## Demo: a real testnet upgrade

`fixtures/testnet` holds a manifest for two contracts deployed on testnet from [`fixtures/upgradeable-fixture`](fixtures/upgradeable-fixture/README.md) and two recorded reports from real runs:

1. [`01-before-upgrade`](fixtures/testnet/reports/01-before-upgrade.txt): fixture A is `match`; fixture B, whose review names a source commit only, is `incomplete`.
2. After a real on-chain `upgrade` transaction, [`02-after-upgrade`](fixtures/testnet/reports/02-after-upgrade.txt): fixture A is `drift` and the CLI exits 1. The audit link is retained but no longer covers the live code.

Contract IDs, hashes and transactions: [DEPLOYMENT.md](fixtures/testnet/DEPLOYMENT.md). The "audits" in the fixture are fictional labels, not professional audits. The contracts are permanently in the post-upgrade state, so a fresh run reproduces report 02.

## Supported versions

| Component | Version |
|---|---|
| Node.js | 22 or newer (developed on 24.19) |
| `@stellar/stellar-sdk` | 17.2.1 (exact pin) |
| Networks | Testnet exercised live. Mainnet and futurenet are accepted by the schema with their well-known passphrases and use the same code path, but are not exercised in CI. |
| Fixture contract | `soroban-sdk` 28.0.0, `stellar-cli` 28.1.0, rustc 1.96.0 |

## Testing

```bash
pnpm test            # deterministic: unit, fake-RPC wire tests with real XDR, CLI end to end
pnpm test:live       # opt-in: hits testnet and asserts the fixture is in its post-upgrade state
```

Status: v0.1, engineering complete for the declared scope. No maintainer has reviewed a real manifest yet; that adoption check is tracked separately from the code.

## License

MIT. See [LICENSE](LICENSE). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
