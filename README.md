# HN Comment Sort

A vibe-coded Safari extension for Mac that makes Hacker News comment threads easier to browse.

- Sort comments by **Top (HN rank)**, **Newest**, **Oldest**, or **Most replies**.
- Show only top-level comments, then expand the conversations you want to read.
- Optionally sort replies within each conversation.
- Remember your preferences across pages and tabs.

Everything runs locally. The extension makes no network requests. **Top** uses Hacker News’s own ranking because HN does not publish comment scores.

## Install from Terminal

You need a Mac running macOS 12 or later, Safari, and the full [Xcode app](https://apps.apple.com/app/xcode/id497799835). Command Line Tools alone are not enough. Xcode provides the compiler; you do not need to open its project window or choose an Apple Account. No paid developer membership is needed.

### 1. Download and install

If you use Git, open Terminal and run:

```sh
git clone https://github.com/vim-diesel/hn-comment-sort.git
cd hn-comment-sort
make install
```

Or download **Code → Download ZIP** on GitHub and unzip it. Open Terminal, type `cd ` (including the space), drag the unzipped folder into Terminal, and press Return. Then run `make install`.

Already have the project? Open Terminal in that folder and run `make install`.

This creates your private config, builds the app, installs it at `~/Applications/HN Comment Sort.app`, and opens it. Run the same command after changing the code or downloading updates. If Xcode requests first-launch setup or a license agreement, complete those once, then rerun the command.

### 2. Enable the extension in Safari

The default build uses local ad-hoc signing. Safari treats it as an unsigned extension:

1. Open **Safari → Settings → Advanced** and enable **Show features for web developers** (called **Show Develop menu in menu bar** in older versions).
2. Enable **Allow unsigned extensions** in **Safari → Settings → Developer**, or in the **Develop** menu on older Safari versions.
3. Open **Safari → Settings → Extensions**, enable **HN Comment Sort**, and allow access to `news.ycombinator.com`.
4. Open a Hacker News comments page.

Safari resets **Allow unsigned extensions** when it quits, so you may need to enable it again when you reopen Safari. See [Apple’s instructions](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension).

### Private settings (optional)

`make install` automatically creates `config/local.xcconfig` from the public example. **Your local config is ignored by Git**, so personal signing settings stay on your computer. The default needs no changes. You can create it ahead of time with `make setup`; this preserves an existing config.

If you already have an Apple Development signing identity installed, the example config explains how to use it. Keep your team ID in `config/local.xcconfig`, rather than changing the shared Xcode project. Xcode’s personal `xcuserdata` folders are also ignored.

Other commands:

```sh
make build      # Build without installing or launching
make uninstall  # Remove the installed copy
make clean      # Remove build output; keep your private config
```

Build errors are saved to `build/xcodebuild.log` (also ignored by Git).

## Using it

Use the toolbar above the comments to choose a sort order or turn on **top-level only**. Click a comment’s expander to show its replies, or use **expand all** and **collapse all**.

Click the extension’s icon in Safari to change preferences, including whether to sort replies, start with top-level comments only, or show the toolbar.

To turn the extension off, uncheck it in **Safari → Settings → Extensions**.
