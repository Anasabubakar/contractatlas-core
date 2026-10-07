# upgradeable-fixture

A minimal upgradeable Soroban contract used only as a controlled test subject for ContractAtlas.

- It is **not** an audited contract and carries no real audit. Any "audit" in the sibling manifests is a fictional label to exercise the checker.
- `init(admin)` once; `upgrade(new_wasm_hash)` requires the stored admin's authorization; `version()` returns 1 or 2 depending on the build.
- `artifacts/v1.wasm` and `artifacts/v2.wasm` are the exact binaries deployed to testnet. They differ only by the `v2` cargo feature.

Rebuild (results are not guaranteed to be byte-identical across toolchains, which is why the binaries are committed and hashed):

```bash
stellar contract build --out-dir out-v1
stellar contract build --features v2 --out-dir out-v2
sha256sum artifacts/*.wasm
```

Toolchain used: rustc 1.96.0, stellar-cli 28.1.0, soroban-sdk 28.0.0 (pinned with `=`).
