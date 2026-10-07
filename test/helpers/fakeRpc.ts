import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Address, xdr } from "@stellar/stellar-sdk";

export type FakeContract =
  | { kind: "wasm"; wasmHash: string }
  | { kind: "stellar_asset" }
  | { kind: "missing" };

export interface FakeRpcOptions {
  passphrase: string;
  latestLedger?: number;
  contracts: Record<string, FakeContract>;
  /** Respond with HTTP 500 to getLedgerEntries. */
  failEntries?: boolean;
}

/** Build the base64 LedgerEntryData the real RPC returns for a contract instance. */
export function instanceEntryXdr(contractId: string, executable: xdr.ContractExecutable): string {
  const val = xdr.ScVal.scvContractInstance(new xdr.ScContractInstance({ executable, storage: null }));
  const entry = xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: xdr.ExtensionPoint.v0(),
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
      val,
    }),
  );
  return entry.toXdr("base64");
}

export async function startFakeRpc(opts: FakeRpcOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const rpc = JSON.parse(body) as { id: number | string; method: string; params?: { keys?: string[] } };
      const reply = (result: unknown) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
      };
      switch (rpc.method) {
        case "getNetwork":
          return reply({ passphrase: opts.passphrase, protocolVersion: 25 });
        case "getHealth":
          return reply({ status: "healthy", latestLedger: opts.latestLedger ?? 1000, oldestLedger: 1, ledgerRetentionWindow: 17280 });
        case "getLedgerEntries": {
          if (opts.failEntries) {
            res.statusCode = 500;
            return res.end("boom");
          }
          const key = xdr.LedgerKey.fromXdr(rpc.params!.keys![0]!, "base64");
          if (key.type !== "contractData") return reply({ entries: [], latestLedger: opts.latestLedger ?? 1000 });
          const id = Address.fromScAddress(key.contractData.contract).toString();
          const c = opts.contracts[id];
          if (c === undefined || c.kind === "missing") return reply({ entries: [], latestLedger: opts.latestLedger ?? 1000 });
          const executable =
            c.kind === "wasm" ? xdr.ContractExecutable.contractExecutableWasm(c.wasmHash) : xdr.ContractExecutable.contractExecutableStellarAsset();
          return reply({
            entries: [{ key: rpc.params!.keys![0], xdr: instanceEntryXdr(id, executable), lastModifiedLedgerSeq: 900 }],
            latestLedger: opts.latestLedger ?? 1000,
          });
        }
        default:
          res.statusCode = 404;
          return res.end();
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
