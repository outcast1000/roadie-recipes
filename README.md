# Roadie recipes

The recipe catalog for [Roadie](https://github.com/outcast1000/roadie), the app that installs,
configures, runs and updates the tools other apps depend on. Each file in `recipes/` describes
one tool, declaratively. Roadie reads them here, so a recipe is added, fixed or removed with a
pull request, not a Roadie release.

| Recipe | Kind | What it is |
|---|---|---|
| [`slskd`](recipes/slskd.json) | daemon | Soulseek client with a web UI and HTTP API |
| [`yt-dlp`](recipes/yt-dlp.json) | cli | Downloads audio and video from YouTube and many other sites |
| [`ffmpeg`](recipes/ffmpeg.json) | cli | Converts, merges and inspects audio and video |

## How Roadie uses this repo

Roadie fetches [`index.json`](index.json) from `raw.githubusercontent.com`, then the recipe
files it lists, and checks each file against its `sha256` in the index. CI regenerates the
index on every push to `main`. Never edit it by hand.

The catalog is not signed, and Roadie never trusts a recipe from it automatically. The first
time you install a tool, and every time its recipe changes, Roadie shows you the recipe and asks.
A higher `revision` shows up in Roadie as a recipe update you can review. Once a tool is
installed, Roadie keeps using the recipe you approved, even if the recipe is later removed from
the catalog.

> Roadie reads this catalog from the release after 0.5.2 onward. Earlier releases carry these
> three recipes built in.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: one JSON file per tool, named after its
`name`, validated against Roadie's [recipe schema](https://github.com/outcast1000/roadie/blob/main/recipes/SCHEMA.md),
dry-run on the platforms it lists, and `revision` raised on every change.
