import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StrKey } from "@stellar/stellar-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../src/cli.ts";
import { KNOWN_NETWORKS } from "../src/manifest.ts";
import { startFakeRpc } from "./helpers/fakeRpc.ts";

const ID_OK = StrKey.encodeContract(Buffer.alloc(32, 1));
const ID_DRIFT = StrKey.encodeContract(Buffer.alloc(32, 2));
const H = "1".repeat(64);
const H2 = "2".repeat(64);

let rpc: Awaited<ReturnType<typeof startFakeRpc>>;
let dir: string;

const audit = { id: "a1", auditor: "Fixture", report: "https://example.com/r.pdf", date: "2026-01-01", reviewedWasmHashes: [H] };

function manifestFor(contracts: unknown[], network: { name: string; passphrase: string } = { name: "testnet", passphrase: KNOWN_NETWORKS.testnet }) {
  return { schemaVersion: "1", protocol: { name: "Demo" }, network, contracts };
}

async function write(name: string, body: unknown) {
  const p = join(dir, name);
  await writeFile(p, JSON.stringify(body));
  return p;
}

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) }, out: () => out.join(""), err: () => err.join("") };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ca-"));
  rpc = await startFakeRpc({
    passphrase: KNOWN_NETWORKS.testnet,
    latestLedger: 555,
    contracts: { [ID_OK]: { kind: "wasm", wasmHash: H }, [ID_DRIFT]: { kind: "wasm", wasmHash: H2 } },
  });
});
afterAll(() => rpc.close());

describe("contractatlas CLI", () => {
  it("validate: exits 0 on a valid manifest", async () => {
    const p = await write("ok.json", manifestFor([{ id: ID_OK, name: "Vault", declaredWasmHash: H, audits: [audit] }]));
    const c = capture();
    expect(await runCli(["validate", p], c.io)).toBe(0);
    expect(c.out()).toMatch(/Manifest OK/);
  });

  it("validate: exits 2 and names the failing path", async () => {
    const p = await write("bad.json", manifestFor([{ id: "nope", name: "X" }]));
    const c = capture();
    expect(await runCli(["validate", p], c.io)).toBe(2);
    expect(c.err()).toMatch(/contracts\.0\.id/);
  });

  it("check: exit 0 and MATCH when live equals declared and audited", async () => {
    const p = await write("match.json", manifestFor([{ id: ID_OK, name: "Vault", declaredWasmHash: H, audits: [audit] }]));
    const c = capture();
    expect(await runCli(["check", p, "--rpc", rpc.url, "--allow-http"], c.io)).toBe(0);
    expect(c.out()).toMatch(/MATCH\s+Vault/);
    expect(c.out()).toMatch(/ledger 555/);
  });

  it("check: exit 1 on drift, and --format json round-trips the report", async () => {
    const p = await write("drift.json", manifestFor([{ id: ID_DRIFT, name: "Vault", declaredWasmHash: H, audits: [audit] }]));
    const c = capture();
    const out = join(dir, "report.json");
    expect(await runCli(["check", p, "--rpc", rpc.url, "--allow-http", "--format", "json", "--out", out], c.io)).toBe(1);
    const stdoutReport = JSON.parse(c.out());
    const fileReport = JSON.parse(await readFile(out, "utf8"));
    expect(stdoutReport).toEqual(fileReport);
    expect(stdoutReport.contracts[0].status).toBe("drift");
  });

  it("check: incomplete passes by default and fails under --strict", async () => {
    const p = await write("inc.json", manifestFor([{ id: ID_OK, name: "Vault", declaredWasmHash: H }]));
    expect(await runCli(["check", p, "--rpc", rpc.url, "--allow-http"], capture().io)).toBe(0);
    expect(await runCli(["check", p, "--rpc", rpc.url, "--allow-http", "--strict"], capture().io)).toBe(1);
  });

  it("check: a wrong-network manifest is unavailable and fails by default", async () => {
    const p = await write(
      "mainnet.json",
      manifestFor([{ id: ID_OK, name: "Vault", declaredWasmHash: H, audits: [audit] }], { name: "mainnet", passphrase: KNOWN_NETWORKS.mainnet }),
    );
    const c = capture();
    expect(await runCli(["check", p, "--rpc", rpc.url, "--allow-http"], c.io)).toBe(1);
    expect(c.out()).toMatch(/network_mismatch/);
    expect(c.out()).not.toMatch(/MATCH\s+Vault/);
  });

  it("check: markdown format renders a table with the same statuses", async () => {
    const p = await write("md.json", manifestFor([{ id: ID_DRIFT, name: "Vault", declaredWasmHash: H, audits: [audit] }]));
    const c = capture();
    await runCli(["check", p, "--rpc", rpc.url, "--allow-http", "--format", "markdown"], c.io);
    expect(c.out()).toMatch(/\| DRIFT \| Vault/);
    expect(c.out()).toMatch(/live_hash_differs_from_declared/);
  });

  it("check: rejects an http RPC without --allow-http with exit 2", async () => {
    const p = await write("h.json", manifestFor([{ id: ID_OK, name: "Vault", declaredWasmHash: H }]));
    const c = capture();
    expect(await runCli(["check", p, "--rpc", rpc.url], c.io)).toBe(2);
    expect(c.err()).toMatch(/https/);
  });

  it("check: unknown --fail-on value is a usage error (exit 2)", async () => {
    const p = await write("f.json", manifestFor([{ id: ID_OK, name: "Vault", declaredWasmHash: H }]));
    expect(await runCli(["check", p, "--rpc", rpc.url, "--allow-http", "--fail-on", "match"], capture().io)).toBe(2);
  });

  it("check: missing manifest file is exit 2", async () => {
    expect(await runCli(["check", join(dir, "nope.json"), "--rpc", rpc.url, "--allow-http"], capture().io)).toBe(2);
  });
});
