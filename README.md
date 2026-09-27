# YT History Cleaner

A userscript for [Tampermonkey](https://www.tampermonkey.net/) (or any compatible userscript manager) that adds a control panel to YouTube's Watch History page for bulk-deleting entries older than a chosen time range, or within a specific date range.

Uses your normal YouTube session — no API keys, no external dependencies. It talks to YouTube's own internal API directly where it can, so a run keeps going with the tab in the background, and falls back to clicking through the page where it can't.

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

1. Choose a mode using the **Quick / Custom Date** control at the top of the panel.
   - **Quick:** Pick a preset time range from the dropdown (e.g. "1 month" = delete everything older than 30 days).
   - **Custom Date:** Use the calendar picker to select an exact date or date range (see [Custom Date Picker](#custom-date-picker) below).
2. Click **Scan** — the script pages through your whole history and shows a live count of matching entries.
3. Once scanning is complete, click **Delete N items** to begin deletion.
4. A progress bar and live ETA track the deletion. You can switch to another tab while it runs.
5. When finished, a green confirmation shows how many items were deleted. Click **Refresh Page** to reload and see the changes.

**Removing a single video:** Hover (or tab to) any thumbnail in the feed and a **✕** appears in its top-left corner — click it to remove just that video, without opening YouTube's own menu. It's disabled while a scan or batch deletion is running.

---

## Time Range Options

| Option   | Deletes history older than |
|----------|---------------------------|
| 1 day    | 24 hours ago              |
| 3 days   | 72 hours ago              |
| 1 week   | 7 days ago                |
| 2 weeks  | 14 days ago               |
| 1 month  | 30 days ago               |
| 3 months | 90 days ago               |
| 6 months | 180 days ago              |
| All time | Everything                |

Changing the dropdown after a scan resets the panel back to Idle, so you can re-scan with the new range.

---

## Custom Date Picker

Select **Custom Date** in the mode control at the top of the panel to open the calendar widget.

- **Single date:** Click one date — deletes everything older than that date (same semantics as the preset options, but with an exact cutoff you choose). The Scan button activates immediately.
- **Date range:** Click a start date, then a second date — order doesn't matter, the earlier date always becomes the start. Everything within that window (inclusive) is queued for deletion. The summary shows the span, day count, and a **× Clear** button to reset.
- **Reset:** Clicking a third date resets the selection and starts over with that date as a new single selection.

Switching back to **Quick** mode clears the calendar selection and re-enables the preset dropdown.

Use **‹** / **›** in the calendar header to navigate between months. Future dates and the current month's "next" arrow are automatically disabled.

---

## How It Works

Entries are matched against YouTube's section date headers ("Today", "Yesterday", day names, "Month Day") and collected if they fall within the selected range — either a preset cutoff or a custom date/date range. Both Shorts and regular video entries are handled.

**API mode (default).** The scan requests the history feed straight from YouTube's internal API (`/youtubei/v1/browse`, the same calls the page makes as you scroll), and picks up each entry's "Remove from watch history" token. Deletion sends those tokens to `/youtubei/v1/feedback` in batches of 50 — the first one alone, as a probe. Nothing is scrolled, clicked or timed, so the tab can sit in the background for the whole run, and even a long history takes minutes rather than hours. A deletion only counts when YouTube reports it as processed.

**Page mode (fallback).** If the API response isn't recognised, the scan auto-scrolls the page instead; if YouTube refuses the direct delete, the panel says so and the next scan uses page mode. Page mode works through the UI the way you would by hand — scroll each entry into view, open its "More actions" menu, click "Remove from watch history" — so it needs the tab in the foreground.

---

## Limitations

- **Needs the tab open:** API mode runs in a background tab, but a userscript only runs while some YouTube tab is open — closing the tab or navigating it away from history stops the run.
- **Tied to YouTube internals:** YouTube periodically changes its page structure and internal API. If the script stops working, the selectors or response parsing may need updating.
- **English only:** section dates and the "Remove from watch history" label are matched in English.
- **No undo:** Deletions are permanent. There is no built-in confirmation prompt — the count shown before deletion is the only warning.
- **Page mode is slow:** when it falls back to page mode, deletion is paced per item and needs the tab in the foreground.
- **Personal use only:** This script is not packaged as a browser extension and has no automated update mechanism.

---

## License

MIT
