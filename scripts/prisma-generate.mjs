/**
 * Generate Prisma client with Linux + native query engines for Vercel deploys.
 * The shared meavo-db schema only targets "native"; prebuilt uploads from macOS
 * otherwise ship a darwin engine that crashes at runtime on Vercel.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const sourceSchema = path.join(
  process.cwd(),
  "node_modules/@meavo/db/prisma/schema.prisma",
);
const outDir = path.join(process.cwd(), ".prisma-schema");
const targetSchema = path.join(outDir, "schema.prisma");

if (!fs.existsSync(sourceSchema)) {
  console.error("Missing @meavo/db schema at", sourceSchema);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
let schema = fs.readFileSync(sourceSchema, "utf8");

if (!schema.includes("binaryTargets")) {
  schema = schema.replace(
    "generator client {",
    `generator client {
  binaryTargets = ["native", "rhel-openssl-3.0.x", "linux-arm64-openssl-3.0.x"]`,
  );
}

fs.writeFileSync(targetSchema, schema);
execSync(`npx prisma generate --schema="${targetSchema}"`, {
  stdio: "inherit",
});
