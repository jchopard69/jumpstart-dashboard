import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const platform = process.platform;
const arch = process.arch;

if (platform !== "darwin" || arch !== "arm64") {
  process.exit(0);
}

const projectRoot = process.cwd();
const swcDir = path.join(projectRoot, "node_modules", "@next", "swc-darwin-arm64");
const swcBinary = path.join(swcDir, "next-swc.darwin-arm64.node");

if (fs.existsSync(swcBinary)) {
  process.exit(0);
}

const npmCache = process.env.npm_config_cache || path.join(os.homedir(), ".npm");
const indexDir = path.join(npmCache, "_cacache", "index-v5");
const contentDir = path.join(npmCache, "_cacache", "content-v2", "sha512");
const targetKey = "@next/swc-darwin-arm64/-/swc-darwin-arm64-";

function findCachedIntegrity() {
  if (!fs.existsSync(indexDir)) return null;
  const buckets = fs.readdirSync(indexDir);
  for (const bucket of buckets) {
    const bucketPath = path.join(indexDir, bucket);
    if (!fs.statSync(bucketPath).isDirectory()) continue;
    const files = fs.readdirSync(bucketPath);
    for (const file of files) {
      const filePath = path.join(bucketPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      if (!content.includes(targetKey)) continue;
      const lines = content.split("\n");
      for (const line of lines) {
        const tabIndex = line.indexOf("\t");
        if (tabIndex === -1) continue;
        const jsonText = line.slice(tabIndex + 1).trim();
        if (!jsonText) continue;
        try {
          const entry = JSON.parse(jsonText);
          if (entry?.key?.includes(targetKey) && entry?.integrity) {
            return entry.integrity;
          }
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

const integrity = findCachedIntegrity();
if (!integrity) {
  console.error("[ensure-swc] Missing @next/swc-darwin-arm64 binary and no cached tarball found.");
  console.error("[ensure-swc] Run: npm install (without --omit=optional) to restore SWC.");
  process.exit(1);
}

const hex = Buffer.from(integrity.replace(/^sha512-/, ""), "base64").toString("hex");
const contentPath = path.join(contentDir, hex.slice(0, 2), hex.slice(2, 4), hex.slice(4));

if (!fs.existsSync(contentPath)) {
  console.error("[ensure-swc] Cached SWC tarball not found at expected path.");
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swc-"));
const tarResult = spawnSync("tar", ["-xzf", contentPath, "-C", tmpDir]);
if (tarResult.status !== 0) {
  console.error("[ensure-swc] Failed to extract SWC tarball.");
  process.exit(1);
}

const extractedDir = path.join(tmpDir, "package");
const binaryPath = path.join(extractedDir, "next-swc.darwin-arm64.node");

if (!fs.existsSync(binaryPath)) {
  console.error("[ensure-swc] Extracted SWC binary not found.");
  process.exit(1);
}

fs.mkdirSync(swcDir, { recursive: true });
for (const file of ["next-swc.darwin-arm64.node", "package.json", "README.md"]) {
  const src = path.join(extractedDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(swcDir, file));
  }
}

console.log("[ensure-swc] Restored @next/swc-darwin-arm64 from npm cache.");
