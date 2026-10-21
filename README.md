# HN Comment Sort

A Safari Web Extension for macOS that adds Reddit-style comment sorting and
top-level-only browsing to Hacker News.

## Features

- Sort comments by **Top (HN rank)**, **Newest**, **Oldest**, or **Most replies**.
- **Top-level only** mode hides every reply, with `[+N]` expanders on comments
  that have children.
- **Expand all** / **Collapse all** while in top-level-only mode.
- Optional **Also sort replies** setting (off by default, so conversations stay
  chronological).
- Deep links such as `item?id=…​#50163494` automatically reveal the comment's
  ancestors in top-level-only mode and scroll to it.
- Settings persist via `browser.storage.local` and stay in sync across tabs.
- Everything runs locally. The extension makes no network requests.

Hacker News does not publish comment scores, so **Top** follows HN's own
ranking rather than a score.

## Install locally (no paid Apple account)

For your own Mac, you do **not** need the Apple Developer Program. The project
is already configured to sign with the Apple Development certificate in your
Xcode account.

From the repo root:

```sh
make install
```

or directly:

```sh
./scripts/install-local.sh
```

That builds a Release copy, installs it to `~/Applications/HN Comment Sort.app`,
registers the extension with macOS, and launches the app.

Then:

1. In the app window, click **Quit and Open Safari Extensions Preferences…**
   (or go to Safari → Settings → Extensions).
2. Enable **HN Comment Sort** and allow it on `news.ycombinator.com`.
3. Open any HN item page. The sort toolbar appears above the comments.

The app is signed with your **Apple Development** certificate. If Safari does
not list the extension:

1. Safari → Settings → Advanced → enable **Show features for web developers**.
2. Develop → **Allow Unsigned Extensions**.

That toggle resets when Safari quits. It is only needed for development-signed
builds. A warning-free build that works on other Macs without the toggle
requires the paid Apple Developer Program and a notarized Developer ID build.

To remove the local app:

```sh
make uninstall
```

If you build on a different Mac, pass your team ID:

```sh
DEVELOPMENT_TEAM=YOURTEAMID make install
```

## Using it

The toolbar above the comments looks like:

```
sort: top · newest · oldest · most replies    [ ] top-level only    expand all | collapse all
```

The extension popup offers the same comment order plus:

- **Also sort replies** — apply the chosen order inside every thread.
- **Start with top-level comments only** — remember the mode across pages.
- **Show toolbar on HN pages** — hide the in-page bar if you only use the popup.

Top-level-only mode is purely visual. HN's own collapse state is left untouched
and returns as soon as the mode is switched off.

## Development

Extension sources live in `Shared (Extension)/Resources`:

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest, HN match pattern, storage permission |
| `content.js` | Parsing, sorting, visibility, toolbar, deep links |
| `content.css` | Toolbar, expanders, and scoped top-level-mode overrides |
| `popup.html/.css/.js` | Settings UI |
| `_locales/en/messages.json` | Extension name and description |

The install script builds the Release app. To verify the project compiles
without touching signing:

```sh
xcodebuild -project "HN Comment Sort.xcodeproj" \
  -scheme "HN Comment Sort (macOS)" \
  -configuration Debug \
  -derivedDataPath build/DerivedData \
  CODE_SIGNING_ALLOWED=NO build
```

Build output and logs go to `build/` (ignored by git). Use `make clean` to
remove them.

The extension resources are copied from `Shared (Extension)/Resources` into the
`.appex` bundle. When adding a new resource file, add it to both synchronized
folder membership lists in `project.pbxproj` (iOS and macOS extension targets),
as the existing files are.

## How sorting works

HN renders comments as a flat list of `tr.athing.comtr` rows whose tree is
encoded by `td.ind[indent]`. The extension rebuilds the tree, sorts sibling
arrays, and moves whole subtrees as contiguous blocks. That preserves HN's own
collapse behavior, which walks rows in document order and compares indentation.

Top-level-only mode adds a root class and uses `display` overrides scoped to it,
so HN's `.coll` / `.noshow` state is not modified.

## Known limitations

- HN's `prev` / `next` links still point to the right comments but no longer
  reflect the visually sorted order.
- HN comment scores are not available, so there is no score-based "Best" sort.
- New comments loaded without a page reload are not picked up (HN item pages
  currently render the whole thread up front).
- macOS Safari is the current target; the iOS extension target builds from the
  same sources but has not been polished.
