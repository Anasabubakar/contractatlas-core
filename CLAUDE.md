# contractatlas-core: working notes

Commands: `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`, `pnpm run schema`, `pnpm test:live` (network).
Constraints: pnpm; Node >= 22; SDK pinned exactly (17.2.1); scripts run with `node --experimental-strip-types` so no parameter properties or enums in `scripts/`. Never commit keys. Testnet admin key lives only in `~/.config/stellar/identity/`.
Commit rules: one logical unit per commit, no AI co-author trailers, author is the repo owner.
Unfinished: maintainer review of a real manifest.
