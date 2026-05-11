# Future Date Restriction — Design Spec

**Date:** 2026-05-11
**Feature:** Grey out and disable future dates in the custom date picker calendar
**Scope:** Additive change to `yt-history-cleaner.user.js` only

---

## Overview

Today and all past dates remain selectable. Any date strictly after today is visually greyed out and non-interactive. The `›` month navigation button is disabled when the calendar is already showing the current month, preventing navigation into wholly-future months.

---

## CSS

One new rule appended inside the `STYLES` constant, after the `.cell-disabled` rule:

```css
#ytc-panel .ytc-cal-cell.future {
  color: #ccc;
  cursor: default;
  pointer-events: none;
}
```

Same visual treatment as prior-month spillover cells so future dates read consistently as unavailable.

---

## `buildCalendar` change

The `›` nav button needs an `id` so `renderCalendar` can target it by ID:

```js
nextBtn.id = 'ytc-cal-next';
```

---

## `renderCalendar` changes

**1. Compute today's midnight once, before the day-cell loop:**

```js
const now   = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
```

**2. Replace the existing `if (isDisabled) … else { onclick }` block** inside the day-cell loop with a three-way check:

```js
if (cellDate > today) {
  cell.classList.add('future');
} else if (isDisabled) {
  cell.classList.add('cell-disabled');
} else {
  cell.onclick = () => handleDateClick(cellDate);
}
```

Future dates get `future` (grey, non-interactive). The existing SCANNING/DELETING disabled state is unchanged for selectable dates.

**3. Disable `›` when on the current month**, after the grid is populated:

```js
const nextBtn = document.getElementById('ytc-cal-next');
if (nextBtn) {
  nextBtn.disabled = (calendarYear === today.getFullYear() && calendarMonth === today.getMonth());
}
```

---

## Boundary conditions

| Date | Behaviour |
|---|---|
| Today | Selectable (normal interactive cell) |
| Any past date | Selectable (unchanged) |
| Tomorrow or later | Grey, `pointer-events: none`, no `onclick` |
| Current month displayed | `›` button disabled |
| Past month displayed | `›` button enabled (navigating forward is fine until current month) |

---

## Out of scope

- Blocking keyboard navigation (none exists)
- Any change to filter logic (`isSectionInCustomRange`, `isSectionOlderThanCutoff`)
- Persisting or resetting an existing selection if it somehow pointed to a future date
