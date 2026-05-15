# YT History Cleaner v1.6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement five targeted improvements to `yt-history-cleaner.user.js`: faster All-time scan, a Refresh Page button after deletion, live ETA during deletion, adaptive polling-based delays, and stale DOM protection.

**Architecture:** All changes are confined to the single file `yt-history-cleaner.user.js`. No files are created. Changes are additive — no states, selectors, or CSS classes are removed. Tasks are ordered to avoid conflicts on `deleteNext` (each task touches a distinct section of that function).

**Tech Stack:** Vanilla JS, Tampermonkey userscript, YouTube DOM. No test runner — validation is manual via Tampermonkey in the browser.

---

### Task 1: Fast-path scan for All time (#10)

**Files:**
- Modify: `yt-history-cleaner.user.js` — `scrollAndCollect`, `handleScan`

**What:** Reduce the scroll pause to 200ms when "All time" is selected (cutoff is null). The 800ms pause exists to let YouTube lazy-load new DOM nodes after scrolling; 200ms is sufficient when no date comparison is needed.

- [ ] **Step 1: Add `pauseMs` parameter to `scrollAndCollect`**

Find the function signature around line 1209. Change the signature and replace the `SCROLL_PAUSE_MS` reference in the `await sleep` call inside that function:

```js
// Before
  async function scrollAndCollect(filterFn) {
```
```js
// After
  async function scrollAndCollect(filterFn, pauseMs = SCROLL_PAUSE_MS) {
```

There is exactly one `await sleep(SCROLL_PAUSE_MS)` inside this function (near the bottom of the while loop). Change it:

```js
// Before
      await sleep(SCROLL_PAUSE_MS);
```
```js
// After
      await sleep(pauseMs);
```

- [ ] **Step 2: Pass 200ms in `handleScan` when `cutoff === null`**

Find the `handleScan` function (around line 1190). The else-branch already calls `getCutoffDate()` — reuse that value:

```js
// Before
    let filterFn;
    if (calendarMode) {
      const range = getCustomRange();
      filterFn = (headerText) => isSectionInCustomRange(headerText, range);
    } else {
      const cutoff = getCutoffDate();
      filterFn = (headerText) => isSectionOlderThanCutoff(headerText, cutoff);
    }

    setState(STATE.SCANNING, { count: 0 });
    scrollAndCollect(filterFn);
```
```js
// After
    let filterFn;
    let pauseMs = SCROLL_PAUSE_MS;
    if (calendarMode) {
      const range = getCustomRange();
      filterFn = (headerText) => isSectionInCustomRange(headerText, range);
    } else {
      const cutoff = getCutoffDate();
      filterFn = (headerText) => isSectionOlderThanCutoff(headerText, cutoff);
      if (cutoff === null) pauseMs = 200;
    }

    setState(STATE.SCANNING, { count: 0 });
    scrollAndCollect(filterFn, pauseMs);
```

- [ ] **Step 3: Manual verification**

Install the updated script in Tampermonkey. On the YouTube history page:
1. Select **All time** → Scan. The scan scrolls to the bottom noticeably faster than before.
2. Select **1 week** → Scan. Scrolling still pauses ~800ms between steps (no regression).

- [ ] **Step 4: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "perf: reduce scroll pause to 200ms for All time scan"
```

---

### Task 2: Stale DOM guard — navigation listener + detachment check (#12)

**Files:**
- Modify: `yt-history-cleaner.user.js` — module-level vars, `handleDelete`, `deleteNext`

**What:** Two guards: (A) if YouTube's SPA navigates away during deletion, set `cancelRequested = true` so the loop exits cleanly; (B) skip any item that has already been removed from the DOM before we reach it.

- [ ] **Step 1: Add `_navAbortFn` module-level variable**

Find the block of module-level `let` declarations (around line 461), after `cancelRequested`:

```js
// Before
  let cancelRequested = false;
```
```js
// After
  let cancelRequested = false;
  let _navAbortFn    = null;
```

- [ ] **Step 2: Add `removeNavAbort` helper**

Add this function immediately before `handleDelete`:

```js
  function removeNavAbort() {
    if (_navAbortFn) {
      window.removeEventListener('yt-navigate-finish', _navAbortFn);
      _navAbortFn = null;
    }
  }
```

- [ ] **Step 3: Register listener at the start of `handleDelete`**

Find `handleDelete` (around line 1271):

```js
// Before
  function handleDelete() {
    if (currentState !== STATE.READY) return;
    deletedCount    = 0;
    skippedCount    = 0;
    cancelRequested = false;
    const items = [...foundItems];
```
```js
// After
  function handleDelete() {
    if (currentState !== STATE.READY) return;
    deletedCount    = 0;
    skippedCount    = 0;
    cancelRequested = false;
    _navAbortFn = () => { cancelRequested = true; };
    window.addEventListener('yt-navigate-finish', _navAbortFn, { once: true });
    const items = [...foundItems];
```

- [ ] **Step 4: Call `removeNavAbort()` at each exit of `deleteNext`**

`deleteNext` has two exit points. Find the CANCELLED path (inside the for loop, around line 1285):

```js
// Before
      if (cancelRequested) {
        setState(STATE.CANCELLED, { deleted: deletedCount, skipped: skippedCount });
        return;
      }
```
```js
// After
      if (cancelRequested) {
        removeNavAbort();
        setState(STATE.CANCELLED, { deleted: deletedCount, skipped: skippedCount });
        return;
      }
```

Find the DONE path (last line of `deleteNext`, after the for loop):

```js
// Before
    setState(STATE.DONE, { count: deletedCount, skipped: skippedCount });
```
```js
// After
    removeNavAbort();
    setState(STATE.DONE, { count: deletedCount, skipped: skippedCount });
```

- [ ] **Step 5: Add per-item detachment check at the top of the for loop in `deleteNext`**

Find the for loop opening (immediately after the `cancelRequested` check you just edited):

```js
// Before
    for (let i = 0; i < items.length; i++) {
      if (cancelRequested) {
```
```js
// After
    for (let i = 0; i < items.length; i++) {
      if (!document.contains(items[i])) {
        skippedCount++;
        updateDeletingProgress(deletedCount, items.length, skippedCount);
        continue;
      }
      if (cancelRequested) {
```

- [ ] **Step 6: Manual verification**

Install the updated script:
1. Start a deletion. While it's running, click Home or any other YouTube page. Confirm no JS errors in the console and the script stops processing.
2. Run a normal deletion to completion — no increase in unexpected skips.

- [ ] **Step 7: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "fix: halt deletion on SPA navigation, skip detached DOM nodes"
```

---

### Task 3: Polling hover wait (#9A)

**Files:**
- Modify: `yt-history-cleaner.user.js` — add `waitForMenuButton`, modify `deleteNext`

**What:** Replace the fixed `sleep(150)` + synchronous spatial button search with a polling loop (`waitForMenuButton`) that retries every 20ms up to 300ms.

- [ ] **Step 1: Add `waitForMenuButton` helper**

Add this function immediately before `deleteNext`:

```js
  async function waitForMenuButton(item, timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (cancelRequested) return null;
      const itemRect   = item.getBoundingClientRect();
      const allButtons = document.querySelectorAll('button[aria-label]');
      for (const btn of allButtons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (!label.includes('action') && !label.includes('more')) continue;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top  + r.height / 2;
        if (cx >= itemRect.left && cx <= itemRect.right &&
            cy >= itemRect.top  && cy <= itemRect.bottom) {
          return btn;
        }
      }
      await sleep(20);
    }
    return null;
  }
```

- [ ] **Step 2: Replace hover wait + spatial search in `deleteNext`**

Find the hover section (around line 1295 — after the `item.scrollIntoView` and first `sleep`):

```js
// Before
      // Hover to reveal per-item controls
      item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true }));
      await sleep(150);

      // Spatial matching: find a "More actions" button whose center falls
      // within this item's bounding rect (Polymer's querySelector returns
      // the section's button, not the item's)
      const itemRect   = item.getBoundingClientRect();
      const allButtons = document.querySelectorAll('button[aria-label]');
      let menuBtn = null;
      for (const btn of allButtons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (!label.includes('action') && !label.includes('more')) continue;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top  + r.height / 2;
        if (cx >= itemRect.left && cx <= itemRect.right &&
            cy >= itemRect.top  && cy <= itemRect.bottom) {
          menuBtn = btn;
          break;
        }
      }
```
```js
// After
      item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true }));
      const menuBtn = await waitForMenuButton(item, 300);
```

- [ ] **Step 3: Manual verification**

Install the updated script. Delete a 5–10 item batch. Confirm:
1. Items are deleted successfully — skip count does not increase unexpectedly.
2. Deletion proceeds visibly faster.
3. Cancel still works.

- [ ] **Step 4: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "perf: poll for menu button instead of fixed 150ms hover wait"
```

---

### Task 4: Polling confirm wait + reduced inter-item pause (#9B)

**Files:**
- Modify: `yt-history-cleaner.user.js` — constants block, add `waitForConfirmButton`, modify `deleteNext`

**What:** Replace the fixed `sleep(DIALOG_WAIT_MS)` + synchronous confirm button query with a polling helper. Also reduce `DELETE_STEP_MS` from 350ms to 200ms.

- [ ] **Step 1: Reduce `DELETE_STEP_MS`**

Find the constants block (around line 1118):

```js
// Before
  const DELETE_STEP_MS  = 350;
```
```js
// After
  const DELETE_STEP_MS  = 200;
```

- [ ] **Step 2: Add `waitForConfirmButton` helper**

Add this function immediately after `waitForMenuButton` (still before `deleteNext`):

```js
  async function waitForConfirmButton(timeout) {
    const sel      = 'paper-button[dialog-confirm], yt-button-renderer[dialog-confirm] button';
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (cancelRequested) return null;
      const btn = document.querySelector(sel);
      if (btn) return btn;
      await sleep(20);
    }
    return null;
  }
```

- [ ] **Step 3: Replace fixed confirm wait in `deleteNext`**

Find the block after clicking the remove option (around line 1340):

```js
// Before
      // yt-list-item-view-model doesn't handle click directly —
      // find the actual clickable child element inside it
      const clickTarget = removeBtn.querySelector('button, a, [role="option"], [role="menuitem"]') || removeBtn;
      clickTarget.click();
      await sleep(DIALOG_WAIT_MS);

      const confirmBtn = document.querySelector(
        'paper-button[dialog-confirm], yt-button-renderer[dialog-confirm] button'
      );
      if (confirmBtn) confirmBtn.click();
```
```js
// After
      const clickTarget = removeBtn.querySelector('button, a, [role="option"], [role="menuitem"]') || removeBtn;
      clickTarget.click();

      const confirmBtn = await waitForConfirmButton(600);
      if (confirmBtn) confirmBtn.click();
```

- [ ] **Step 4: Manual verification**

Install the updated script. Delete a 10–20 item batch. Confirm:
1. All items delete successfully — no unexpected spikes in skips.
2. Deletion is roughly 1.7× faster than before the adaptive changes (~500ms/item vs ~1050ms/item).
3. Cancel works at any point.

- [ ] **Step 5: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "perf: poll for confirm dialog instead of fixed wait, reduce inter-item pause to 200ms"
```

---

### Task 5: Refresh Page button after Done (#2)

**Files:**
- Modify: `yt-history-cleaner.user.js` — `renderState` DONE case, add `insertRefreshButton`

**What:** Replace the static "Refresh the page for changes to be reflected." hint with a clickable "Refresh Page" button using the existing `ytc-btn-cancel` style.

- [ ] **Step 1: Add `insertRefreshButton` helper**

Add this function immediately after `insertHint` (around line 1079):

```js
  function insertRefreshButton(beforeNode) {
    const panel = document.getElementById('ytc-panel');
    const btn   = document.createElement('button');
    btn.className      = 'ytc-btn ytc-btn-cancel';
    btn.textContent    = 'Refresh Page';
    btn.style.marginBottom = '8px';
    btn.onclick = () => window.location.reload();
    panel.insertBefore(btn, beforeNode);
  }
```

- [ ] **Step 2: Swap hint for button in the DONE case of `renderState`**

Find the DONE case (around line 1007):

```js
// Before
        insertInfo(actionBtn, 'green', doneLabel, null);
        insertHint(actionBtn, 'Refresh the page for changes to be reflected.');
```
```js
// After
        insertInfo(actionBtn, 'green', doneLabel, null);
        insertRefreshButton(actionBtn);
```

- [ ] **Step 3: Manual verification**

Install the updated script. Run a deletion to completion. Confirm:
1. The DONE state shows: green info box → "Refresh Page" button → "Scan Again" button.
2. Clicking "Refresh Page" reloads the page.
3. Clicking "Scan Again" resets and works correctly.
4. In dark mode (`html[dark]`), the "Refresh Page" button uses `ytc-btn-cancel` which already has a dark mode rule — confirm it renders correctly.

- [ ] **Step 4: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add Refresh Page button to done state"
```

---

### Task 6: Estimated time remaining (#3) + version bump

**Files:**
- Modify: `yt-history-cleaner.user.js` — module-level vars, `handleDelete`, `renderState` DELETING case, `updateDeletingProgress`, `@version`

**What:** Show a live "~Xs remaining" estimate inside the deletion progress box. Computed as a rolling average of actual per-item time.

- [ ] **Step 1: Add `deletionStartTime` module variable**

Find the module-level `let` declarations (around line 461, after the `_navAbortFn` added in Task 2):

```js
// Before
  let _navAbortFn    = null;
```
```js
// After
  let _navAbortFn       = null;
  let deletionStartTime = 0;
```

- [ ] **Step 2: Record start time in `handleDelete`**

Find the line you added in Task 2 (`_navAbortFn = ...`) and add `deletionStartTime` immediately after it:

```js
// Before
    _navAbortFn = () => { cancelRequested = true; };
    window.addEventListener('yt-navigate-finish', _navAbortFn, { once: true });
```
```js
// After
    _navAbortFn       = () => { cancelRequested = true; };
    deletionStartTime = Date.now();
    window.addEventListener('yt-navigate-finish', _navAbortFn, { once: true });
```

- [ ] **Step 3: Add ETA span to the DELETING info box in `renderState`**

Find the `case STATE.DELETING:` block (around line 996). It currently has no braces — add them and append the ETA span after `insertInfo`:

```js
// Before
      case STATE.DELETING:
        if (rangeEl) rangeEl.disabled = true;
        actionBtn.textContent = 'Cancel';
        actionBtn.className   = 'ytc-btn ytc-btn-cancel';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleCancel;
        insertInfo(actionBtn, 'red', 'Deleting...', `0 / ${data.total} deleted`, 0);
        setSegButtonsDisabled(true);
        if (calendarMode) renderCalendar();
        break;
```
```js
// After
      case STATE.DELETING: {
        if (rangeEl) rangeEl.disabled = true;
        actionBtn.textContent = 'Cancel';
        actionBtn.className   = 'ytc-btn ytc-btn-cancel';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleCancel;
        insertInfo(actionBtn, 'red', 'Deleting...', `0 / ${data.total} deleted`, 0);
        const infoBox = document.querySelector('#ytc-panel .ytc-info-red');
        if (infoBox) {
          const eta = document.createElement('span');
          eta.id = 'ytc-eta';
          eta.style.cssText = 'display:block;font-size:11px;opacity:0.75;margin-top:3px;';
          infoBox.appendChild(eta);
        }
        setSegButtonsDisabled(true);
        if (calendarMode) renderCalendar();
        break;
      }
```

- [ ] **Step 4: Update `updateDeletingProgress` to write the ETA**

Find `updateDeletingProgress` (around line 1086):

```js
// Before
  function updateDeletingProgress(deleted, total, skipped) {
    const strong = document.querySelector('#ytc-panel .ytc-info-red .ytc-info-strong');
    const bar    = document.querySelector('#ytc-panel .ytc-progress-bar');
    if (strong) {
      strong.textContent = skipped > 0
        ? `${deleted} deleted, ${skipped} skipped / ${total}`
        : `${deleted} / ${total} deleted`;
    }
    if (bar) bar.style.width = `${Math.round((deleted / total) * 100)}%`;
  }
```
```js
// After
  function updateDeletingProgress(deleted, total, skipped) {
    const strong = document.querySelector('#ytc-panel .ytc-info-red .ytc-info-strong');
    const bar    = document.querySelector('#ytc-panel .ytc-progress-bar');
    const eta    = document.getElementById('ytc-eta');
    if (strong) {
      strong.textContent = skipped > 0
        ? `${deleted} deleted, ${skipped} skipped / ${total}`
        : `${deleted} / ${total} deleted`;
    }
    if (bar) bar.style.width = `${Math.round((deleted / total) * 100)}%`;
    if (eta && deleted > 0 && deleted < total) {
      const avgMs  = (Date.now() - deletionStartTime) / deleted;
      const remSec = Math.round(avgMs * (total - deleted) / 1000);
      eta.textContent = remSec >= 90
        ? `~${Math.round(remSec / 60)}m remaining`
        : `~${remSec}s remaining`;
    }
  }
```

- [ ] **Step 5: Bump version to 1.6**

Find the userscript header:

```js
// Before
// @version      1.5
```
```js
// After
// @version      1.6
```

- [ ] **Step 6: Manual verification**

Install the updated script. Delete a batch of 10+ items. Confirm:
1. During deletion, the red progress box shows a third line like `~12s remaining` that updates after each item.
2. The ETA line disappears once `deleted === total` (last item complete).
3. Progress count, bar, and skip counter still update correctly.
4. No regressions: Cancel, DONE state, Refresh Page button, Scan Again all still work.

- [ ] **Step 7: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: show live ETA during deletion, bump to v1.6"
```
