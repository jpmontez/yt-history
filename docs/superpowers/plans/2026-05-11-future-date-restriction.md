# Future Date Restriction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grey out and disable future dates in the custom date picker so only today and past dates are selectable.

**Architecture:** Three surgical edits to `yt-history-cleaner.user.js` — one new CSS rule, one `id` on the `›` nav button, and updated logic in `renderCalendar` to classify future cells and disable forward navigation on the current month. No other files or functions change.

**Tech Stack:** Vanilla JS, inline CSS — no external dependencies (matches existing codebase). No automated test framework; verification is manual browser testing.

---

## File Map

| File | Change |
|---|---|
| `yt-history-cleaner.user.js` | CSS addition, `buildCalendar` id, `renderCalendar` logic |

---

### Task 1: Add `.future` CSS rule and `id` the `›` button

**Files:**
- Modify: `yt-history-cleaner.user.js:228-231` (CSS block) and `:341-344` (`buildCalendar`)

- [ ] **Step 1: Append `.future` CSS rule after `.cell-disabled` (line 231)**

Find this block (lines 228–231):
```css
  #ytc-panel .ytc-cal-cell.cell-disabled {
    pointer-events: none;
    opacity: 0.4;
  }
```

Insert immediately after it (before the `.ytc-cal-hint` rule on line 232):
```css
  #ytc-panel .ytc-cal-cell.future {
    color: #ccc;
    cursor: default;
    pointer-events: none;
  }
```

- [ ] **Step 2: Add `id` to `nextBtn` in `buildCalendar` (line 342)**

Find this block (lines 341–344):
```js
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ytc-cal-nav';
    nextBtn.textContent = '›';
    nextBtn.onclick = () => handleMonthNav(1);
```

Replace with:
```js
    const nextBtn = document.createElement('button');
    nextBtn.id = 'ytc-cal-next';
    nextBtn.className = 'ytc-cal-nav';
    nextBtn.textContent = '›';
    nextBtn.onclick = () => handleMonthNav(1);
```

- [ ] **Step 3: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "style: add future CSS class and id ytc-cal-next to nav button"
```

---

### Task 2: Update `renderCalendar` to disable future cells and `›` on current month

**Files:**
- Modify: `yt-history-cleaner.user.js:423-476` (`renderCalendar` body)

- [ ] **Step 1: Add `today` constant before the day-cell loop**

Find these lines (423–428):
```js
    const firstDay      = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth   = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMon = new Date(calendarYear, calendarMonth, 0).getDate();
    const isDisabled    = currentState === STATE.SCANNING || currentState === STATE.DELETING;
    const startMs       = selectedStart ? selectedStart.getTime() : null;
    const endMs         = selectedEnd   ? selectedEnd.getTime()   : null;
```

Replace with:
```js
    const firstDay      = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth   = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMon = new Date(calendarYear, calendarMonth, 0).getDate();
    const isDisabled    = currentState === STATE.SCANNING || currentState === STATE.DELETING;
    const startMs       = selectedStart ? selectedStart.getTime() : null;
    const endMs         = selectedEnd   ? selectedEnd.getTime()   : null;
    const _now          = new Date();
    const today         = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
```

- [ ] **Step 2: Replace the `if (isDisabled)` block with a three-way check**

Find this block (lines 452–456):
```js
      if (isDisabled) {
        cell.classList.add('cell-disabled');
      } else {
        cell.onclick = () => handleDateClick(cellDate);
      }
```

Replace with:
```js
      if (cellDate > today) {
        cell.classList.add('future');
      } else if (isDisabled) {
        cell.classList.add('cell-disabled');
      } else {
        cell.onclick = () => handleDateClick(cellDate);
      }
```

- [ ] **Step 3: Disable `›` when on the current month**

Find this line (476):
```js
    updateCalendarSummary();
```

Insert immediately before it:
```js
    const nextNavBtn = document.getElementById('ytc-cal-next');
    if (nextNavBtn) {
      nextNavBtn.disabled = (calendarYear === today.getFullYear() && calendarMonth === today.getMonth());
    }
```

- [ ] **Step 4: Browser verification**

Load `https://www.youtube.com/feed/history`. Open the calendar (click 📅). Verify:

1. Today's date (May 11) is a normal white interactive cell — clicking it selects it
2. All dates after May 11 in the current month are grey (`color: #ccc`) and unclickable
3. The `›` button is disabled (greyed out) when viewing May 2026
4. Click `‹` to go to April 2026 — all April cells are interactive, `›` re-enables
5. Click `›` from April — returns to May 2026, `›` disables again
6. Click `‹` twice to reach March 2026 — `›` is enabled; clicking `›` goes to April (enabled), then `›` again to May (disabled)
7. Preset dropdown mode (calendar closed) is completely unaffected

- [ ] **Step 5: Commit**

```bash
git add yt-history-cleaner.user.js
git commit -m "feat: grey out and disable future dates in calendar picker"
```
