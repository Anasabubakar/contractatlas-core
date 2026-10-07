// Run with: node --experimental-strip-types scripts/gen-schema.ts [--check]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { manifestSchema } from "../src/manifest.ts";
import { reportSchema } from "../src/reportSchema.ts";

const check = process.argv.includes("--check");
const targets: Array<[string, z.ZodType, string]> = [
  ["schema/manifest.v1.schema.json", manifestSchema, "ContractAtlas manifest v1"],
  ["schema/report.v1.schema.json", reportSchema, "ContractAtlas report v1"],
];

mkdirSync("schema", { recursive: true });
let stale = false;
for (const [path, schema, title] of targets) {
  const json = { title, ...z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) };
  const text = JSON.stringify(json, null, 2) + "\n";
  if (check) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      /* missing counts as stale */
    }
    if (current !== text) {
      console.error(`${path} is out of date; run pnpm schema`);
      stale = true;
    }
  } else {
    writeFileSync(path, text);
    console.log(`wrote ${path}`);
  }
}
if (stale) process.exit(1);
