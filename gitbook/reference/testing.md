# Testing

```bash
pnpm test            # deterministic: unit, fake-RPC wire tests with real XDR, CLI end to end
pnpm test:live       # opt-in: hits testnet and asserts the fixture is in its post-upgrade state
```

Status: v0.1, engineering complete for the declared scope. No maintainer has reviewed a real manifest yet; that adoption check is tracked separately from the code.
