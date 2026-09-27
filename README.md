# YT History Cleaner

A userscript that adds a control panel to YouTube's Watch History page for bulk-deleting entries before a chosen cutoff, or within a specific date range.

It uses your normal signed-in YouTube session — no API keys, no accounts, nothing to configure. It talks to YouTube's own internal API directly, so a scan takes seconds and a deletion keeps running with the tab in the background.

---

## Installation

**Safari:** install the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) app and enable its extension in Safari's settings, then add [`yt-history-cleaner.user.js`](yt-history-cleaner.user.js) as a new script and allow it on youtube.com.

**Chrome, Firefox, Edge:** install [Tampermonkey](https://www.tampermonkey.net/), click its icon → **Create a new script**, replace the default contents with [`yt-history-cleaner.user.js`](yt-history-cleaner.user.js), and save.

Then open [youtube.com/feed/history](https://www.youtube.com/feed/history) — the panel appears automatically.

Tested on Safari 27 with Userscripts 4.8.6, and on Chrome.

---

## Usage

The panel appears in the sidebar, or above the video feed in narrow windows.

1. Choose a mode using the **Quick / Custom Date** control at the top of the panel.
   - **Quick:** pick a preset from the dropdown (see [Time Range Options](#time-range-options)).
   - **Custom Date:** pick an exact date or date range on the calendar (see [Custom Date Picker](#custom-date-picker)).
2. Click **Scan**. The script reads your history and shows how many entries match — in seconds for most histories, without scrolling the page.
3. Click **Delete N items** to start. A progress bar and ETA track the run, and you can switch to another tab or window while it works. Click **Cancel** to stop early; anything already deleted stays deleted.
4. When it finishes, a green confirmation shows how many entries were deleted (and how many were skipped, if any). The history page itself doesn't update on its own — click **Refresh Page** to see the result, or **Scan Again** to start over.

**Removing a single video:** hover (or tab to) any thumbnail in the feed and a **✕** appears in its top-left corner — click it to remove just that video without opening YouTube's own menu. It's disabled while a scan or deletion is running.

---

## Time Range Options

Presets work in whole calendar days, counted back from today. Each one deletes everything watched **on or before** that day.

| Option   | Deletes entries watched on or before |
|----------|--------------------------------------|
| 1 day    | Yesterday                            |
| 3 days   | 3 days ago                           |
| 1 week   | 7 days ago                           |
| 2 weeks  | 14 days ago                          |
| 1 month  | 30 days ago                          |
| 3 months | 90 days ago                          |
| 6 months | 180 days ago                         |
| All time | Everything, including today          |

Changing the dropdown after a scan resets the panel, so you can re-scan with the new range.

---

## Custom Date Picker

Select **Custom Date** in the mode control at the top of the panel to open the calendar.

- **Single date:** click one date to delete that day and everything before it. The Scan button activates immediately.
- **Date range:** click a start date, then an end date — order doesn't matter, the earlier one always becomes the start. Everything watched within that window, both ends included, is deleted. The summary shows the span, the number of days, and a **× Clear** button.
- **Start over:** clicking a third date starts a new selection from that date.

Switching back to **Quick** clears the calendar selection. Use **‹** / **›** to move between months; future dates can't be selected.

---

## How It Works

YouTube groups your history under date headings ("Today", "Yesterday", weekday names, "Sep 7", …). The script reads each heading as a date and keeps every entry under a heading that falls in your range — regular videos and Shorts alike.

**API mode (the default).** The scan fetches your history straight from YouTube's internal API (`/youtubei/v1/browse` — the same requests the page makes as you scroll) and collects each entry's "Remove from watch history" token. A date-range scan stops as soon as it reaches entries older than the range. Deleting sends those tokens to `/youtubei/v1/feedback`: the first on its own as a check, then the rest in batches of 50. Nothing is scrolled or clicked and nothing waits on timers, so the run carries on when the tab is in the background. An entry only counts as deleted once YouTube confirms it.

**Page mode (the fallback).** If YouTube's response isn't in a shape the script recognises, the scan falls back to scrolling the page, and deletion clicks through each entry the way you would by hand: scroll it into view, open its **More actions** menu, choose **Remove from watch history**. This is much slower and needs the tab in the foreground. If YouTube ever refuses the direct delete, nothing is deleted and the panel shows *"YouTube refused the direct delete"*. Click **Scan** again to redo the run in page mode.

All requests go to youtube.com with your existing session. The only other request is for the panel's font, from Google Fonts.

---

## Limitations

- **Keep the tab open:** API mode runs in a background tab, but the script only runs while that tab is open. Closing it, or navigating it to another YouTube page, stops the run.
- **Tied to YouTube internals:** YouTube changes its page and internal API from time to time. If the script stops working, its selectors or response parsing may need updating. It falls back to page mode where it can.
- **English only:** date headings and the "Remove from watch history" label are matched in English.
- **No undo:** deletions are permanent, and there is no confirmation prompt — the count on the **Delete N items** button is the only warning.
- **Personal use:** this isn't packaged as a browser extension and doesn't update itself; to update, replace the script's contents with the latest version.

---

## License

MIT
