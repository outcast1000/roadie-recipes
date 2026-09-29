#!/usr/bin/env node
// Builds index.json from recipes/*.json. CI runs it on main; nobody edits
// index.json by hand.
//
//   node scripts/index.mjs           write index.json (only if an entry changed)
//   node scripts/index.mjs --check   exit 1 if index.json is out of date
//
// Each entry's sha256 is of the file's bytes as committed, which is what
// raw.githubusercontent.com serves; Roadie checks it before using a recipe.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(root, "index.json");

function entries(dir = path.join(root, "recipes")) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const bytes = fs.readFileSync(path.join(dir, f));
      let r;
      try {
        r = JSON.parse(bytes.toString("utf8"));
      } catch (e) {
        throw new Error(`recipes/${f}: not JSON: ${e.message}`);
      }
      return {
        name: r.name,
        summary: r.summary ?? "",
        kind: r.kind,
        revision: r.revision ?? 1,
        platforms: r.platforms ?? [],
        minRoadie: r.minRoadie ?? "0.0.0",
        path: `recipes/${f}`,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      };
    });
}

function current() {
  try {
    return JSON.parse(fs.readFileSync(INDEX, "utf8"));
  } catch {
    return null;
  }
}

const recipes = entries();
const old = current();
const same = old && JSON.stringify(old.recipes) === JSON.stringify(recipes);
if (process.argv.includes("--check")) {
  if (!same) {
    console.error("index.json is out of date: run `node scripts/index.mjs`");
    process.exit(1);
  }
  console.log(`index.json is current (${recipes.length} recipes)`);
} else if (same) {
  console.log(`index.json unchanged (${recipes.length} recipes)`);
} else {
  const index = { indexVersion: 1, generatedAt: new Date().toISOString(), recipes };
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
  console.log(`index.json written (${recipes.length} recipes)`);
}
