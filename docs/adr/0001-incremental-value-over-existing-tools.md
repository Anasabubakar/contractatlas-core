# ADR 0001: What ContractAtlas adds over existing tools

Status: accepted, 2026-10-07. Evidence below is what was read on that date; it is not a survey of every tool and no competitor was executed.

## Context
SDF's DeFi security guidance asks protocols to publish audit scope, privileged roles, dependencies and limitations. The question we want a tool to answer is narrower: does the code live at this contract ID still match the artifact the published audit references describe?

## Existing tools inspected
- **Stellar Lab Contract Explorer** (docs page read). Per its documentation it shows creation date, creator, WASM hash, GitHub link, contract spec, storage, restore tooling, and build-verification attestation for one contract at a time, interactively. It has no concept of a maintainer-declared expected hash, an audit scope, or a pass/fail result for CI. Its own note that "Build Verified" does not verify source is the kind of limitation we repeat rather than hide.
- **Stellar Light scout-mcp** (README read). An MCP server over stellarlight.xyz data: research search including audit findings text, project discovery, hackathons, RFPs. It retrieves audit findings; it does not compare a live deployment with an audit's reviewed artifact.
- **Ledgerlens-dashboard** (README read). Wash-trading detection on the SDEX. Unrelated to deployment provenance.
- Project deployment manifests and explorers were not inspected individually in this pass.

## Decision
Build a small checker around a versioned manifest and a report format, and reuse the official `@stellar/stellar-sdk` for RPC and XDR. Do not rebuild an explorer, a source verifier or an audit registry. If an existing project later offers the same manifest-to-live comparison, contribute the manifest schema or adapter there instead of competing.

## Consequences
- The product claim is limited to hash-level comparison plus honest unresolved states. Hash equality is never presented as audit coverage.
- Privileges and dependencies stay human declarations until a specific adapter can corroborate them.
- Adoption validation (a maintainer reviewing a real manifest) has not happened and is tracked separately from engineering completion.
