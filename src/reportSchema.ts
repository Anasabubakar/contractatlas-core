import { z } from "zod";
import type { Report } from "./types.ts";

const status = z.enum(["match", "drift", "incomplete", "unavailable"]);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

const finding = z.strictObject({
  code: z.enum([
    "network_mismatch",
    "network_unavailable",
    "ledger_unavailable",
    "entry_not_live",
    "executable_not_wasm",
    "no_declared_artifact",
    "live_hash_differs_from_declared",
    "live_artifact_outside_audit_scope",
    "no_audit_reference",
    "audit_scope_unmapped_to_artifact",
    "live_artifact_in_audit_scope",
    "declared_source_commit_unverified",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string(),
  evidence: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

const live = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("wasm"), wasmHash: hex64 }),
  z.strictObject({ kind: z.literal("stellar_asset") }),
  z.strictObject({ kind: z.literal("other_executable"), detail: z.string() }),
  z.strictObject({ kind: z.literal("not_live") }),
  z.strictObject({ kind: z.literal("unavailable") }),
]);

const networkCheck = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("match"), expected: z.string(), observed: z.string() }),
  z.strictObject({ status: z.literal("mismatch"), expected: z.string(), observed: z.string() }),
  z.strictObject({ status: z.literal("unavailable"), expected: z.string(), detail: z.string() }),
]);

const contractResult = z.strictObject({
  id: z.string(),
  name: z.string(),
  status,
  live,
  declared: z.strictObject({ wasmHash: hex64.nullable(), sourceCommit: z.string().nullable() }),
  audits: z.array(
    z.strictObject({
      id: z.string(),
      auditor: z.string(),
      report: z.string(),
      date: z.string(),
      coversLiveArtifact: z.boolean(),
      reviewedWasmHashes: z.array(hex64),
      reviewedSourceCommit: z.string().nullable(),
      limitations: z.array(z.string()),
    }),
  ),
  declarations: z.strictObject({
    privileges: z.array(z.strictObject({ role: z.string(), holder: z.string(), description: z.string().nullable() })),
    dependencies: z.array(z.strictObject({ name: z.string(), contractId: z.string().nullable(), note: z.string().nullable() })),
    limitations: z.array(z.string()),
  }),
  findings: z.array(finding),
});

export const reportSchema = z.strictObject({
  reportVersion: z.literal("1"),
  tool: z.strictObject({ name: z.string(), version: z.string() }),
  observedAt: z.iso.datetime(),
  manifest: z.strictObject({
    schemaVersion: z.literal("1"),
    protocol: z.string(),
    sha256: hex64,
    network: z.strictObject({ name: z.string(), passphrase: z.string() }),
  }),
  source: z.strictObject({
    rpcOrigin: z.string().nullable(),
    latestLedger: z.number().int().nonnegative().nullable(),
    network: networkCheck,
  }),
  summary: z.strictObject({
    match: z.number().int().nonnegative(),
    drift: z.number().int().nonnegative(),
    incomplete: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
  }),
  overall: status,
  contracts: z.array(contractResult),
  limitations: z.array(z.string()),
});

/** Compile-time check that the runtime schema and the Report type agree. */
type _Agree = z.infer<typeof reportSchema> extends Report ? (Report extends z.infer<typeof reportSchema> ? true : never) : never;
export const _reportTypesAgree: _Agree = true;

export function parseReport(input: unknown): { ok: true; report: Report } | { ok: false; error: string } {
  const r = reportSchema.safeParse(input);
  return r.success ? { ok: true, report: r.data } : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
}
