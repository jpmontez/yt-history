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

  const TIME_RANGES = [
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

  function setState(newState, data = {}) {
    currentState = newState;
    renderState(newState, data);
  }

  function renderState(state, data = {}) {
    const panel = document.getElementById('ytc-panel');
    if (!panel) { console.warn('[YT History Cleaner] renderState called before panel exists'); return; }
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

  function initStateIdle() {
    foundItems   = [];
    deletedCount = 0;
    setState(STATE.IDLE);
  }

  // ========== Scan Phase Constants ==========

  const SCROLL_PAUSE_MS = 1200;  // wait after each scroll for new items to render
  const SCROLL_MAX_SAME = 3;     // stop if scroll height hasn't changed this many times

  // ========== Delete Phase Constants ==========

  const DELETE_STEP_MS = 500;   // delay between item deletion attempts
  const DIALOG_WAIT_MS = 800;   // wait for confirmation dialog to appear
  const DIALOG_TIMEOUT = 3000;  // give up on dialog after this long

  // ========== Time Range Cutoff Logic ==========

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

  function handleScan() {
    if (currentState !== STATE.IDLE) return;
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

    window.scrollTo(0, currentHeight);
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
          const removeBtn = [...document.querySelectorAll('ytd-menu-service-item-renderer')]
            .find(mi => mi.textContent.trim().toLowerCase().includes('remove from watch history')) ?? null;

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

  function handleReset()  { initStateIdle(); }

  function injectPanel() {
    const isMobile = window.innerWidth < 1014;

    if (isMobile) {
      // Try the chip bar first (Comments/Posts/Live chat section), fall back to #secondary
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
    injectStyles();
    const panel = buildPanel();
    if (beforeNode) {
      parent.insertBefore(panel, beforeNode);
    } else {
      parent.appendChild(panel);
    }
    initStateIdle();
    console.log('[YT History Cleaner] Panel injected');
  }

  init();
})();
