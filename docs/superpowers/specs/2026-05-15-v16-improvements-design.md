# YT History Cleaner v1.6 — Improvements Design

**Date:** 2026-05-15
**Scope:** Five targeted improvements to UX, performance, and robustness

---

## Items in Scope

| # | Description |
|---|-------------|
| 2 | Refresh Page button after Done |
| 3 | Estimated time remaining during deletion |
| 9 | Adaptive (polling-based) delays |
| 10 | Fast-path scan for All time range |
| 12 | Stale DOM guard during deletion |

---

## #2 — Refresh Page Button After Done

**What:** Replace the static hint "Refresh the page for changes to be reflected." with a small `Refresh Page` button. Clicking it calls `window.location.reload()`.

**Where:** `renderState` DONE case — `insertHint(actionBtn, ...)` is removed; replaced with a button inserted before `actionBtn` using the existing `ytc-btn ytc-btn-cancel` style class.

**No new state required.** The button sits alongside the "Scan Again" button in the DONE layout.

**Dark mode:** `ytc-btn-cancel` already has a dark mode rule — no new CSS needed.

---

## #3 — Estimated Time Remaining

**What:** Show a live "~X sec remaining" estimate in the deletion progress box, updated after each item.

**How:**
- Record `deletionStartTime = Date.now()` at the start of `handleDelete`.
- After each item in `deleteNext`, compute:
  ```
  elapsed   = Date.now() - deletionStartTime
  avgMs     = elapsed / (i + 1)
  remaining = avgMs * (items.length - i - 1)
  ```
- Pass `remaining` to `updateDeletingProgress`, which appends it as a third line in the red info box using a new `<span id="ytc-eta">` element inside the existing `.ytc-info-red` div.
- When `remaining === 0` (last item), the ETA span is hidden or removed.

**Format:** Round to nearest second. Display as `~Xs remaining` for <90s, `~Xm remaining` for ≥90s.

**Placement:** Third line inside the existing red `.ytc-info` box, below the `deleted / total` counter. Same font size (12px), color inherited from the box.

---

## #9 — Adaptive (Polling-Based) Delays

**What:** Replace two fixed-duration sleeps with polling loops, and reduce the inter-item pause.

### Changes

**A. Hover-wait before finding the menu button**

Current: `await sleep(150)` after dispatching `mouseenter`/`mouseover`.

New: Poll for the menu button in a tight loop — 20ms ticks, 300ms max. The loop exits as soon as the button is found or the timeout is reached. This replaces both the `sleep(150)` and the subsequent spatial search loop (which can be collapsed into the same wait).

**B. Post-click wait for confirm dialog**

Current: `await sleep(DIALOG_WAIT_MS)` (450ms) after clicking "Remove from watch history".

New: Poll for `paper-button[dialog-confirm], yt-button-renderer[dialog-confirm] button` — 20ms ticks, 600ms max. Click as soon as found. No fixed wait.

**C. Inter-item pause**

`DELETE_STEP_MS`: 350ms → 200ms.

### Expected throughput

| Phase | Before | After |
|-------|--------|-------|
| Hover → menu button visible | 150ms fixed | 0–300ms poll (exits early) |
| Menu items load (waitForMenuOption) | 0–100ms poll | unchanged |
| Confirm dialog wait | 450ms fixed | 0–600ms poll (exits early) |
| Inter-item pause | 350ms | 200ms |
| **Nominal total** | **~1050ms** | **~500–600ms** |

Failures and skips follow existing paths unchanged.

---

## #10 — Fast-Path Scan for All Time

**What:** When "All time" is selected (`cutoff === null`), use a reduced scroll pause (200ms instead of 800ms).

**Where:** `scrollAndCollect` receives a new optional `fastScroll` boolean parameter, or `handleScan` passes a dynamic pause value. The simplest approach: pass the pause duration into `scrollAndCollect` rather than reading the module-level constant.

**Why 200ms is safe:** The 800ms pause exists to let YouTube's lazy-load render new DOM nodes after a scroll. YouTube's history feed typically renders within 100–150ms; 200ms provides headroom without the full 800ms cost.

**No UI change.** The scan flow is identical from the user's perspective — it just completes faster.

---

## #12 — Stale DOM Guard

**What:** Detect and handle the two ways the DOM can become stale during a deletion loop:
1. A specific history item gets removed from the DOM before the script processes it.
2. YouTube's SPA navigates away mid-deletion.

### Change A — Per-item detachment check

At the top of each iteration in `deleteNext`:
```js
if (!document.contains(item)) {
  skippedCount++;
  updateDeletingProgress(deletedCount, items.length, skippedCount);
  continue;
}
```

This silently skips already-detached nodes without breaking the loop.

### Change B — Navigation listener

In `handleDelete`, before calling `deleteNext`:
```js
const navAbort = () => { cancelRequested = true; };
window.addEventListener('yt-navigate-finish', navAbort, { once: true });
```

In `deleteNext`, before the DONE/CANCELLED state transition (the natural exit points), remove the listener:
```js
window.removeEventListener('yt-navigate-finish', navAbort);
```

If navigation fires mid-loop, `cancelRequested` becomes true and the loop exits cleanly via the existing cancel path on the next iteration check.

**The listener function is stored in a module-level variable `_navAbortFn`** (consistent with how `cancelRequested` and other loop-state vars are managed), so `deleteNext` can call `window.removeEventListener('yt-navigate-finish', _navAbortFn)` at its natural exit points without needing an extra parameter.

---

## Architecture Notes

All five changes are additive — no new states, no new UI sections, no changes to the scanning flow beyond the pause duration. The script stays single-file.

**Touch surface per change:**

| # | Functions modified |
|---|-------------------|
| 2 | `renderState` (DONE case), `STYLES` (none needed) |
| 3 | `handleDelete`, `deleteNext`, `updateDeletingProgress`, `insertInfo` |
| 9 | `deleteNext`, constants block |
| 10 | `handleScan`, `scrollAndCollect` |
| 12 | `handleDelete`, `deleteNext` |
