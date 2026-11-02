/* =====================================================================
   Event state: decides whether an event is upcoming, live, tentative or
   completed, and what the buttons and badges should say.

   This one file is used in three places, so they can never disagree:
     - the build script (decides how each page is generated),
     - the browser (flips an event to "completed" the moment it ends,
       without a redeploy),
     - the registration API (refuses registrations for closed events).

   All dates are India Standard Time (UTC+05:30).
   Accepted date formats:  2026-11-16   2026-11-16T10:00   2027-01 (month only)
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.EventState = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IST = '+05:30';
  var HOUR = 3600000;

  function two(n) { return n < 10 ? '0' + n : String(n); }
  function daysIn(y, mo) { return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }

  /* "2026-11-16T10:00" -> { y, mo, d, h, mi }; d and h are null when absent */
  function parse(s) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2}))?$/.exec(String(s == null ? '' : s).trim());
    if (!m) { return null; }
    var p = { y: +m[1], mo: +m[2], d: m[3] ? +m[3] : null, h: m[4] != null ? +m[4] : null, mi: m[5] != null ? +m[5] : 0 };
    if (p.mo < 1 || p.mo > 12) { return null; }
    if (p.d != null && (p.d < 1 || p.d > daysIn(p.y, p.mo))) { return null; }
    return p;
  }
  function stamp(y, mo, d, h, mi) {
    return Date.parse(y + '-' + two(mo) + '-' + two(d) + 'T' + two(h) + ':' + two(mi) + ':00' + IST);
  }
  /* the last instant a parsed date covers */
  function atEnd(p) {
    var d = p.d || daysIn(p.y, p.mo);
    if (p.h != null) { return stamp(p.y, p.mo, d, p.h, p.mi); }
    return stamp(p.y, p.mo, d, 23, 59) + 59999;
  }

  function startMs(ev) {
    var p = parse(ev && ev.start);
    if (!p) { return NaN; }
    return stamp(p.y, p.mo, p.d || 1, p.h == null ? 0 : p.h, p.mi);
  }
  function endMs(ev) {
    var s = parse(ev && ev.start), e = parse(ev && ev.end);
    if (!s) { return NaN; }
    if (!e) { return s.h != null ? startMs(ev) + 6 * HOUR : atEnd(s); }
    return atEnd(e);
  }
  function deadlineMs(str) {
    var p = parse(str);
    return p ? atEnd(p) : NaN;
  }

  /* a date that is not fixed yet: flagged by hand, or only a month was given */
  function isTentative(ev) {
    if (!ev) { return true; }
    var s = parse(ev.start);
    return !!(ev.dateTentative || !s || s.d == null);
  }

  /* 'completed' | 'live' | 'upcoming' | 'tentative' */
  function stateOf(ev, now) {
    now = now == null ? Date.now() : now;
    if (ev.status === 'completed') { return 'completed'; }
    if (isTentative(ev)) { return 'tentative'; }
    if (ev.status === 'upcoming') { return now >= startMs(ev) && now <= endMs(ev) ? 'live' : 'upcoming'; }
    if (now > endMs(ev)) { return 'completed'; }
    if (now >= startMs(ev)) { return 'live'; }
    return 'upcoming';
  }

  /* 'open' | 'closed' | 'none' */
  function regState(ev, now) {
    now = now == null ? Date.now() : now;
    var r = (ev && ev.registration) || {};
    if (r.mode === 'none') { return 'none'; }
    if (r.open === false) { return 'closed'; }
    if (r.deadline) {
      var d = deadlineMs(r.deadline);
      if (d === d && now > d) { return 'closed'; }
    }
    return 'open';
  }

  /* everything the UI needs in one call */
  function describe(ev, now) {
    now = now == null ? Date.now() : now;
    var state = stateOf(ev, now);
    var reg = state === 'completed' ? 'closed' : regState(ev, now);
    var badge, cta, tone;
    if (state === 'completed') { badge = 'Completed'; cta = 'View recap'; tone = 'done'; }
    else if (state === 'live') { badge = 'Happening now'; cta = reg === 'open' ? 'Register' : 'View details'; tone = 'live'; }
    else if (state === 'tentative') {
      badge = 'Dates to be confirmed';
      cta = reg === 'open' ? 'Register your interest' : 'View details';
      tone = 'tentative';
    } else if (reg === 'open') { badge = 'Registration open'; cta = 'Register now'; tone = 'open'; }
    else if (reg === 'closed') { badge = 'Registration closed'; cta = 'View details'; tone = 'closed'; }
    else { badge = 'Upcoming'; cta = 'View details'; tone = 'open'; }
    return { state: state, reg: reg, badge: badge, cta: cta, tone: tone };
  }

  /* upcoming first (soonest first, undated last), then completed (latest first) */
  function sortEvents(list, now) {
    now = now == null ? Date.now() : now;
    var open = [], done = [];
    list.forEach(function (ev) { (stateOf(ev, now) === 'completed' ? done : open).push(ev); });
    function key(ev) { var t = startMs(ev); return t === t ? t : Infinity; }
    open.sort(function (a, b) {
      var ta = isTentative(a) ? Infinity : key(a), tb = isTentative(b) ? Infinity : key(b);
      if (ta === tb) { return key(a) - key(b) || 0; }
      return ta < tb ? -1 : 1;
    });
    done.sort(function (a, b) { return key(b) - key(a); });
    return { open: open, done: done };
  }

  /* the event the countdown should point at: the soonest dated one that has
     not finished, otherwise the first undated one, otherwise nothing */
  function nextEvent(list, now) {
    var g = sortEvents(list, now).open;
    for (var i = 0; i < g.length; i++) { if (!isTentative(g[i])) { return g[i]; } }
    return g.length ? g[0] : null;
  }

  return {
    IST: IST, parse: parse, startMs: startMs, endMs: endMs, deadlineMs: deadlineMs,
    isTentative: isTentative, stateOf: stateOf, regState: regState, describe: describe,
    sortEvents: sortEvents, nextEvent: nextEvent
  };
});
