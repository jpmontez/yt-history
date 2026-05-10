# YT History Cleaner — Userscript Design

**Date:** 2026-05-10
**Target page:** `https://www.youtube.com/feed/history`
**Format:** Single `.user.js` file (Tampermonkey / Safari Userscripts)
**Author:** Personal use only

---

## Overview

A userscript that injects a control panel into the YouTube Watch History page, allowing the user to scan and bulk-delete watch history entries older than a selected time range. No external dependencies — plain vanilla JS and inline CSS only.

---

## Panel Placement

**Desktop:** Injected at the bottom of the right sidebar, below all existing YouTube-rendered sidebar items.

**Mobile (narrow viewport):** Injected below the "Manage all history" section (which contains Comments, Posts, and Live chat subsections), above the video feed. Still appended after all official items — never inserted before them.

Placement is determined by a CSS media query breakpoint matching YouTube's own mobile layout switch.

---

## Time Range Options

The dropdown offers these options:

| Label | Cutoff |
|---|---|
| 1 week | 7 days ago |
| 2 weeks | 14 days ago |
| 1 month | 30 days ago |
| 3 months | 90 days ago |
| 6 months | 180 days ago |
| All time | No cutoff (delete everything) |

---

## Panel States

### 1 — Idle
- Time range dropdown (default: 1 week)
- "Scan" button

### 2 — Scanning
- Dropdown and button disabled
- Live counter: "Scanning... Found N items"
- Script auto-scrolls the page to load all history items into the DOM
- Items are collected into an in-memory list as they're found
- When no new items load after a scroll, scan is complete → transitions to Ready

### 3 — Ready
- Dropdown re-enabled (changing it resets to Idle)
- Info box: "Ready to delete — N items found"
- "Delete N items" button (red)

### 4 — Deleting
- All controls disabled
- Live counter: "Deleting... X / Y deleted"
- Script works through collected item references top-to-bottom
- For each item: scroll into view → click delete button → wait for confirmation dialog → confirm → increment counter
- Uses `setTimeout`-based delays between deletions to avoid overwhelming the page

### 5 — Done
- Dropdown re-enabled
- Green success box: "✓ Done! Deleted N items" (persistent)
- Smaller hint text below: "Refresh the page for changes to be reflected."
- "Scan Again" button resets panel to Idle (clears success message)

---

## Deletion Loop — DOM Approach

The script interacts entirely through the YouTube UI (no internal API calls). The loop:

1. Scroll page to bottom to trigger YouTube's infinite scroll
2. Wait for new items to render
3. For each newly visible history item, read its timestamp element
4. If timestamp is older than the cutoff date, add a reference to the items list
5. Repeat until scroll produces no new items
6. In delete phase: for each collected reference, bring into view and click delete, then handle the confirmation dialog
7. Use `setTimeout` delays (~300–500ms) between each deletion step

---

## Robustness Notes

- YouTube's history page uses a virtual/infinite scroll — not all items are in the DOM at load time. The scan phase handles this by scrolling progressively.
- If a confirmation dialog does not appear within a timeout, skip that item and continue (don't block the whole run).
- If YouTube's DOM structure changes (class names, element hierarchy), the script will stop working — this is expected and acceptable for personal use. No silent failures: if a scan finds 0 items when items are expected, the panel shows "Found 0 items" clearly.
- The "All time" option has no date cutoff — it collects every item on the page.

---

## Userscript Metadata

```js
// ==UserScript==
// @name         YT History Cleaner
// @namespace    https://github.com/jmontez
// @version      1.0
// @description  Bulk-delete YouTube watch history by time range
// @match        https://www.youtube.com/feed/history
// @grant        none
// ==/UserScript==
```

---

## Out of Scope

- Filtering by video title, channel, or category
- Scheduling / automation (script is manually triggered)
- Any browser extension packaging
- Support for pages other than `/feed/history`
