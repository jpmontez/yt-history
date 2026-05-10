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
    if (!panel) return;
    const rangeEl   = document.getElementById('ytc-range');
    const actionBtn = document.getElementById('ytc-action');

    panel.querySelectorAll('.ytc-info, .ytc-hint').forEach(el => el.remove());

    switch (state) {

      case STATE.IDLE:
        rangeEl.disabled      = false;
        rangeEl.onchange      = null;
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
        rangeEl.disabled      = false;
        rangeEl.onchange      = () => setState(STATE.IDLE);
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

  function handleScan() {
    if (currentState !== STATE.IDLE) return;
    foundItems   = [];
    deletedCount = 0;
    const cutoff = getCutoffDate();
    setState(STATE.SCANNING, { count: 0 });
    scrollAndCollect(cutoff, 0, 0);
  }

  function scrollAndCollect(cutoff, sameSizeCount, lastHeight) {
    const sections = [];
    document.querySelectorAll('ytd-item-section-renderer').forEach(sec => {
      const h = sec.querySelector('ytd-item-section-header-renderer');
      if (h) sections.push({ el: sec, text: h.textContent.trim() });
    });

    for (const sd of sections) {
      if (!isSectionOlderThanCutoff(sd.text, cutoff)) continue;
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
