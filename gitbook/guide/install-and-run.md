# Install and run

Published to npm as `@anas.abubakar/contractatlas-core` (`npm install @anas.abubakar/contractatlas-core`). To work from source: From a clone (Node 22 or newer, pnpm):

```bash
git clone https://github.com/Contract-Atlas/contractatlas-core.git
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
