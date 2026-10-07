import { Address, rpc, xdr } from "@stellar/stellar-sdk";
import type { LiveObservation } from "./types.ts";

/** Where live executable information comes from. Implemented over Stellar RPC; replaceable in tests. */
export interface LedgerSource {
  /** Origin (scheme + host) for provenance, or null for offline/recorded sources. */
  readonly origin: string | null;
  getNetworkPassphrase(): Promise<string>;
  getLatestLedger(): Promise<number>;
  /** Never throws for per-contract problems: failures become `unavailable` or `not_live`. */
  getExecutable(contractId: string): Promise<LiveObservation>;
}

export interface RpcLedgerSourceOptions {
  /** Per-request timeout. Default 15 000 ms. */
  timeoutMs?: number;
  /** Permit http:// URLs, for local standalone networks only. */
  allowHttp?: boolean;
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  // Keep provenance messages short and free of URLs that might embed API keys.
  return msg.replace(/https?:\/\/\S+/g, "<url>").slice(0, 200);
}

export function instanceKey(contractId: string): xdr.LedgerKey {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
}

/** Extract the executable kind and WASM hash from a contract-instance ledger entry's data. */
export function observationFromEntry(data: xdr.LedgerEntryData): LiveObservation {
  if (data.type !== "contractData") {
    return { kind: "unavailable", detail: `expected a contractData entry, got ${data.type}` };
  }
  const val = data.contractData.val;
  if (val.type !== "scvContractInstance") {
    return { kind: "unavailable", detail: `expected a contract instance value, got ${val.type}` };
  }
  const executable = val.instance.executable;
  switch (executable.type) {
    case "contractExecutableWasm":
      return { kind: "wasm", wasmHash: Buffer.from(executable.wasmHash.toBytes()).toString("hex") };
    case "contractExecutableStellarAsset":
      return { kind: "stellar_asset" };
    default:
      return { kind: "other_executable", detail: executable.type };
  }
}

export class RpcLedgerSource implements LedgerSource {
  readonly origin: string;
  private readonly server: rpc.Server;
  private readonly timeoutMs: number;

  constructor(url: string, options: RpcLedgerSourceOptions = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(options.allowHttp && parsed.protocol === "http:")) {
      throw new Error("RPC URL must use https (pass allowHttp for a local standalone network)");
    }
    this.origin = parsed.origin;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.server = new rpc.Server(url, { allowHttp: options.allowHttp === true });
  }

  async getNetworkPassphrase(): Promise<string> {
    const n = await withTimeout(this.server.getNetwork(), this.timeoutMs, "getNetwork");
    return n.passphrase;
  }

  async getLatestLedger(): Promise<number> {
    const l = await withTimeout(this.server.getLatestLedger(), this.timeoutMs, "getLatestLedger");
    return l.sequence;
  }

  async getExecutable(contractId: string): Promise<LiveObservation> {
    try {
      const res = await withTimeout(this.server.getLedgerEntries(instanceKey(contractId)), this.timeoutMs, "getLedgerEntries");
      const entry = res.entries[0];
      if (entry === undefined) {
        return { kind: "not_live", detail: "no live ledger entry returned for the contract instance" };
      }
      return observationFromEntry(entry.val);
    } catch (e) {
      return { kind: "unavailable", detail: describeError(e) };
    }
  }
}

/** In-memory source for tests, recorded fixtures and offline demos. */
export class StaticLedgerSource implements LedgerSource {
  readonly origin: string | null;
  constructor(
    private readonly data: {
      origin?: string | null;
      passphrase: string | Error;
      latestLedger?: number | Error;
      contracts: Record<string, LiveObservation>;
    },
  ) {
    this.origin = data.origin ?? null;
  }
  async getNetworkPassphrase(): Promise<string> {
    if (this.data.passphrase instanceof Error) throw this.data.passphrase;
    return this.data.passphrase;
  }
  async getLatestLedger(): Promise<number> {
    const l = this.data.latestLedger ?? 0;
    if (l instanceof Error) throw l;
    return l;
  }
  async getExecutable(contractId: string): Promise<LiveObservation> {
    return this.data.contracts[contractId] ?? { kind: "not_live", detail: "no recorded entry" };
  }
}
