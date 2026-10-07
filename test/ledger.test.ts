import { StrKey } from "@stellar/stellar-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RpcLedgerSource } from "../src/ledger.ts";
import { startFakeRpc } from "./helpers/fakeRpc.ts";

const ID_WASM = StrKey.encodeContract(Buffer.alloc(32, 7));
const ID_SAC = StrKey.encodeContract(Buffer.alloc(32, 8));
const ID_GONE = StrKey.encodeContract(Buffer.alloc(32, 9));
const HASH = "ab".repeat(32);

let rpc: Awaited<ReturnType<typeof startFakeRpc>>;
beforeAll(async () => {
  rpc = await startFakeRpc({
    passphrase: "Test SDF Network ; September 2015",
    latestLedger: 4242,
    contracts: { [ID_WASM]: { kind: "wasm", wasmHash: HASH }, [ID_SAC]: { kind: "stellar_asset" }, [ID_GONE]: { kind: "missing" } },
  });
});
afterAll(() => rpc.close());

describe("RpcLedgerSource over a real RPC wire format", () => {
  it("decodes a WASM instance into the 64-hex hash", async () => {
    const s = new RpcLedgerSource(rpc.url, { allowHttp: true });
    expect(await s.getExecutable(ID_WASM)).toEqual({ kind: "wasm", wasmHash: HASH });
  });

  it("decodes a Stellar Asset Contract instance", async () => {
    const s = new RpcLedgerSource(rpc.url, { allowHttp: true });
    expect(await s.getExecutable(ID_SAC)).toEqual({ kind: "stellar_asset" });
  });

  it("reports a missing entry as not_live rather than throwing", async () => {
    const s = new RpcLedgerSource(rpc.url, { allowHttp: true });
    expect((await s.getExecutable(ID_GONE)).kind).toBe("not_live");
  });

  it("reads network passphrase and latest ledger", async () => {
    const s = new RpcLedgerSource(rpc.url, { allowHttp: true });
    expect(await s.getNetworkPassphrase()).toBe("Test SDF Network ; September 2015");
    expect(await s.getLatestLedger()).toBe(4242);
  });

  it("turns transport failure into unavailable, never into a mismatch", async () => {
    const down = await startFakeRpc({ passphrase: "x", contracts: {}, failEntries: true });
    const s = new RpcLedgerSource(down.url, { allowHttp: true });
    const o = await s.getExecutable(ID_WASM);
    expect(o.kind).toBe("unavailable");
    await down.close();
  });

  it("times out a slow server as unavailable", async () => {
    const { createServer } = await import("node:http");
    const slow = createServer(() => {
      /* never respond */
    });
    await new Promise<void>((r) => slow.listen(0, "127.0.0.1", r));
    const port = (slow.address() as import("node:net").AddressInfo).port;
    const s = new RpcLedgerSource(`http://127.0.0.1:${port}`, { allowHttp: true, timeoutMs: 150 });
    const o = await s.getExecutable(ID_WASM);
    expect(o.kind).toBe("unavailable");
    if (o.kind === "unavailable") expect(o.detail).toMatch(/timed out/);
    slow.closeAllConnections();
    await new Promise<void>((r) => slow.close(() => r()));
  });

  it("refuses http:// unless explicitly allowed", () => {
    expect(() => new RpcLedgerSource("http://example.com")).toThrow(/https/);
  });

  it("never echoes the RPC URL (which may carry an API key) in error detail", async () => {
    const s = new RpcLedgerSource("https://127.0.0.1:1/secret-key-123", { timeoutMs: 500 });
    const o = await s.getExecutable(ID_WASM);
    expect(o.kind).toBe("unavailable");
    if (o.kind === "unavailable") expect(o.detail).not.toContain("secret-key-123");
  });
});
