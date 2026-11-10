# EdgeStation widgets

The list of community widgets that [EdgeStation](https://github.com/chainlist/edgestation) offers
in its widget browser. Each widget lives in its author's own GitHub repository; this registry only
says which repositories are listed and under which id.

```json
[{ "id": "weather", "repo": "owner/name" }]
```

`widgets.json` holds nothing else. Name, author, description and version come from each widget's
latest release, so authors never need to touch this repository after their widget is listed.

## How EdgeStation reads a listed widget

For each entry, EdgeStation:

- reads `https://github.com/<repo>/releases/latest/download/manifest.json` to learn the widget's
  name, description, author and version;
- downloads `https://github.com/<repo>/releases/latest/download/widget.zip` only to install the
  widget, or to update it when the manifest's `version` is newer than the installed one;
- shows `README.md` from the root of the repository's default branch, and the icon at the path
  the manifest's `icon` names, also from the default branch.

## Getting your widget listed

1. Publish a release of your widget that meets the requirements below.
2. Open a pull request that adds your entry at the end of `widgets.json`:
   `{ "id": "your-widget", "repo": "you/your-widget-repo" }`.
3. A check validates the entry and your latest release. A maintainer then reviews your widget's
   code before merging.

The id:

- uses lowercase letters, digits and hyphens, and starts with a letter or digit;
- must not be one of the built-in widgets (`clock`, `launcher`, `logs-timeline`, `media`,
  `performance`, `todo`, `url`, `youtube`) or another listed widget;
- is permanent. It keys every placement of your widget on users' pages, so changing it would
  break them. Renaming your widget means changing `name` in your manifest, not the id.

Removing an entry from `widgets.json` hides the widget from the browser and stops its updates in
EdgeStation.

## Release requirements

The widget's repository has its `manifest.json` at the root. Every release attaches two assets:

- `manifest.json`: the same manifest as in the zip. Its `name` must be a non-empty string and its
  `version` must look like `1.2.3`. Fill in `description` and `author` too: the browser shows
  them.
- `widget.zip`: the widget folder's files, with `manifest.json` at the root of the zip (not inside
  a subfolder). Include the manifest, the built `dist/` (or a hand-written `main.js`), the icon,
  the stylesheet named by `styles` if any, and any assets the widget reads with `api.asset()`.
  Source files and `node_modules` are not needed.

Also:

- `version` must increase with every release. EdgeStation only updates when it sees a higher
  version.
- EdgeStation installs the release GitHub marks as **latest**. Prereleases and drafts are ignored.
- Keep `README.md` and the icon on the default branch up to date: they are read from there, not
  from the release.

### Release workflow

This workflow builds and publishes a release whenever you push a tag such as `v1.2.0`. Save it as
`.github/workflows/release.yml` in your widget's repository, bump `version` in `manifest.json`,
commit, then tag and push:

```sh
git tag v1.2.0
git push origin v1.2.0
```

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - name: Check the tag matches the manifest version
        run: test "$GITHUB_REF_NAME" = "v$(jq -r .version manifest.json)"
      # Remove this step if your widget is a hand-written main.js with no build.
      - run: npm ci && npm run build
      # Add any other files the widget needs at run time: assets read with api.asset(), the
      # stylesheet named by "styles". Change icon.svg if your icon has another name.
      - run: zip -r widget.zip manifest.json dist icon.svg
      - run: gh release create "$GITHUB_REF_NAME" manifest.json widget.zip --generate-notes
        env:
          GH_TOKEN: ${{ github.token }}
```

## Trust

Listed widgets are reviewed once, when they are added. Later releases install automatically,
without review. A widget runs with the same access as EdgeStation's built-in widgets, so only
install widgets whose authors you trust.

## Download stats

A daily workflow (`.github/workflows/stats.yml`) adds up the GitHub download counts of every
release's `widget.zip` and publishes them as the only file of the `stats` branch, so `main` gets no
daily commits:

```
https://raw.githubusercontent.com/chainlist/edgestation-widgets/stats/stats.json
```

```json
{
	"updated": "2026-11-10T03:17:00.000Z",
	"widgets": { "weather": { "downloads": 1234, "released": "2026-11-02T18:40:12Z" } }
}
```

`released` is when the newest stable release was published, or `null` if there is none. A widget
whose repository could not be read that day is missing from the file. GitHub pauses scheduled
workflows in a public repository after 60 days without activity; if `updated` stops moving,
re-enable the workflow from the Actions tab.
