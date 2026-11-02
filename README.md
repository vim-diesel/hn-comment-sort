# HN Comment Sort

A vibe-coded Safari extension for Mac that makes Hacker News comment threads easier to browse.

- Sort comments by **Top (HN rank)**, **Newest**, **Oldest**, or **Most replies**.
- Show only top-level comments, then expand the conversations you want to read.
- Optionally sort replies within each conversation.
- Remember your preferences across pages and tabs.

Everything runs locally. The extension makes no network requests. **Top** uses Hacker News’s own ranking because HN does not publish comment scores.

## What you need

- A Mac running macOS 12 or later, with Safari.
- [Xcode](https://apps.apple.com/app/xcode/id497799835), free from the Mac App Store. Your Mac must support the version of Xcode you install.
- A free Apple Account for the signing setup below. A paid Apple Developer Program membership is not required for local use.

Setup currently involves building the app yourself in Xcode.

## Set it up

### 1. Download and open the project

Download this repository (**Code → Download ZIP** on GitHub) and unzip it, or clone it if you use Git.

Open Xcode once and let it finish installing any required components. Then open `HN Comment Sort.xcodeproj` from the downloaded folder.

### 2. Choose your Apple Account

In **Xcode → Settings → Accounts**, add your Apple Account.

Select the project in Xcode’s left sidebar. Under **Targets**, select each of these in turn:

- **HN Comment Sort (macOS)**
- **HN Comment Sort Extension (macOS)**

For both, open **Signing & Capabilities**, enable **Automatically manage signing**, and choose your **Personal Team** under **Team**. Choose your own team for both targets.

If Xcode says a bundle identifier is unavailable, change it to a unique name in both targets. Keep the extension’s identifier prefixed with the app’s identifier, for example `com.yourname.HNCommentSort` and `com.yourname.HNCommentSort.Extension`.

### 3. Build and open the app

In the toolbar at the top of Xcode, choose the **HN Comment Sort (macOS)** scheme and **My Mac** as the destination. Click the Run button (▶).

When the app opens, click **Quit and Open Safari Extensions Preferences…**. You can also open **Safari → Settings → Extensions** yourself.

### 4. Enable it in Safari

Enable **HN Comment Sort** and allow access to `news.ycombinator.com`. Open a Hacker News comments page to see the sorting toolbar.

If the extension is missing or Safari will not enable it:

1. Open **Safari → Settings → Advanced** and enable **Show features for web developers** (called **Show Develop menu in menu bar** in older versions).
2. In **Safari → Settings → Developer**, enable **Allow unsigned extensions**. In older Safari versions, this is under the **Develop** menu instead.
3. Return to **Extensions** and enable **HN Comment Sort**.

Safari resets **Allow unsigned extensions** when it quits, so you may need to enable it again when you reopen Safari. See [Apple’s instructions for running a Safari web extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension) for more details.

## Using it

Use the toolbar above the comments to choose a sort order or turn on **top-level only**. Click a comment’s expander to show its replies, or use **expand all** and **collapse all**.

Click the extension’s icon in Safari to change preferences, including whether to sort replies, start with top-level comments only, or show the toolbar.

## Optional: install in your Applications folder

After completing the Xcode signing setup, open Terminal, type `cd ` (with a trailing space), drag the downloaded project folder into the window, and press Return. Then run:

```sh
make install
```

This builds the app, installs it at `~/Applications/HN Comment Sort.app`, and opens it. Run the same command after downloading updates.

To remove that installed copy, run this from the same project folder:

```sh
make uninstall
```

To simply turn the extension off, uncheck it in **Safari → Settings → Extensions**.
