/* Keeps events honest without a redeploy: countdowns, "Registration open" ->
   "Completed" on the day an event ends, the next-event card, and the
   upcoming / completed lists on the events page. Needs event-state.js. */
(function () {
  'use strict';
  var ES = window.EventState;
  if (!ES) { return; }
  var doc = document;
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  var data = [];
  try { data = JSON.parse(($('#events-data') || {}).textContent || '[]'); } catch (err) { data = []; }
  var bySlug = {};
  data.forEach(function (e) { bySlug[e.slug] = e; });

  /* ---------- cards ---------- */
  function refreshCards() {
    var now = Date.now();
    $$('[data-event]').forEach(function (card) {
      var ev = bySlug[card.getAttribute('data-event')];
      if (!ev) { return; }
      var d = ES.describe(ev, now);
      card.setAttribute('data-state', d.state);
      card.setAttribute('data-reg', d.reg);
      var badge = $('[data-badge]', card);
      if (badge) { badge.textContent = d.badge; badge.setAttribute('data-tone', d.tone); }
      var cta = $('[data-cta]', card); if (cta) { cta.textContent = d.cta; }
      var sr = $('[data-cta-sr]', card); if (sr) { sr.textContent = d.cta.toLowerCase(); }
    });

    var open = $('#grid-open'), done = $('#grid-done');
    if (open && done) {
      $$('[data-event]', open).forEach(function (c) {
        if (c.getAttribute('data-state') === 'completed') { done.insertBefore(c, done.firstChild); }
      });
      $$('[data-event]', done).forEach(function (c) {
        if (c.getAttribute('data-state') !== 'completed') { open.appendChild(c); }
      });
      var nOpen = $$('[data-event]', open).length, nDone = $$('[data-event]', done).length;
      $('#empty-open').hidden = nOpen > 0;
      $('#empty-done').hidden = nDone > 0;
      var co = $('[data-count="open"]'), cd = $('[data-count="done"]');
      if (co) { co.textContent = String(nOpen); }
      if (cd) { cd.textContent = String(nDone); }
    }
  }

  /* ---------- an event's own page ---------- */
  var page = $('[data-event-page]');
  function refreshPage() {
    if (!page) { return; }
    var ev = bySlug[page.getAttribute('data-slug')];
    if (!ev) { return; }
    var d = ES.describe(ev, Date.now());
    /* A page built as "completed" has no registration section, so it never flips back. */
    if (page.getAttribute('data-state') === 'completed') { return; }
    page.setAttribute('data-state', d.state);
    page.setAttribute('data-reg', d.reg);
    var badge = $('[data-badge]', page); if (badge) { badge.textContent = d.badge; badge.setAttribute('data-tone', d.tone); }
    var cta = $('[data-cta-link] [data-cta]', page); if (cta) { cta.textContent = d.cta; }
  }

  /* ---------- the next-event card on the home page ---------- */
  var nextEl = $('#next-event');
  function refreshNext() {
    if (!nextEl) { return; }
    var wrap = nextEl.parentNode;
    var ev = ES.nextEvent(data, Date.now());
    if (!ev) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var d = ES.describe(ev, Date.now());
    if (nextEl.getAttribute('data-slug') !== ev.slug) {
      nextEl.setAttribute('data-slug', ev.slug);
      $('#next-title').textContent = ev.title;
      $('#next-date').textContent = ev.when;
      $('#next-details').setAttribute('href', ev.url);
      var cal = $('#next-cal');
      if (ev.cal) { cal.setAttribute('href', ev.cal); cal.hidden = false; } else { cal.hidden = true; }
      var clock = $('#clock');
      clock.setAttribute('data-start', ES.isTentative(ev) ? '' : String(ES.startMs(ev)));
    }
    $('#next-cta').textContent = d.cta;
    $('#next-label').textContent = d.state === 'live' ? 'Happening now' : d.state === 'tentative' ? 'Coming up' : 'Next event';
    $('#next-live').hidden = d.state !== 'live';
  }

  /* ---------- countdowns ---------- */
  var lastMinute = {};
  function tick() {
    var now = Date.now();
    $$('[data-clock]').forEach(function (clock, i) {
      var start = Number(clock.getAttribute('data-start'));
      var diff = start - now;
      if (!start || diff <= 0) { clock.hidden = true; return; }
      clock.hidden = false;
      var days = Math.floor(diff / 86400000);
      var hrs = Math.floor(diff % 86400000 / 3600000);
      var mins = Math.floor(diff % 3600000 / 60000);
      var secs = Math.floor(diff % 60000 / 1000);
      $('[data-c="d"]', clock).textContent = pad(days);
      $('[data-c="h"]', clock).textContent = pad(hrs);
      $('[data-c="m"]', clock).textContent = pad(mins);
      $('[data-c="s"]', clock).textContent = pad(secs);
      if (lastMinute[i] !== mins) { /* keep the spoken label calm: update once a minute */
        lastMinute[i] = mins;
        clock.setAttribute('aria-label', days + ' days, ' + hrs + ' hours and ' + mins + ' minutes to go');
      }
    });
  }

  function refreshAll() { refreshCards(); refreshPage(); refreshNext(); tick(); }
  refreshAll();
  window.setInterval(tick, 1000);
  window.setInterval(function () { refreshCards(); refreshPage(); refreshNext(); }, 30000);
})();
