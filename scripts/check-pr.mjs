#!/usr/bin/env node
// The rules a pull request must follow, checked against its base commit.
//
//   node scripts/check-pr.mjs <base-sha>
//
// Env: LABELS (comma-separated PR labels), GITHUB_OUTPUT (optional; receives
// `recipes=<JSON array>` of the added or changed recipe files, for the
// per-platform validation that follows).
//
// It reads only git and the files; it runs untrusted input, so it executes
// nothing from the PR.

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const REMOVE_LABEL = "remove-recipe";
const RECIPE = /^recipes\/([a-z0-9][a-z0-9-]{0,31})\.json$/;

const base = process.argv[2];
if (!base) {
  console.error("usage: check-pr.mjs <base-sha>");
  process.exit(2);
}
const labels = (process.env.LABELS ?? "").split(",").map((l) => l.trim()).filter(Boolean);

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const atBase = (file) => {
  try {
    return JSON.parse(git("show", `${base}:${file}`));
  } catch {
    return null;
  }
};

const errors = [];
const changed = [];

// --no-renames: a rename is a removal plus an addition, and both rules apply.
const diff = git("diff", "--name-status", "--no-renames", `${base}...HEAD`).trim();
for (const line of diff ? diff.split("\n") : []) {
  const [status, file] = line.split("\t");
  if (file === "index.json") {
    errors.push("index.json: generated on main by CI; do not edit it in a pull request");
    continue;
  }
  if (!file.startsWith("recipes/")) continue;
  const m = file.match(RECIPE);
  if (!m) {
    errors.push(`${file}: recipes/ holds only <name>.json files, a name being up to 32 lowercase letters, digits and '-'`);
    continue;
  }
  if (status === "D") {
    if (!labels.includes(REMOVE_LABEL)) {
      errors.push(`${file}: removed — say so by adding the \`${REMOVE_LABEL}\` label to the pull request`);
    }
    continue;
  }
  let r;
  try {
    r = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${file}: not JSON: ${e.message}`);
    continue;
  }
  if (r.name !== m[1]) {
    errors.push(`${file}: /name is ${JSON.stringify(r.name)}; the file must be named after it (recipes/${r.name}.json)`);
  }
  const old = status === "M" ? atBase(file) : null;
  if (old && !((r.revision ?? 1) > (old.revision ?? 1))) {
    errors.push(`${file}: /revision is ${r.revision ?? 1}, was ${old.revision ?? 1} — a changed recipe must raise it, or Roadie never offers the change`);
  }
  changed.push(file);
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `recipes=${JSON.stringify(changed)}\n`);
}
for (const e of errors) console.error(`error: ${e}`);
console.log(`${changed.length} recipe(s) to validate: ${changed.join(", ") || "none"}`);
process.exit(errors.length ? 1 : 0);
