# Contributing

Small, focused changes with tests are welcome.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck && pnpm test
pnpm run schema      # after changing manifest or report schemas; commit the output
```

Rules that keep the tool honest:

- A change to classification must update the table in `SPEC.md` and add a test that fails without it.
- Never turn missing evidence or a failed read into `match` or `drift`.
- Do not add a score, a safety label or wording that implies audit coverage beyond what hashes show.
- Network tests live in `test/live` and are opt-in. Deterministic tests use the fake RPC in `test/helpers`, which serves real XDR.
- AI-assisted changes are fine if you understand and have verified every line.

Commits: one logical change each, imperative message, conventional prefix (`feat`, `fix`, `test`, `docs`, `build`, `ci`).
