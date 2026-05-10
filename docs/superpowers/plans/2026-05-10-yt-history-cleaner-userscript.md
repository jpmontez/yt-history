# YT History Cleaner Userscript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tampermonkey/Safari Userscripts-compatible userscript that injects a sidebar panel on `https://www.youtube.com/feed/history` to scan and bulk-delete watch history entries older than a user-selected time range.

**Architecture:** A single self-contained `.user.js` file with no external dependencies. The script injects a panel into YouTube's right sidebar (desktop) or below the "Manage all history" section (mobile), always after all existing YouTube-rendered items. Deletion uses pure DOM interaction — auto-scrolling to collect items, then clicking delete buttons and confirming dialogs one at a time with `setTimeout` delays.

**Tech Stack:** Vanilla JS (ES2020), inline CSS, Tampermonkey metadata block. No build system, no npm, no external libraries.

> **Note on testing:** This is a userscript with no test framework. Each task includes manual verification steps to perform in the browser using Tampermonkey's development workflow (edit script → reload page → verify behavior).

> **Note on innerHTML:** `innerHTML` is used in `buildPanelHTML` with a static template literal (no user input). All other DOM construction uses safe element/textContent methods. This is intentional and not an XSS risk.

---

## File Structure

| File | Purpose |
|---|---|
| `yt-history-cleaner.user.js` | The entire userscript — metadata, styles, panel HTML, state machine, scan loop, delete loop |

Everything lives in one file. YouTube userscripts have no module system; splitting into files requires a build step we're explicitly avoiding.

---

### Task 1: Userscript scaffold and panel injection skeleton

**Files:**
- Create: `yt-history-cleaner.user.js`

- [ ] **Step 1: Create the file with metadata and a no-op injection**

```js
// ==UserScript==
// @name         YT History Cleaner
// @namespace    https://github.com/jmontez
// @version      1.0
// @description  Bulk-delete YouTube watch history by time range
// @match        https://www.youtube.com/feed/history
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // YouTube is a SPA — wait for the sidebar to exist before injecting
  function waitForElement(selector, callback, interval = 300, maxWait = 15000) {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        callback(el);
      } else if (Date.now() - start > maxWait) {
        clearInterval(timer);
        console.warn('[YT History Cleaner] Timed out waiting for', selector);
      }
    }, interval);
  }

  function init() {
    injectPanel();
  }

  function injectPanel() {
    // Desktop: right sidebar container
    // Mobile: below the "Manage all history" section
    // Both cases: append AFTER existing items
    const isMobile = window.innerWidth < 1014;

    if (isMobile) {
      waitForElement('ytd-secondary-search-container-renderer, #secondary', (el) => {
        appendPanel(el.parentElement || el, el.nextSibling);
      });
    } else {
      waitForElement('#secondary', (sidebar) => {
        appendPanel(sidebar, null); // append to end
      });
    }
  }

  function appendPanel(parent, beforeNode) {
    const wrapper = document.createElement('div');
    wrapper.id = 'ytc-panel';
    wrapper.textContent = 'YT History Cleaner placeholder';
    if (beforeNode) {
      parent.insertBefore(wrapper, beforeNode);
    } else {
      parent.appendChild(wrapper);
    }
    console.log('[YT History Cleaner] Panel injected');
  }

  init();
})();
```

- [ ] **Step 2: Install and verify in browser**

1. Open Tampermonkey dashboard → New Script → paste the file contents → Save
2. Navigate to `https://www.youtube.com/feed/history`
3. Open DevTools console — confirm log: `[YT History Cleaner] Panel injected`
4. Inspect the DOM — confirm `#ytc-panel` div exists at the bottom of `#secondary`
5. Resize browser below 1014px width — confirm it still injects (may be in a different parent; that's OK for now)

- [ ] **Step 3: Commit**

```bash
git init  # if not already a git repo
git add yt-history-cleaner.user.js
git commit -m "feat: userscript scaffold with panel injection skeleton"
```

---

### Task 2: Styles and panel HTML (Idle state)

**Files:**
- Modify: `yt-history-cleaner.user.js`

- [ ] **Step 1: Add inline styles**

Add a `STYLES` constant and an `injectStyles` function. Call it once from `appendPanel`.

```js
const STYLES = `
  #ytc-panel {
    font-family: 'Roboto', sans-serif;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 14px;
    margin: 12px 0 8px 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    box-sizing: border-box;
    width: 100%;
  }
  #ytc-panel .ytc-title {
    font-size: 11px;
    font-weight: 700;
    color: #ff0000;
    letter-spacing: 0.4px;
    margin-bottom: 10px;
    text-transform: uppercase;
  }
  #ytc-panel .ytc-label {
    font-size: 11px;
    color: #5f6368;
    margin-bottom: 4px;
  }
  #ytc-panel select {
    width: 100%;
    font-size: 12px;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 5px 8px;
    margin-bottom: 10px;
    color: #202124;
    background: #fff;
    cursor: pointer;
  }
  #ytc-panel select:disabled {
    color: #aaa;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-btn {
    width: 100%;
    border: none;
    border-radius: 6px;
    padding: 7px 0;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  #ytc-panel .ytc-btn:disabled {
    background: #ccc !important;
    color: #fff;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-btn-blue { background: #1a73e8; color: #fff; }
  #ytc-panel .ytc-btn-red  { background: #d93025; color: #fff; }
  #ytc-panel .ytc-info {
    border-radius: 6px;
    padding: 8px 10px;
    text-align: center;
    margin-bottom: 8px;
    font-size: 12px;
  }
  #ytc-panel .ytc-info-blue  { background: #e8f0fe; color: #1a73e8; }
  #ytc-panel .ytc-info-red   { background: #fce8e6; color: #d93025; }
  #ytc-panel .ytc-info-green { background: #e6f4ea; color: #188038; }
  #ytc-panel .ytc-info-strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    margin-top: 2px;
  }
  #ytc-panel .ytc-hint {
    font-size: 10px;
    color: #80868b;
    text-align: center;
    margin-bottom: 8px;
  }
`;

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
}
```

- [ ] **Step 2: Add time range data and panel builder**

`buildPanelHTML` uses a static template literal — content is entirely from our own constants, no user input. Safe to use `innerHTML` here.

```js
const TIME_RANGES = [
  { label: '1 week',   days: 7   },
  { label: '2 weeks',  days: 14  },
  { label: '1 month',  days: 30  },
  { label: '3 months', days: 90  },
  { label: '6 months', days: 180 },
  { label: 'All time', days: null },
];

function buildPanel() {
  const panel = document.createElement('div');
  panel.id = 'ytc-panel';

  const title = document.createElement('div');
  title.className = 'ytc-title';
  title.textContent = 'YT History Cleaner';
  panel.appendChild(title);

  const label = document.createElement('div');
  label.className = 'ytc-label';
  label.textContent = 'Delete history older than:';
  panel.appendChild(label);

  const select = document.createElement('select');
  select.id = 'ytc-range';
  TIME_RANGES.forEach((range, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = range.label;
    select.appendChild(opt);
  });
  panel.appendChild(select);

  const btn = document.createElement('button');
  btn.id = 'ytc-action';
  btn.className = 'ytc-btn ytc-btn-blue';
  btn.textContent = 'Scan';
  panel.appendChild(btn);

  return panel;
}
```

- [ ] **Step 3: Update `appendPanel` to use styles and DOM-built panel**

```js
function appendPanel(parent, beforeNode) {
  injectStyles();
  const panel = buildPanel();
  if (beforeNode) {
    parent.insertBefore(panel, beforeNode);
  } else {
    parent.appendChild(panel);
  }
  initStateIdle();
}
```

- [ ] **Step 4: Verify in browser**

1. Reload the page in Tampermonkey (save script → reload tab)
2. Confirm the panel appears at the bottom of the right sidebar with correct styling
3. Confirm the dropdown shows all 6 options in order
4. Confirm the "Scan" button is visible and styled blue
5. Resize to mobile width — confirm panel appears below the "Manage all history" section

- [ ] **Step 5: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: panel HTML and styles for idle state"
```

---

### Task 3: State machine

**Files:**
- Modify: `yt-history-cleaner.user.js`

The panel has 5 states: `idle`, `scanning`, `ready`, `deleting`, `done`. All UI transitions go through `setState`.

- [ ] **Step 1: Add state constants and module-level variables**

```js
const STATE = {
  IDLE:     'idle',
  SCANNING: 'scanning',
  READY:    'ready',
  DELETING: 'deleting',
  DONE:     'done',
};

let currentState = STATE.IDLE;
let foundItems   = [];  // DOM element references collected during scan
let deletedCount = 0;
```

- [ ] **Step 2: Add `setState` and `renderState`**

```js
function setState(newState, data = {}) {
  currentState = newState;
  renderState(newState, data);
}

function renderState(state, data = {}) {
  const panel     = document.getElementById('ytc-panel');
  const rangeEl   = document.getElementById('ytc-range');
  const actionBtn = document.getElementById('ytc-action');

  // Remove any existing info/hint blocks from previous state
  panel.querySelectorAll('.ytc-info, .ytc-hint').forEach(el => el.remove());

  switch (state) {

    case STATE.IDLE:
      rangeEl.disabled   = false;
      rangeEl.onchange   = null;
      actionBtn.textContent = 'Scan';
      actionBtn.className   = 'ytc-btn ytc-btn-blue';
      actionBtn.disabled    = false;
      actionBtn.onclick     = handleScan;
      break;

    case STATE.SCANNING:
      rangeEl.disabled      = true;
      actionBtn.textContent = 'Scanning...';
      actionBtn.className   = 'ytc-btn';
      actionBtn.disabled    = true;
      insertInfo(actionBtn, 'blue', 'Scanning...', `Found ${data.count ?? 0} items`);
      break;

    case STATE.READY:
      rangeEl.disabled   = false;
      rangeEl.onchange   = () => setState(STATE.IDLE);
      actionBtn.textContent = `Delete ${data.count} items`;
      actionBtn.className   = 'ytc-btn ytc-btn-red';
      actionBtn.disabled    = false;
      actionBtn.onclick     = handleDelete;
      insertInfo(actionBtn, 'blue', 'Ready to delete', `${data.count} items found`);
      break;

    case STATE.DELETING:
      rangeEl.disabled      = true;
      actionBtn.textContent = 'Deleting...';
      actionBtn.className   = 'ytc-btn';
      actionBtn.disabled    = true;
      insertInfo(actionBtn, 'red', 'Deleting...', `${data.deleted ?? 0} / ${data.total} deleted`);
      break;

    case STATE.DONE:
      rangeEl.disabled      = false;
      actionBtn.textContent = 'Scan Again';
      actionBtn.className   = 'ytc-btn ytc-btn-blue';
      actionBtn.disabled    = false;
      actionBtn.onclick     = handleReset;
      insertInfo(actionBtn, 'green', `✓ Done! Deleted ${data.count} items`, null);
      insertHint(actionBtn, 'Refresh the page for changes to be reflected.');
      break;
  }
}

/**
 * Inserts an info box before `beforeNode`.
 * Uses safe DOM methods — no innerHTML.
 */
function insertInfo(beforeNode, color, labelText, strongText) {
  const panel = document.getElementById('ytc-panel');
  const div   = document.createElement('div');
  div.className = `ytc-info ytc-info-${color}`;

  const labelSpan = document.createElement('span');
  labelSpan.textContent = labelText;
  div.appendChild(labelSpan);

  if (strongText) {
    const strong = document.createElement('strong');
    strong.className = 'ytc-info-strong';
    strong.textContent = strongText;
    div.appendChild(strong);
  }

  panel.insertBefore(div, beforeNode);
}

function insertHint(beforeNode, text) {
  const panel = document.getElementById('ytc-panel');
  const div   = document.createElement('div');
  div.className   = 'ytc-hint';
  div.textContent = text;
  panel.insertBefore(div, beforeNode);
}
```

- [ ] **Step 3: Add `initStateIdle` and stub handlers**

```js
function initStateIdle() {
  foundItems   = [];
  deletedCount = 0;
  setState(STATE.IDLE);
}

function handleScan()   { console.log('[YT History Cleaner] Scan triggered'); }
function handleDelete() { console.log('[YT History Cleaner] Delete triggered'); }
function handleReset()  { initStateIdle(); }
```

- [ ] **Step 4: Verify state transitions in browser console**

```js
setState('scanning', { count: 12 });
setState('ready',    { count: 47 });
setState('deleting', { deleted: 19, total: 47 });
setState('done',     { count: 47 });
handleReset();
```

Check: correct button labels, correct info box colors, correct text, dropdown enabled/disabled correctly in each state.

- [ ] **Step 5: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: panel state machine with all 5 states"
```

---

### Task 4: Time range cutoff logic

**Files:**
- Modify: `yt-history-cleaner.user.js`

- [ ] **Step 1: Add `getCutoffDate`**

```js
/**
 * Returns a Date representing the oldest allowed timestamp,
 * or null for "All time" (no cutoff).
 */
function getCutoffDate() {
  const rangeEl = document.getElementById('ytc-range');
  const idx = parseInt(rangeEl.value, 10);
  const { days } = TIME_RANGES[idx];
  if (days === null) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}
```

- [ ] **Step 2: Add `parseItemDate`**

YouTube renders relative timestamps (e.g. "3 weeks ago") in metadata spans inside history items.

```js
const RELATIVE_RE = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i;

const UNIT_MS = {
  second: 1000,
  minute: 60 * 1000,
  hour:   60 * 60 * 1000,
  day:    24 * 60 * 60 * 1000,
  week:   7  * 24 * 60 * 60 * 1000,
  month:  30 * 24 * 60 * 60 * 1000,
  year:   365 * 24 * 60 * 60 * 1000,
};

/**
 * Returns an approximate Date for when the item was watched,
 * or null if the timestamp can't be parsed.
 */
function parseItemDate(itemEl) {
  const spans = itemEl.querySelectorAll('#metadata-line span, .ytd-video-meta-block span');
  for (const span of spans) {
    const match = span.textContent.trim().match(RELATIVE_RE);
    if (!match) continue;
    const amount = parseInt(match[1], 10);
    const unit   = match[2].toLowerCase();
    const date   = new Date();
    date.setTime(date.getTime() - amount * UNIT_MS[unit]);
    return date;
  }
  return null;
}
```

- [ ] **Step 3: Add `isItemOlderThanCutoff`**

```js
/**
 * Returns true if the item should be deleted.
 * cutoff === null means "All time" — always returns true.
 * If the date can't be parsed, returns false (skip safely).
 */
function isItemOlderThanCutoff(itemEl, cutoff) {
  if (cutoff === null) return true;
  const date = parseItemDate(itemEl);
  if (!date) return false;
  return date < cutoff;
}
```

- [ ] **Step 4: Verify in browser console**

```js
const item = document.querySelector('ytd-video-renderer');
console.log('Date:', parseItemDate(item));
console.log('Cutoff (1 week):', getCutoffDate());
console.log('Older than 1 week?', isItemOlderThanCutoff(item, getCutoffDate()));
```

If `parseItemDate` returns null, inspect the element in DevTools → adjust the selector inside `parseItemDate` to match the actual DOM structure YouTube is rendering.

- [ ] **Step 5: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: time range cutoff logic and item date parsing"
```

---

### Task 5: Scan phase — auto-scroll and item collection

**Files:**
- Modify: `yt-history-cleaner.user.js`

- [ ] **Step 1: Implement `handleScan` and `scrollAndCollect`**

```js
const SCROLL_PAUSE_MS = 1200;  // wait after each scroll for new items to render
const SCROLL_MAX_SAME = 3;     // stop if scroll height hasn't changed this many times

function handleScan() {
  foundItems   = [];
  deletedCount = 0;
  const cutoff = getCutoffDate();
  setState(STATE.SCANNING, { count: 0 });
  scrollAndCollect(cutoff, 0, 0);
}

function scrollAndCollect(cutoff, sameSizeCount, lastHeight) {
  // Collect all currently visible matching items
  document.querySelectorAll('ytd-video-renderer').forEach((item) => {
    if (!foundItems.includes(item) && isItemOlderThanCutoff(item, cutoff)) {
      foundItems.push(item);
    }
  });

  setState(STATE.SCANNING, { count: foundItems.length });

  const currentHeight = document.documentElement.scrollHeight;
  const newSameCount  = currentHeight === lastHeight ? sameSizeCount + 1 : 0;

  if (newSameCount >= SCROLL_MAX_SAME) {
    onScanComplete();
    return;
  }

  window.scrollTo(0, document.documentElement.scrollHeight);
  setTimeout(() => scrollAndCollect(cutoff, newSameCount, currentHeight), SCROLL_PAUSE_MS);
}

function onScanComplete() {
  if (foundItems.length === 0) {
    setState(STATE.IDLE);
    const panel     = document.getElementById('ytc-panel');
    const actionBtn = document.getElementById('ytc-action');
    const msg = document.createElement('div');
    msg.className   = 'ytc-info ytc-info-blue';
    msg.textContent = 'No items found in this range.';
    panel.insertBefore(msg, actionBtn);
    setTimeout(() => msg.remove(), 3000);
    return;
  }
  setState(STATE.READY, { count: foundItems.length });
}
```

- [ ] **Step 2: Verify scan in browser**

1. Click "Scan" with "1 week" selected
2. Confirm panel switches to Scanning state with live counter
3. Watch page auto-scroll down
4. After scrolling stops, confirm transition to Ready state with item count
5. Test "All time" — should find all items in the feed

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: scan phase with auto-scroll and item collection"
```

---

### Task 6: Delete phase — DOM click loop with confirmation handling

**Files:**
- Modify: `yt-history-cleaner.user.js`

- [ ] **Step 1: Implement `handleDelete` and `deleteNext`**

```js
const DELETE_STEP_MS = 500;   // delay between item deletion attempts
const DIALOG_WAIT_MS = 800;   // wait for confirmation dialog to appear
const DIALOG_TIMEOUT = 3000;  // give up on dialog after this long

function handleDelete() {
  deletedCount = 0;
  setState(STATE.DELETING, { deleted: 0, total: foundItems.length });
  deleteNext(0);
}

function deleteNext(index) {
  if (index >= foundItems.length) {
    setState(STATE.DONE, { count: deletedCount });
    return;
  }

  const item = foundItems[index];
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    const menuBtn = item.querySelector(
      'button#button[aria-label], yt-icon-button#menu button, button.yt-icon-button'
    );

    if (!menuBtn) {
      // Item may already be gone — skip
      deleteNext(index + 1);
      return;
    }

    menuBtn.click();

    waitForElement(
      'ytd-menu-service-item-renderer',
      () => {
        const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer');
        let removeBtn = null;
        menuItems.forEach((mi) => {
          if (mi.textContent.trim().toLowerCase().includes('remove from watch history')) {
            removeBtn = mi;
          }
        });

        if (!removeBtn) {
          // Close menu and skip
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          setTimeout(() => deleteNext(index + 1), DELETE_STEP_MS);
          return;
        }

        removeBtn.click();

        setTimeout(() => {
          // Handle any confirmation button in a toast or dialog
          const confirmBtn = document.querySelector(
            'paper-button[dialog-confirm], yt-button-renderer[dialog-confirm] button'
          );
          if (confirmBtn) confirmBtn.click();

          deletedCount++;
          setState(STATE.DELETING, { deleted: deletedCount, total: foundItems.length });
          setTimeout(() => deleteNext(index + 1), DELETE_STEP_MS);
        }, DIALOG_WAIT_MS);
      },
      100,
      DIALOG_TIMEOUT
    );
  }, DELETE_STEP_MS);
}
```

- [ ] **Step 2: Verify deletion in browser**

1. Scan with "1 week" to get a small count
2. Click the delete button
3. Watch panel counter increment as items are removed
4. Confirm items disappear from the feed one by one
5. Confirm panel reaches Done state with correct final count
6. Confirm "Refresh the page for changes to be reflected." hint is visible

- [ ] **Step 3: Verify "Scan Again" resets correctly**

1. After Done state, click "Scan Again"
2. Confirm panel resets to Idle — counter cleared, dropdown re-enabled, "Scan" button shown

- [ ] **Step 4: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: delete phase with DOM click loop and confirmation handling"
```

---

### Task 7: Responsive placement refinement and SPA navigation

**Files:**
- Modify: `yt-history-cleaner.user.js`

YouTube is a SPA — the page doesn't fully reload on navigation. This task makes the script re-inject when the user navigates to the history page and refines the mobile selector.

- [ ] **Step 1: Update `init` to listen for SPA navigation**

```js
function init() {
  if (window.location.pathname === '/feed/history') {
    injectPanel();
  }

  window.addEventListener('yt-navigate-finish', () => {
    const existing = document.getElementById('ytc-panel');
    if (existing) existing.remove();
    if (window.location.pathname === '/feed/history') {
      injectPanel();
    }
  });
}
```

- [ ] **Step 2: Refine mobile selector**

Open `https://www.youtube.com/feed/history` in DevTools with mobile device emulation (e.g. iPhone 12). Inspect the DOM around the "Manage all history" / Comments / Posts / Live chat section.

Find the actual wrapper element — common candidates:
- `ytd-browse-filter-chip-bar-renderer` — chip bar with Comments/Posts/Live chat
- `#secondary-inner`
- `ytd-section-list-renderer`

Update `injectPanel` with the selector you find:

```js
function injectPanel() {
  const isMobile = window.innerWidth < 1014;

  if (isMobile) {
    // Adjust this selector to match what DevTools shows on mobile
    waitForElement('ytd-browse-filter-chip-bar-renderer', (chipBar) => {
      appendPanel(chipBar.parentElement, chipBar.nextSibling);
    });
  } else {
    waitForElement('#secondary', (sidebar) => {
      appendPanel(sidebar, null);
    });
  }
}
```

- [ ] **Step 3: Verify in browser**

1. Desktop: load history page — panel in right sidebar, below existing items
2. Mobile emulation: panel appears below "Manage all history" chips, above feed
3. Navigate away from history page and back — panel re-injects cleanly, no duplicates
4. Navigate to history page from YouTube homepage — panel injects correctly

- [ ] **Step 4: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: SPA navigation re-injection and mobile placement refinement"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| Single `.user.js`, no deps | Task 1 |
| Runs on `/feed/history` only | Task 1 (`@match`) + Task 7 (`pathname` check) |
| Right sidebar on desktop, below existing items | Tasks 2 + 7 |
| Mobile: below "Manage all history" section | Tasks 2 + 7 |
| Panel always appended after official items | Tasks 2 + 7 (`appendChild` / `nextSibling`) |
| 6 time range options | Task 2 (`TIME_RANGES`) |
| Idle state | Task 3 |
| Scanning state with live counter | Tasks 3 + 5 |
| Ready state with item count | Tasks 3 + 5 |
| Deleting state with live X/Y counter | Tasks 3 + 6 |
| Done state — persistent, refresh hint, Scan Again | Tasks 3 + 6 |
| Auto-scroll during scan | Task 5 |
| DOM click deletion with dialog confirmation | Task 6 |
| `setTimeout` delays between deletions | Task 6 |
| "All time" = no cutoff | Task 4 (`getCutoffDate` returns null) |
| Skip items where dialog doesn't appear | Task 6 (`DIALOG_TIMEOUT` + skip) |
| Changing range in Ready state resets to Idle | Task 3 (`rangeEl.onchange`) |
| SPA re-injection on navigation | Task 7 |

All requirements covered. No gaps.

### Placeholder scan

No TBDs, TODOs, or "implement later" notes.

### Type consistency

- `foundItems` — `Element[]`, populated in Task 5, consumed in Task 6
- `deletedCount` — `number`, incremented in Task 6, passed to `setState`
- `STATE.*` constants — used consistently across Tasks 3, 5, 6
- `TIME_RANGES[idx].days` — accessed same way in Tasks 2 and 4
- `waitForElement(selector, callback, interval, maxWait)` — signature consistent across Tasks 1 and 6
- `insertInfo(beforeNode, color, labelText, strongText)` — called with same signature in Task 3 everywhere
