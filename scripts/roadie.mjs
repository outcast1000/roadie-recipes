#!/usr/bin/env node
// Validates and dry-runs recipes with the newest Roadie CLI, on this machine.
//
//   node scripts/roadie.mjs recipes/slskd.json [more.json …]
//   ROADIE=/path/to/roadie node scripts/roadie.mjs …   use a local CLI-release build instead
//   RECIPES='["recipes/a.json"]' node scripts/roadie.mjs  the list as JSON (CI)
//
// The CLI comes from the `cli-latest` manifest (the address apps that bundle
// Roadie follow) and is checked against its sha256. A dry run on a platform
// the recipe does not list is skipped; on one it lists, the latest release
// must resolve and its download must be reachable. Nothing is installed.

import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST = "https://github.com/outcast1000/roadie/releases/download/cli-latest/manifest.json";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = `${{ darwin: "darwin", win32: "windows" }[process.platform] ?? process.platform}-${process.arch}`;

async function fetchCli() {
  const manifest = await (await fetch(MANIFEST)).json();
  const asset = manifest.assets?.[platform];
  if (!asset) throw new Error(`the Roadie CLI ${manifest.version} has no build for ${platform}`);
  const dir = path.join(root, ".roadie", manifest.version, platform);
  const bin = path.join(dir, asset.binary);
  if (fs.existsSync(bin)) return { bin, version: manifest.version };
  const res = await fetch(asset.url);
  if (!res.ok) throw new Error(`download ${asset.url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha !== asset.sha256) throw new Error(`${asset.file}: sha256 ${sha}, manifest says ${asset.sha256}`);
  fs.mkdirSync(dir, { recursive: true });
  const archive = path.join(dir, asset.file);
  fs.writeFileSync(archive, bytes);
  // bsdtar (macOS, and tar.exe on Windows) unpacks both .tar.gz and .zip.
  execFileSync("tar", ["-xf", archive, "-C", dir]);
  if (!fs.existsSync(bin)) throw new Error(`${asset.file} has no ${asset.binary} at its top level`);
  return { bin, version: manifest.version };
}

function roadie(bin, dataDir, args) {
  const r = spawnSync(bin, ["--data-dir", dataDir, ...args], { encoding: "utf8", timeout: 120_000 });
  if (r.error) throw new Error(`run roadie ${args.join(" ")}: ${r.error.message}`);
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    out = { raw: r.stdout.trim(), stderr: r.stderr.trim() };
  }
  return { code: r.status, out };
}

const files = process.argv.length > 2 ? process.argv.slice(2) : JSON.parse(process.env.RECIPES || "[]");
if (!files.length) {
  console.error("usage: roadie.mjs <recipe.json> [more.json …]");
  process.exit(2);
}
const { bin, version } = process.env.ROADIE ? { bin: process.env.ROADIE, version: "local" } : await fetchCli();
// Only the CLI release runs commands in-process; the desktop binary would
// start a background service (and its login item) for the scratch data dir.
const release = JSON.parse(spawnSync(bin, ["version"], { encoding: "utf8" }).stdout || "{}").release;
if (release !== "cli") {
  console.error(`${bin} is Roadie's ${release ?? "unknown"} release; use the CLI release (cargo build --no-default-features)`);
  process.exit(2);
}
console.log(`Roadie CLI ${version} on ${platform}`);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "roadie-recipes-"));

let failed = 0;
for (const file of files) {
  const fail = (what, detail) => {
    failed++;
    console.error(`::error file=${file}::${what}`);
    console.error(JSON.stringify(detail, null, 2));
  };
  const v = roadie(bin, dataDir, ["recipe", "validate", path.resolve(file)]);
  if (v.code !== 0 || v.out.ok !== true) {
    fail("invalid recipe", v.out.errors ?? v.out);
    continue;
  }
  const recipe = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!(recipe.platforms ?? []).includes(platform)) {
    console.log(`${file}: valid; dry run skipped (not for ${platform})`);
    continue;
  }
  const d = roadie(bin, dataDir, ["recipe", "dryrun", path.resolve(file)]);
  if (d.code !== 0) fail("dry run failed", d.out);
  else if (d.out.resolveError) fail(`latest release did not resolve: ${d.out.resolveError}`, d.out);
  else if (d.out.assetReachable !== true) fail(`download not reachable: ${d.out.resolved?.downloadUrl}`, d.out);
  else {
    console.log(`${file}: valid; ${platform} resolves ${d.out.resolved.version} (${d.out.resolved.downloadUrl})`);
    console.log(JSON.stringify(d.out, null, 2));
  }
}
fs.rmSync(dataDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
