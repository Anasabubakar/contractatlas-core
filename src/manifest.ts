import { z } from "zod";

export const MANIFEST_SCHEMA_VERSION = "1" as const;

export const KNOWN_NETWORKS = {
  mainnet: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
} as const;

const hex64 = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "must be 64 lowercase hex characters (a SHA-256 WASM hash)");

const gitCommit = z.string().regex(/^[0-9a-f]{40}$/, "must be a full 40-character lowercase git commit hash");

const contractId = z.string().regex(/^C[A-Z2-7]{55}$/, "must be a Stellar contract address (C..., 56 characters)");

const accountOrContract = z.string().regex(/^[GC][A-Z2-7]{55}$/, "must be a Stellar G... or C... address");

const httpsUrl = z.url({ protocol: /^https$/, hostname: z.regexes.domain });

export const sourceCommitSchema = z.strictObject({
  repository: httpsUrl,
  commit: gitCommit,
});

export const auditSchema = z.strictObject({
  id: z.string().min(1).max(64),
  auditor: z.string().min(1).max(200),
  report: httpsUrl,
  date: z.iso.date(),
  /** WASM artifacts the audit states it reviewed. Required for an audit to count toward a match. */
  reviewedWasmHashes: z.array(hex64).default([]),
  /** Source commit the audit states it reviewed. A commit alone cannot establish a match with a deployed artifact. */
  reviewedSourceCommit: sourceCommitSchema.optional(),
  /** Human-written statements of what the audit did not cover. */
  limitations: z.array(z.string().min(1).max(500)).default([]),
});

export const privilegeSchema = z.strictObject({
  role: z.string().min(1).max(100),
  holder: accountOrContract,
  description: z.string().max(500).optional(),
});

export const dependencySchema = z.strictObject({
  name: z.string().min(1).max(100),
  contractId: contractId.optional(),
  note: z.string().max(500).optional(),
});

export const contractSchema = z.strictObject({
  id: contractId,
  name: z.string().min(1).max(100),
  /** The WASM hash the project says should currently be deployed at this contract ID. */
  declaredWasmHash: hex64.optional(),
  declaredSourceCommit: sourceCommitSchema.optional(),
  audits: z.array(auditSchema).default([]),
  /** Declarations by the project. ContractAtlas does not verify these. */
  privileges: z.array(privilegeSchema).default([]),
  dependencies: z.array(dependencySchema).default([]),
  limitations: z.array(z.string().min(1).max(500)).default([]),
});

export const manifestSchema = z
  .strictObject({
    schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
    protocol: z.strictObject({
      name: z.string().min(1).max(100),
      homepage: httpsUrl.optional(),
      description: z.string().max(1000).optional(),
    }),
    network: z.strictObject({
      name: z.enum(["mainnet", "testnet", "futurenet", "standalone"]),
      passphrase: z.string().min(1).max(200),
    }),
    contracts: z.array(contractSchema).min(1).max(200),
  })
  .superRefine((manifest, ctx) => {
    const known = KNOWN_NETWORKS[manifest.network.name as keyof typeof KNOWN_NETWORKS];
    if (known !== undefined && known !== manifest.network.passphrase) {
      ctx.addIssue({
        code: "custom",
        path: ["network", "passphrase"],
        message: `passphrase does not match the well-known ${manifest.network.name} passphrase`,
      });
    }
    const seen = new Set<string>();
    manifest.contracts.forEach((c, i) => {
      if (seen.has(c.id)) {
        ctx.addIssue({ code: "custom", path: ["contracts", i, "id"], message: `duplicate contract id ${c.id}` });
      }
      seen.add(c.id);
    });
  });

export type Manifest = z.infer<typeof manifestSchema>;
export type ContractEntry = z.infer<typeof contractSchema>;
export type Audit = z.infer<typeof auditSchema>;

export interface ManifestIssue {
  path: string;
  message: string;
}

export type ParseResult =
  | { ok: true; manifest: Manifest }
  | { ok: false; issues: ManifestIssue[] };

export function parseManifest(input: unknown): ParseResult {
  const result = manifestSchema.safeParse(input);
  if (result.success) return { ok: true, manifest: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.length ? i.path.map(String).join(".") : "(root)",
      message: i.message,
    })),
  };
}
