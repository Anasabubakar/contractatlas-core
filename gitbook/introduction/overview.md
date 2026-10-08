# Overview

A protocol's audit should not silently describe yesterday's code.

ContractAtlas compares what is **live on a Soroban network** with what a protocol **declares in a manifest**: the expected WASM hash for each contract and the audit references that list reviewed artifacts. It reports one of four states per contract and renders the same report in a terminal, in CI and (via [contractatlas-studio](https://github.com/Contract-Atlas/contractatlas-studio)) on a public page.

| Status | Meaning |
|---|---|
| `match` | Live WASM hash equals the declared hash, and an audit lists that hash as reviewed |
| `drift` | Live hash differs from the declared hash, or matches it but no audit lists it |
| `incomplete` | Evidence is not enough to compare: no declared hash, no audit, a source-commit-only audit, or a non-WASM executable |
| `unavailable` | The ledger could not be read, or the instance is not a live entry (archived, expired or undeployed: not distinguishable) |

A failed read is never reported as drift, and a missing artifact mapping is never reported as audited.

Source: [contractatlas-core on GitHub](https://github.com/Contract-Atlas/contractatlas-core). Releases: [GitHub releases](https://github.com/Contract-Atlas/contractatlas-core/releases).
