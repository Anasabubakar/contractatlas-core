# ADR 0002: SDK and RPC read path

Status: accepted, 2026-10-07.

- `@stellar/stellar-sdk` 17.2.1 is pinned exactly. Its XDR classes changed shape (type-tagged union classes rather than `.switch()` accessors) and it models a third executable kind, `contractExecutableExternalRef`, which we surface as `other_executable` instead of treating as WASM.
- We read the persistent contract-instance key with `getLedgerEntries`. RPC returns only live entries, so an archived instance is indistinguishable from an undeployed one; both are reported `unavailable`, never as proof of absence.
- The latest ledger comes from `getHealth` (no XDR header parsing). It is provenance only and never affects classification.
- We do not fetch contract code bytes in v0.1. The WASM hash in the instance entry is the identifier of the code the network will execute; downloading the code would add bytes, not information.
