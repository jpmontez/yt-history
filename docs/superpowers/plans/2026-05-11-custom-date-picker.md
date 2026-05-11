# Custom Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline 📅 icon button to the YT History Cleaner panel that opens a custom date / date-range picker, letting users delete history older than an exact day or within a specific date range.

**Architecture:** All changes are additive to the single IIFE in `yt-history-cleaner.user.js`. New module-level state tracks calendar mode and selected dates. A filter-function pattern replaces the raw cutoff date passed to `scrollAndCollect`, so both preset and custom-range modes share the same scan/delete loop without modification.

**Tech Stack:** Vanilla JS, inline CSS — no external dependencies (matches the existing codebase).

---

## File Map

| File | Change |
|---|---|
| `yt-history-cleaner.user.js` | All changes — CSS additions, new state, new functions, modified functions |

---

### Task 1: Add CSS for the calendar UI

**Files:**
- Modify: `yt-history-cleaner.user.js` — `STYLES` constant (lines 42–120)

- [ ] **Step 1: Append calendar rules inside the STYLES template literal, after the last existing rule (before the closing backtick)**

```css
  #ytc-panel .ytc-cal-row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 10px;
  }
  #ytc-panel .ytc-cal-row select {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
  }
  #ytc-panel .ytc-cal-btn {
    flex-shrink: 0;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 5px 8px;
    background: #fff;
    color: #5f6368;
    font-size: 14px;
    cursor: pointer;
    line-height: 1;
  }
  #ytc-panel .ytc-cal-btn.active {
    border-color: #1a73e8;
    background: #e8f0fe;
    color: #1a73e8;
  }
  #ytc-panel .ytc-cal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-calendar {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 10px;
    background: #fafafa;
  }
  #ytc-panel .ytc-cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  #ytc-panel .ytc-cal-nav {
    font-size: 14px;
    color: #5f6368;
    cursor: pointer;
    border: none;
    background: none;
    padding: 0 4px;
    line-height: 1;
  }
  #ytc-panel .ytc-cal-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  #ytc-panel .ytc-cal-month {
    font-size: 11px;
    font-weight: 600;
    color: #202124;
  }
  #ytc-panel .ytc-cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    text-align: center;
  }
  #ytc-panel .ytc-cal-dh {
    font-size: 9px;
    color: #80868b;
    padding: 1px 0;
  }
  #ytc-panel .ytc-cal-cell {
    font-size: 10px;
    padding: 3px 0;
    cursor: pointer;
    border-radius: 50%;
    color: #202124;
  }
  #ytc-panel .ytc-cal-cell.spillover {
    color: #ccc;
    cursor: default;
    pointer-events: none;
  }
  #ytc-panel .ytc-cal-cell.in-range {
    background: #e8f0fe;
    color: #1a73e8;
    border-radius: 0;
  }
  #ytc-panel .ytc-cal-cell.range-start {
    background: #1a73e8;
    color: #fff;
    border-radius: 50% 0 0 50%;
    font-weight: 600;
  }
  #ytc-panel .ytc-cal-cell.range-end {
    background: #1a73e8;
    color: #fff;
    border-radius: 0 50% 50% 0;
    font-weight: 600;
  }
  #ytc-panel .ytc-cal-cell.selected-single {
    background: #1a73e8;
    color: #fff;
    border-radius: 50%;
    font-weight: 600;
  }
  #ytc-panel .ytc-cal-cell.cell-disabled {
    pointer-events: none;
    opacity: 0.4;
  }
  #ytc-panel .ytc-cal-hint {
    font-size: 9px;
    color: #80868b;
    text-align: center;
    margin-top: 6px;
  }
```

- [ ] **Step 2: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "style: add CSS for calendar date picker widget"
```

---

### Task 2: Add calendar state variables

**Files:**
- Modify: `yt-history-cleaner.user.js` — module-level state block (after line 131)

- [ ] **Step 1: Add five calendar state variables after the existing three**

After:
```js
  let currentState = STATE.IDLE;
  let foundItems   = [];
  let deletedCount = 0;
```

Add:
```js
  let calendarMode  = false;
  let calendarYear  = 0;
  let calendarMonth = 0;
  let selectedStart = null; // Date | null — always the earlier of the two picked dates
  let selectedEnd   = null; // Date | null — always the later of the two picked dates
```

- [ ] **Step 2: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add calendar state variables"
```

---

### Task 3: Add `getCustomRange` and `isSectionInCustomRange`

**Files:**
- Modify: `yt-history-cleaner.user.js` — add two functions immediately after `isSectionOlderThanCutoff` (currently line 334)

- [ ] **Step 1: Add both functions**

```js
  function getCustomRange() {
    return { start: selectedStart, end: selectedEnd };
  }

  function isSectionInCustomRange(headerText, range) {
    const date = parseSectionDate(headerText);
    if (!date) return false;
    if (range.end === null) return date <= range.start;
    return date >= range.start && date <= range.end;
  }
```

- [ ] **Step 2: Verify filter logic in the browser console**

Open any page, open DevTools console, paste and run:

```js
const d = (y, m, day) => new Date(y, m - 1, day);

function testRange(date, range) {
  if (!date) return false;
  if (range.end === null) return date <= range.start;
  return date >= range.start && date <= range.end;
}

// Single-date (older-than) semantics
console.assert(testRange(d(2026,4,30), { start: d(2026,5,7), end: null }) === true,  'FAIL: Apr 30 < May 7');
console.assert(testRange(d(2026,5, 7), { start: d(2026,5,7), end: null }) === true,  'FAIL: May 7 === cutoff');
console.assert(testRange(d(2026,5, 8), { start: d(2026,5,7), end: null }) === false, 'FAIL: May 8 > cutoff');

// Range (inclusive both ends)
const range = { start: d(2026,5,7), end: d(2026,5,14) };
console.assert(testRange(d(2026,5, 6), range) === false, 'FAIL: May 6 before range');
console.assert(testRange(d(2026,5, 7), range) === true,  'FAIL: May 7 = start');
console.assert(testRange(d(2026,5,10), range) === true,  'FAIL: May 10 inside');
console.assert(testRange(d(2026,5,14), range) === true,  'FAIL: May 14 = end');
console.assert(testRange(d(2026,5,15), range) === false, 'FAIL: May 15 after range');

console.log('All assertions passed');
```

Expected: `All assertions passed` with no assertion errors logged.

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add getCustomRange and isSectionInCustomRange"
```

---

### Task 4: Refactor `scrollAndCollect` to accept a filter function

**Files:**
- Modify: `yt-history-cleaner.user.js` — `scrollAndCollect` function (currently line 350)

- [ ] **Step 1: Change the signature**

Change:
```js
  function scrollAndCollect(cutoff, sameSizeCount, lastHeight) {
```
to:
```js
  function scrollAndCollect(filterFn, sameSizeCount, lastHeight) {
```

- [ ] **Step 2: Replace the section filter call**

Change:
```js
      if (!isSectionOlderThanCutoff(sd.text, cutoff)) continue;
```
to:
```js
      if (!filterFn(sd.text)) continue;
```

- [ ] **Step 3: Update the recursive tail call**

Change:
```js
    setTimeout(() => scrollAndCollect(cutoff, newSameCount, currentHeight), SCROLL_PAUSE_MS);
```
to:
```js
    setTimeout(() => scrollAndCollect(filterFn, newSameCount, currentHeight), SCROLL_PAUSE_MS);
```

- [ ] **Step 4: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "refactor: scrollAndCollect takes a filter function instead of raw cutoff"
```

---

### Task 5: Update `handleScan` to pass the right filter

**Files:**
- Modify: `yt-history-cleaner.user.js` — `handleScan` function (currently line 341)

- [ ] **Step 1: Replace `handleScan` with the branching version**

```js
  function handleScan() {
    if (currentState !== STATE.IDLE) return;
    foundItems   = [];
    deletedCount = 0;

    let filterFn;
    if (calendarMode) {
      const range = getCustomRange();
      filterFn = (headerText) => isSectionInCustomRange(headerText, range);
    } else {
      const cutoff = getCutoffDate();
      filterFn = (headerText) => isSectionOlderThanCutoff(headerText, cutoff);
    }

    setState(STATE.SCANNING, { count: 0 });
    scrollAndCollect(filterFn, 0, 0);
  }
```

- [ ] **Step 2: Smoke-test preset mode**

Load `https://www.youtube.com/feed/history`, select "1 week" from the dropdown, click Scan. Confirm it reaches READY state and shows a found-items count. Do not delete.

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: handleScan branches on calendarMode to choose filter"
```

---

### Task 6: Add `buildCalendar`

**Files:**
- Modify: `yt-history-cleaner.user.js` — add `buildCalendar` after the existing `buildPanel` function

- [ ] **Step 1: Add the function**

```js
  function buildCalendar() {
    const cal = document.createElement('div');
    cal.id = 'ytc-calendar';
    cal.className = 'ytc-calendar';
    cal.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'ytc-cal-header';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'ytc-cal-nav';
    prevBtn.textContent = '‹';
    prevBtn.onclick = () => handleMonthNav(-1);

    const monthLabel = document.createElement('span');
    monthLabel.id = 'ytc-cal-month';
    monthLabel.className = 'ytc-cal-month';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'ytc-cal-nav';
    nextBtn.textContent = '›';
    nextBtn.onclick = () => handleMonthNav(1);

    header.appendChild(prevBtn);
    header.appendChild(monthLabel);
    header.appendChild(nextBtn);
    cal.appendChild(header);

    const grid = document.createElement('div');
    grid.id = 'ytc-cal-grid';
    grid.className = 'ytc-cal-grid';
    cal.appendChild(grid);

    const hint = document.createElement('div');
    hint.id = 'ytc-cal-hint';
    hint.className = 'ytc-cal-hint';
    hint.textContent = 'Select a date';
    cal.appendChild(hint);

    return cal;
  }
```

- [ ] **Step 2: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add buildCalendar DOM structure builder"
```

---

### Task 7: Modify `buildPanel` to add the icon button and calendar

**Files:**
- Modify: `yt-history-cleaner.user.js` — `buildPanel` function (currently lines 152–183)

- [ ] **Step 1: Replace `buildPanel` entirely**

```js
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

    const row = document.createElement('div');
    row.className = 'ytc-cal-row';

    const select = document.createElement('select');
    select.id = 'ytc-range';
    TIME_RANGES.forEach((range, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = range.label;
      select.appendChild(opt);
    });
    row.appendChild(select);

    const calBtn = document.createElement('button');
    calBtn.id = 'ytc-cal-btn';
    calBtn.className = 'ytc-cal-btn';
    calBtn.textContent = '📅';
    calBtn.title = 'Pick a custom date range';
    calBtn.onclick = toggleCalendarMode;
    row.appendChild(calBtn);

    panel.appendChild(row);
    panel.appendChild(buildCalendar());

    const btn = document.createElement('button');
    btn.id = 'ytc-action';
    btn.className = 'ytc-btn ytc-btn-blue';
    btn.textContent = 'Scan';
    panel.appendChild(btn);

    return panel;
  }
```

- [ ] **Step 2: Verify panel renders on the history page**

Load `https://www.youtube.com/feed/history`. The panel should show the dropdown and 📅 icon on the same row. No calendar visible. Scan button below. Preset dropdown should still work.

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add calendar icon button inline with preset dropdown in buildPanel"
```

---

### Task 8: Add `CAL_MONTHS`, `updateCalendarSummary`, and `renderCalendar`

**Files:**
- Modify: `yt-history-cleaner.user.js` — add after `buildCalendar`

- [ ] **Step 1: Add `CAL_MONTHS` constant and `updateCalendarSummary`**

```js
  const CAL_MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  function updateCalendarSummary() {
    const calEl = document.getElementById('ytc-calendar');
    if (!calEl) return;

    const existing = document.getElementById('ytc-cal-summary');
    if (existing) existing.remove();
    if (!selectedStart) return;

    const summary = document.createElement('div');
    summary.id = 'ytc-cal-summary';
    summary.className = 'ytc-info ytc-info-blue';

    let labelText, strongText;
    if (!selectedEnd) {
      const m   = CAL_MONTHS[selectedStart.getMonth()];
      labelText  = `Older than ${m} ${selectedStart.getDate()}, ${selectedStart.getFullYear()}`;
      strongText = '1 date selected';
    } else {
      const sm   = CAL_MONTHS[selectedStart.getMonth()];
      const em   = CAL_MONTHS[selectedEnd.getMonth()];
      const days = Math.round((selectedEnd - selectedStart) / 86400000) + 1;
      labelText  = `${sm} ${selectedStart.getDate()} – ${em} ${selectedEnd.getDate()}, ${selectedEnd.getFullYear()}`;
      strongText = `${days} days selected`;
    }

    const labelSpan = document.createElement('span');
    labelSpan.textContent = labelText;
    summary.appendChild(labelSpan);

    const strong = document.createElement('strong');
    strong.className = 'ytc-info-strong';
    strong.textContent = strongText;
    summary.appendChild(strong);

    calEl.insertAdjacentElement('afterend', summary);
  }
```

- [ ] **Step 2: Add `renderCalendar`**

```js
  function renderCalendar() {
    const monthLabel = document.getElementById('ytc-cal-month');
    const grid       = document.getElementById('ytc-cal-grid');
    const hint       = document.getElementById('ytc-cal-hint');
    if (!monthLabel || !grid || !hint) return;

    monthLabel.textContent = `${CAL_MONTHS[calendarMonth]} ${calendarYear}`;
    grid.replaceChildren(); // clear previous cells safely

    ['S','M','T','W','T','F','S'].forEach(d => {
      const dh = document.createElement('div');
      dh.className = 'ytc-cal-dh';
      dh.textContent = d;
      grid.appendChild(dh);
    });

    const firstDay      = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth   = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMon = new Date(calendarYear, calendarMonth, 0).getDate();
    const isDisabled    = currentState === STATE.SCANNING || currentState === STATE.DELETING;
    const startMs       = selectedStart ? selectedStart.getTime() : null;
    const endMs         = selectedEnd   ? selectedEnd.getTime()   : null;

    for (let i = firstDay - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.className = 'ytc-cal-cell spillover';
      cell.textContent = String(daysInPrevMon - i);
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(calendarYear, calendarMonth, day);
      const cellMs   = cellDate.getTime();
      const cell     = document.createElement('div');
      cell.className = 'ytc-cal-cell';
      cell.textContent = String(day);

      if (startMs !== null && endMs !== null) {
        if      (cellMs === startMs)                 cell.classList.add('range-start');
        else if (cellMs === endMs)                   cell.classList.add('range-end');
        else if (cellMs > startMs && cellMs < endMs) cell.classList.add('in-range');
      } else if (startMs !== null && cellMs === startMs) {
        cell.classList.add('selected-single');
      }

      if (isDisabled) {
        cell.classList.add('cell-disabled');
      } else {
        cell.onclick = () => handleDateClick(cellDate);
      }

      grid.appendChild(cell);
    }

    const totalCells    = firstDay + daysInMonth;
    const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= trailingCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'ytc-cal-cell spillover';
      cell.textContent = String(i);
      grid.appendChild(cell);
    }

    hint.textContent = !selectedStart
      ? 'Select a date'
      : !selectedEnd
        ? 'Click another date to set a range'
        : 'Click a date to start over';

    updateCalendarSummary();
  }
```

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add renderCalendar and updateCalendarSummary"
```

---

### Task 9: Add `handleMonthNav` and `handleDateClick`

**Files:**
- Modify: `yt-history-cleaner.user.js` — add after `renderCalendar`

- [ ] **Step 1: Add `handleMonthNav`**

```js
  function handleMonthNav(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0)  { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0;  calendarYear++; }
    renderCalendar();
  }
```

- [ ] **Step 2: Add `handleDateClick`**

```js
  function handleDateClick(date) {
    if (!selectedStart) {
      selectedStart = date;
      selectedEnd   = null;
    } else if (!selectedEnd) {
      if (date.getTime() === selectedStart.getTime()) {
        // Same date tapped again — reset
        selectedStart = null;
      } else if (date < selectedStart) {
        // Clicked earlier date first — keep start always earlier
        selectedEnd   = selectedStart;
        selectedStart = date;
      } else {
        selectedEnd = date;
      }
    } else {
      // Third click — start fresh with this date
      selectedStart = date;
      selectedEnd   = null;
    }

    if (currentState === STATE.READY) setState(STATE.IDLE);

    renderCalendar();

    // Keep Scan button in sync with selection
    const actionBtn = document.getElementById('ytc-action');
    if (actionBtn && currentState === STATE.IDLE) {
      actionBtn.disabled = !selectedStart;
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add handleDateClick (two-click range) and handleMonthNav"
```

---

### Task 10: Add `toggleCalendarMode`

**Files:**
- Modify: `yt-history-cleaner.user.js` — add after `handleDateClick`

- [ ] **Step 1: Add the function**

```js
  function toggleCalendarMode() {
    calendarMode = !calendarMode;

    const calBtn  = document.getElementById('ytc-cal-btn');
    const rangeEl = document.getElementById('ytc-range');
    const calEl   = document.getElementById('ytc-calendar');
    const labelEl = document.querySelector('#ytc-panel .ytc-label');

    if (calendarMode) {
      calBtn.classList.add('active');
      rangeEl.disabled         = true;
      rangeEl.style.color      = '#aaa';
      rangeEl.style.background = '#f5f5f5';
      calEl.style.display      = '';
      if (labelEl) labelEl.textContent = 'Delete history from:';

      const now     = new Date();
      calendarYear  = now.getFullYear();
      calendarMonth = now.getMonth();
      selectedStart = null;
      selectedEnd   = null;
      renderCalendar();

      const actionBtn = document.getElementById('ytc-action');
      if (actionBtn) actionBtn.disabled = true;
    } else {
      calBtn.classList.remove('active');
      rangeEl.disabled         = false;
      rangeEl.style.color      = '';
      rangeEl.style.background = '';
      calEl.style.display      = 'none';
      if (labelEl) labelEl.textContent = 'Delete history older than:';

      const summaryEl = document.getElementById('ytc-cal-summary');
      if (summaryEl) summaryEl.remove();

      selectedStart = null;
      selectedEnd   = null;

      const actionBtn = document.getElementById('ytc-action');
      if (actionBtn) actionBtn.disabled = false;

      if (currentState === STATE.READY) setState(STATE.IDLE);
    }
  }
```

- [ ] **Step 2: Verify open/close toggle**

Load `https://www.youtube.com/feed/history`:
- Click 📅 — calendar appears, dropdown grays, label changes to "Delete history from:", Scan disables, icon turns blue
- Click a date — solid blue circle, summary shows "Older than [date]", Scan enables
- Click a second later date — range highlights, summary shows date range and day count
- Click 📅 again — calendar closes, dropdown re-enables, label reverts, summary removed

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: add toggleCalendarMode"
```

---

### Task 11: Update `renderState` to manage the calendar across all states

**Files:**
- Modify: `yt-history-cleaner.user.js` — `renderState` function (currently lines 190–245)

- [ ] **Step 1: Add `calBtn` lookup alongside the existing element lookups**

After:
```js
    const rangeEl   = document.getElementById('ytc-range');
    const actionBtn = document.getElementById('ytc-action');
```

Add:
```js
    const calBtn    = document.getElementById('ytc-cal-btn');
```

- [ ] **Step 2: Update the cleanup selector to preserve the calendar summary**

Change:
```js
    panel.querySelectorAll('.ytc-info, .ytc-hint').forEach(el => el.remove());
```
to:
```js
    panel.querySelectorAll('.ytc-info:not(#ytc-cal-summary), .ytc-hint').forEach(el => el.remove());
```

- [ ] **Step 3: Replace the entire `switch` block**

```js
    switch (state) {

      case STATE.IDLE:
        rangeEl.disabled      = calendarMode;
        rangeEl.onchange      = null;
        actionBtn.textContent = 'Scan';
        actionBtn.className   = 'ytc-btn ytc-btn-blue';
        actionBtn.disabled    = calendarMode && !selectedStart;
        actionBtn.onclick     = handleScan;
        if (calBtn) calBtn.disabled = false;
        if (calendarMode) renderCalendar();
        break;

      case STATE.SCANNING:
        rangeEl.disabled      = true;
        actionBtn.textContent = 'Scanning...';
        actionBtn.className   = 'ytc-btn';
        actionBtn.disabled    = true;
        insertInfo(actionBtn, 'blue', 'Scanning...', `Found ${data.count ?? 0} items`);
        if (calBtn) calBtn.disabled = true;
        if (calendarMode) renderCalendar();
        break;

      case STATE.READY:
        rangeEl.disabled      = calendarMode;
        rangeEl.onchange      = () => setState(STATE.IDLE);
        actionBtn.textContent = `Delete ${data.count} items`;
        actionBtn.className   = 'ytc-btn ytc-btn-red';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleDelete;
        insertInfo(actionBtn, 'blue', 'Ready to delete', `${data.count} items found`);
        if (calBtn) calBtn.disabled = false;
        if (calendarMode) renderCalendar();
        break;

      case STATE.DELETING:
        rangeEl.disabled      = true;
        actionBtn.textContent = 'Deleting...';
        actionBtn.className   = 'ytc-btn';
        actionBtn.disabled    = true;
        insertInfo(actionBtn, 'red', 'Deleting...', `${data.deleted ?? 0} / ${data.total} deleted`);
        if (calBtn) calBtn.disabled = true;
        if (calendarMode) renderCalendar();
        break;

      case STATE.DONE:
        rangeEl.disabled      = calendarMode;
        actionBtn.textContent = 'Scan Again';
        actionBtn.className   = 'ytc-btn ytc-btn-blue';
        actionBtn.disabled    = false;
        actionBtn.onclick     = handleReset;
        insertInfo(actionBtn, 'green', `✓ Done! Deleted ${data.count} items`, null);
        insertHint(actionBtn, 'Refresh the page for changes to be reflected.');
        if (calBtn) calBtn.disabled = false;
        if (calendarMode) renderCalendar();
        break;
    }
```

- [ ] **Step 4: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: update renderState to manage calendar across all states"
```

---

### Task 12: Update `handleReset` to clear calendar selection

**Files:**
- Modify: `yt-history-cleaner.user.js` — `handleReset` function (currently line 500)

- [ ] **Step 1: Replace `handleReset`**

```js
  function handleReset() {
    selectedStart = null;
    selectedEnd   = null;
    const summaryEl = document.getElementById('ytc-cal-summary');
    if (summaryEl) summaryEl.remove();
    initStateIdle();
  }
```

- [ ] **Step 2: Verify "Scan Again" clears the selection**

Run a scan in calendar mode (pick any date, click Scan, wait for READY, then click Delete or use a preset to reach DONE faster). Click "Scan Again". Calendar should remain open but show no highlighted cells; hint reads "Select a date"; no summary box visible.

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: handleReset clears calendar selection on Scan Again"
```

---

### Task 13: Bump version and end-to-end verification

**Files:**
- Modify: `yt-history-cleaner.user.js` — `@version` metadata (line 7)

- [ ] **Step 1: Bump version from `1.1` to `1.2`**

Change:
```js
// @version      1.1
```
to:
```js
// @version      1.2
```

- [ ] **Step 2: End-to-end verification checklist**

Load `https://www.youtube.com/feed/history` and verify each item:

1. Panel renders: dropdown + 📅 icon on same row; no calendar; Scan below
2. Preset mode still works: select "1 week", Scan, confirm READY — do not delete
3. Click 📅 — calendar appears; label → "Delete history from:"; dropdown grays; Scan disables; icon turns blue
4. Navigate months with ‹ / › — label and grid update correctly
5. Click a date — solid blue circle; summary reads "Older than [month] [day], [year]"; Scan enables
6. Click a second date after the first — range highlights; summary shows date span and day count
7. Click a date *before* the first selection — range is still ordered correctly (earlier = start)
8. Click a third date — selection resets to that single date
9. Click 📅 again — calendar closes; label reverts; dropdown re-enables; summary removed
10. With calendar open and single date selected, click Scan — SCANNING → READY with plausible count for that cutoff
11. After DONE, "Scan Again" — calendar stays open; selection cleared; hint reads "Select a date"

- [ ] **Step 3: Final commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "chore: bump version to 1.2 (custom date picker)"
```
