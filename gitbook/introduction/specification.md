# Specification

## User
A Soroban protocol maintainer who publishes audit references and wants to know, in CI and on a public page, whether the code currently deployed at each contract ID is still the code those references describe. Secondary user: an integrator who wants the same evidence before depending on a contract.

## Supported scope
- One manifest (`schemaVersion: "1"`) per protocol and network: contract IDs, the WASM hash the maintainer says should be live, audit references (report link, date, reviewed WASM hashes and/or reviewed source commit, limitations), declared privileges, declared dependencies, limitations.
- Live retrieval of each contract's instance entry through Stellar RPC `getLedgerEntries`, decoding the executable (WASM hash, Stellar Asset Contract, or another executable kind).
- Network identity check (`getNetwork` passphrase) before any comparison.
- Classification per contract into `match`, `drift`, `incomplete`, `unavailable`, plus findings with machine-readable codes.
- A versioned JSON report with provenance (observation time, RPC origin, latest ledger, manifest SHA-256) and fixed limitation statements.
- CLI (`validate`, `check`), exit codes for CI, text / JSON / Markdown renderings of the same report.

## Non-goals
- No global safety or risk score. No "audited" or "safe" label.
- No inference of privileged roles or dependencies from contract code or storage. They are declarations.
- No source rebuild or source-to-WASM verification (a source commit alone leaves coverage unresolved).
- No registry contract, no signing or timestamping of disclosures, no custody.
- No claim that a hash match means an audit covered dependencies, configuration or roles.

## Data model
`manifest.v1.schema.json` and `report.v1.schema.json` are generated from the runtime Zod schemas (`pnpm schema`; CI fails if stale). Hashes are 64 lowercase hex characters; addresses are checksum-validated strkeys; report links are https.

## Classification rules (per contract)
| Condition | Status | Finding |
|---|---|---|
| Ledger read failed (timeout, transport error) | unavailable | `ledger_unavailable` |
| Instance entry not live (archived, expired or never deployed; not distinguishable) | unavailable | `entry_not_live` |
| Executable is the Stellar Asset Contract or another non-WASM kind | incomplete | `executable_not_wasm` |
| No declared WASM hash | incomplete | `no_declared_artifact` |
| Live hash != declared hash | drift | `live_hash_differs_from_declared` |
| Live == declared, an audit lists the live hash | match | `live_artifact_in_audit_scope` |
| Live == declared, audits list artifact hashes but none is the live one | drift | `live_artifact_outside_audit_scope` |
| Live == declared, audits name source commits only | incomplete | `audit_scope_unmapped_to_artifact` |
| Live == declared, no audits | incomplete | `no_audit_reference` |

Network mismatch or an unidentifiable network makes every contract `unavailable` (`network_mismatch`, `network_unavailable`) and no comparison is made. Overall status is the worst contract status in the order drift > unavailable > incomplete > match.

## Interfaces
- Library: `parseManifest`, `checkManifest`, `classifyContract`, `RpcLedgerSource`, `StaticLedgerSource`, `renderText`, `renderMarkdown`, `parseReport`.
- CLI exit codes: `0` no status in `--fail-on` (default `drift,unavailable`), `1` a failing status found, `2` invalid manifest or usage, `3` unexpected error. `--strict` also fails on `incomplete`.
- RPC URLs must be https unless `--allow-http` (local standalone networks only). Error details never echo URLs.

## Acceptance criteria (each has a test)
1. A changed executable hash is reported as drift (unit, CLI, recorded live report 02).
2. A wrong-network comparison is refused (unit, CLI, live test).
3. A failed or timed-out RPC read is `unavailable`, never drift (unit, fake-RPC wire test).
4. A source-commit-only audit never becomes `match` (unit, live report 01 fixture B).
5. CLI text, Markdown, JSON and file output come from one report object and agree (CLI tests).
6. Output validates against `report.v1.schema.json` (schema test).
