# YT History Cleaner

A userscript for [Tampermonkey](https://www.tampermonkey.net/) (or any compatible userscript manager) that adds a control panel to YouTube's Watch History page for bulk-deleting entries older than a chosen time range.

Works entirely through the YouTube UI — no API keys, no external dependencies, no login required beyond your normal YouTube session.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser (Chrome, Firefox, Edge, Safari).
2. Click the Tampermonkey icon → **Create a new script**.
3. Replace the default contents with the contents of [`yt-history-cleaner.user.js`](yt-history-cleaner.user.js).
4. Save (`Ctrl+S` / `Cmd+S`).
5. Navigate to [youtube.com/feed/history](https://www.youtube.com/feed/history) — the panel appears automatically.

> **Safari users:** Use the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) app instead of Tampermonkey.

---

## Usage

The panel appears in the sidebar on desktop, or above the video feed on mobile.

1. **Choose a time range** from the dropdown (e.g. "1 month" = delete everything older than 30 days).
2. Click **Scan** — the script auto-scrolls the page to load all matching history entries into memory and shows a live count.
3. Once scanning is complete, click **Delete N items** to begin deletion.
4. The script works through each item: scrolls it into view, clicks the "More actions" menu, selects "Remove from watch history", and confirms. A live counter shows progress.
5. When finished, a green confirmation shows how many items were deleted. **Refresh the page** to see the changes reflected.

---

## Time Range Options

| Option   | Deletes history older than |
|----------|---------------------------|
| 1 day    | 24 hours ago              |
| 1 week   | 7 days ago                |
| 2 weeks  | 14 days ago               |
| 1 month  | 30 days ago               |
| 3 months | 90 days ago               |
| 6 months | 180 days ago              |
| All time | Everything                |

Changing the dropdown after a scan resets the panel back to Idle, so you can re-scan with the new range.

---

## How It Works

The script interacts entirely through the YouTube UI — the same clicks a user would make manually:

1. **Scan phase:** Auto-scrolls the page to trigger YouTube's infinite scroll and load all history items into the DOM. Items are matched against section date headers ("Today", "Yesterday", day names, "Month Day") and collected if they fall within the selected range.

2. **Delete phase:** For each collected item, the script: scrolls it into view → fires hover events to reveal the "More actions" button → clicks it → waits for the context menu → clicks "Remove from watch history" → confirms the dialog. A configurable delay between steps (~500 ms) prevents overwhelming the page.

Both Shorts (reels) and regular video entries are handled.

---

## Limitations

- **DOM-dependent:** YouTube periodically changes its page structure. If the script stops working, the DOM selectors may need updating.
- **No undo:** Deletions are permanent. There is no built-in confirmation prompt — the count shown before deletion is the only warning.
- **Speed:** Deletion is intentionally paced (one item every ~500–800 ms). Deleting thousands of entries will take a while.
- **Scroll load required:** Items that have never been scrolled into the DOM won't be found by a scan — the scan phase handles this automatically by scrolling to the bottom first.
- **Personal use only:** This script is not packaged as a browser extension and has no automated update mechanism.

---

## License

MIT
