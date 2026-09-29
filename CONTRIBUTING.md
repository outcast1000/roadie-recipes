# Contributing a recipe

A recipe tells Roadie how to find a tool's latest release, check it, install it, configure it
and, for daemons, run and stop it. Its format is Roadie's engine contract. It lives in the
Roadie repo, in [SCHEMA.md](https://github.com/outcast1000/roadie/blob/main/recipes/SCHEMA.md).
Read it first, and start from the recipe here that is closest to yours (`yt-dlp` for a single
binary, `ffmpeg` for sidecar binaries, `slskd` for a configured daemon).

## Rules

- **One file per tool:** `recipes/<name>.json`, where `<name>` is the recipe's `name`
  (lowercase letters, digits and `-`, up to 32 characters).
- **Raise `revision` on every change.** Roadie offers a recipe update only when the revision
  goes up, and every user reviews it before it applies. A recipe that doesn't need to change
  shouldn't.
- **Set `minRoadie` when you use a newer field.** If the recipe needs a field a Roadie release
  added, set `"minRoadie": "<that version>"`. Older Roadies ignore fields they don't know and
  would run the recipe wrong, so the catalog hides it from them.
- **List only the platforms you tested.** Roadie supports `darwin-arm64`, `darwin-x64`,
  `windows-x64` and `windows-arm64`. There is no Linux.
- **Loopback only.** A daemon binds `127.0.0.1`, and its stop ladder should include the
  tool's own API route when it has one.
- **Downloads come from the tool's upstream,** with checksums wherever upstream publishes them.
- **No app-specific recipes.** A recipe describes a tool, not how one particular app uses it.
- **Removing a recipe:** delete the file and add the `remove-recipe` label. Installed copies
  keep working; nobody new can install it.
- **Don't touch `index.json`.** CI generates it on `main`.

## Test it before you open the pull request

With the [Roadie CLI](https://github.com/outcast1000/roadie/releases) (it asks before installing
anything):

```bash
roadie recipe validate recipes/<name>.json          # errors name a JSON pointer and a fix
roadie --data-dir /tmp/rr recipe dryrun recipes/<name>.json   # resolves the latest release, renders config; installs nothing
roadie --data-dir /tmp/rr tool install ./recipes/<name>.json  # a real install into a scratch data dir
```

Or run what CI runs, which downloads the newest CLI for you (Node 20+):

```bash
node scripts/roadie.mjs recipes/<name>.json
```

Roadie desktop and its MCP server can also author a recipe with you: validate, dry run, install,
then hand the file over for a pull request here. Roadie never opens the pull request itself. You
do, from your own GitHub account.

## What CI checks

On every pull request, using the scripts from the base branch:

1. the file name matches `name`; `revision` went up for a changed recipe; a removal carries the
   label; `index.json` is untouched;
2. `roadie recipe validate` and `roadie recipe dryrun` with the newest Roadie CLI on macOS
   (arm64, x64) and Windows (x64). On a platform the recipe lists, the latest release must
   resolve and its download must be reachable.

The workflow runs your pull request with no secrets and a read-only token.
