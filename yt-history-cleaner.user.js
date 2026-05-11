// ==UserScript==
// @name         YT History Cleaner
// @namespace    https://github.com/jmontez
// @version      1.1
// @description  Bulk-delete YouTube watch history by time range
// @match        *://www.youtube.com/feed/history*
// @match        *://youtube.com/feed/history*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // YouTube is a SPA — wait for an element before injecting
  function waitForElement(selector, callback, interval = 300, maxWait = 15000) {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        callback(el);
      } else if (Date.now() - start > maxWait) {
        clearInterval(timer);
      }
    }, interval);
  }

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
`;

  const STATE = {
    IDLE:     'idle',
    SCANNING: 'scanning',
    READY:    'ready',
    DELETING: 'deleting',
    DONE:     'done',
  };

  let currentState = STATE.IDLE;
  let foundItems   = [];
  let deletedCount = 0;

  let calendarMode  = false;
  let calendarYear  = 0;
  let calendarMonth = 0;
  let selectedStart = null; // Date | null — always the earlier of the two picked dates
  let selectedEnd   = null; // Date | null — always the later of the two picked dates

  const TIME_RANGES = [
    { label: '1 day',    days: 1   },
    { label: '1 week',   days: 7   },
    { label: '2 weeks',  days: 14  },
    { label: '1 month',  days: 30  },
    { label: '3 months', days: 90  },
    { label: '6 months', days: 180 },
    { label: 'All time', days: null },
  ];

  function injectStyles() {
    if (document.getElementById('ytc-styles')) return;
    const style = document.createElement('style');
    style.id = 'ytc-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

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

  function handleMonthNav(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0)  { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0;  calendarYear++; }
    renderCalendar();
  }

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

  function setState(newState, data = {}) {
    currentState = newState;
    renderState(newState, data);
  }

  function renderState(state, data = {}) {
    const panel = document.getElementById('ytc-panel');
    if (!panel) return;
    const rangeEl   = document.getElementById('ytc-range');
    const actionBtn = document.getElementById('ytc-action');
    const calBtn    = document.getElementById('ytc-cal-btn');

    panel.querySelectorAll('.ytc-info:not(#ytc-cal-summary), .ytc-hint').forEach(el => el.remove());

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
  }

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

  function initStateIdle() {
    foundItems   = [];
    deletedCount = 0;
    setState(STATE.IDLE);
  }

  const SCROLL_PAUSE_MS = 1200;
  const SCROLL_MAX_SAME = 3;
  const DELETE_STEP_MS  = 500;
  const DIALOG_WAIT_MS  = 800;
  const DIALOG_TIMEOUT  = 3000;

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

  function parseSectionDate(headerText) {
    const text  = headerText.trim();
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (/^today$/i.test(text)) return today;

    if (/^yesterday$/i.test(text)) {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return d;
    }

    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayIdx = days.indexOf(text.toLowerCase());
    if (dayIdx !== -1) {
      const d = new Date(today);
      const diff = (today.getDay() - dayIdx + 7) % 7 || 7;
      d.setDate(d.getDate() - diff);
      return d;
    }

    const monthDay = text.match(/^([A-Za-z]+)\s+(\d+)$/);
    if (monthDay) {
      const months = ['january','february','march','april','may','june',
                      'july','august','september','october','november','december'];
      const mIdx = months.indexOf(monthDay[1].toLowerCase());
      if (mIdx !== -1) {
        const d = new Date(today.getFullYear(), mIdx, parseInt(monthDay[2], 10));
        if (d > today) d.setFullYear(d.getFullYear() - 1);
        return d;
      }
    }

    return null;
  }

  function isSectionOlderThanCutoff(headerText, cutoff) {
    if (cutoff === null) return true;
    const date = parseSectionDate(headerText);
    if (!date) return false;
    return date <= cutoff;
  }

  function getCustomRange() {
    return { start: selectedStart, end: selectedEnd };
  }

  function isSectionInCustomRange(headerText, range) {
    const date = parseSectionDate(headerText);
    if (!date) return false;
    if (range.end === null) return date <= range.start;
    return date >= range.start && date <= range.end;
  }

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

  function scrollAndCollect(filterFn, sameSizeCount, lastHeight) {
    const sections = [];
    document.querySelectorAll('ytd-item-section-renderer').forEach(sec => {
      const h = sec.querySelector('ytd-item-section-header-renderer');
      if (h) sections.push({ el: sec, text: h.textContent.trim() });
    });

    for (const sd of sections) {
      if (!filterFn(sd.text)) continue;
      const contents = sd.el.querySelector('#contents') ||
                       (sd.el.shadowRoot && sd.el.shadowRoot.querySelector('#contents'));
      if (!contents) continue;
      for (const child of contents.children) {
        if (child.tagName === 'YTD-REEL-SHELF-RENDERER') {
          // Shorts shelf — collect individual reel items inside it
          const reelItems = [...child.querySelectorAll('ytd-reel-item-renderer')];
          if (reelItems.length > 0) {
            for (const ri of reelItems) {
              if (!foundItems.includes(ri)) foundItems.push(ri);
            }
          } else {
            const shelfItems = child.querySelector('#items');
            if (shelfItems) {
              for (const ri of shelfItems.children) {
                if (!foundItems.includes(ri)) foundItems.push(ri);
              }
            } else {
              if (!foundItems.includes(child)) foundItems.push(child);
            }
          }
        } else {
          if (!foundItems.includes(child)) foundItems.push(child);
        }
      }
    }

    setState(STATE.SCANNING, { count: foundItems.length });

    const currentHeight = document.documentElement.scrollHeight;
    const newSameCount  = currentHeight === lastHeight ? sameSizeCount + 1 : 0;

    if (newSameCount >= SCROLL_MAX_SAME) {
      onScanComplete();
      return;
    }

    window.scrollTo(0, currentHeight);
    setTimeout(() => scrollAndCollect(filterFn, newSameCount, currentHeight), SCROLL_PAUSE_MS);
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

  function handleDelete() {
    if (currentState !== STATE.READY) return;
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
      // Hover to reveal per-item controls
      item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      setTimeout(() => {
        // Polymer's querySelector returns the section's button, not the item's.
        // Use spatial matching: find a "More actions" button whose center falls
        // within this item's bounding rect.
        const itemRect = item.getBoundingClientRect();
        const allButtons = document.querySelectorAll('button[aria-label]');
        let menuBtn = null;
        for (const btn of allButtons) {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (!label.includes('action') && !label.includes('more')) continue;
          const r = btn.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx >= itemRect.left && cx <= itemRect.right &&
              cy >= itemRect.top  && cy <= itemRect.bottom) {
            menuBtn = btn;
            break;
          }
        }

        if (!menuBtn) {
          deleteNext(index + 1);
          return;
        }

        menuBtn.click();

        const menuItemSel = 'ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model';
        waitForElement(
          menuItemSel,
          () => {
            const removeBtn = [...document.querySelectorAll(menuItemSel)]
              .find(mi => mi.textContent.trim().toLowerCase().includes('remove from watch history')) ?? null;

            if (!removeBtn) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              setTimeout(() => deleteNext(index + 1), DELETE_STEP_MS);
              return;
            }

            // yt-list-item-view-model doesn't handle click directly —
            // find the actual clickable child element inside it
            const clickTarget = removeBtn.querySelector('button, a, [role="option"], [role="menuitem"]') || removeBtn;
            clickTarget.click();

            setTimeout(() => {
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
      }, 300); // wait for hover to reveal per-item controls
    }, DELETE_STEP_MS);
  }

  function handleReset() { initStateIdle(); }

  function injectPanel() {
    const isMobile = window.innerWidth < 1014;

    if (isMobile) {
      waitForElement('ytd-browse-filter-chip-bar-renderer, #secondary', (el) => {
        appendPanel(el.parentElement || el, el.nextSibling);
      });
    } else {
      waitForElement('#secondary', (sidebar) => {
        appendPanel(sidebar, null);
      });
    }
  }

  function appendPanel(parent, beforeNode) {
    if (document.getElementById('ytc-panel')) return;
    injectStyles();
    const panel = buildPanel();
    if (beforeNode) {
      parent.insertBefore(panel, beforeNode);
    } else {
      parent.appendChild(panel);
    }
    initStateIdle();
  }

  init();
})();
