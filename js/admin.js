/* Organiser tool: turns a form into the JSON for data/events.json. Nothing is stored or sent. */
(function () {
  'use strict';
  var doc = document;
  function $(s) { return doc.querySelector(s); }
  var existing = [];
  try { existing = JSON.parse($('#events-source').textContent || '[]'); } catch (e) { existing = []; }

  var F = {};
  ['load', 'title', 'slug', 'start', 'end', 'time', 'endtime', 'tentative', 'datetext', 'venue', 'summary', 'desc', 'regmode', 'regurl', 'regopen', 'deadline', 'regnote', 'status', 'recap', 'stats']
    .forEach(function (k) { F[k] = $('#a-' + k); });
  var out = $('#out'), problems = $('#problems'), copyBtn = $('#copy-out'), outStatus = $('#out-status');
  var tab = 'all', base = null, slugTouched = false;

  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  function paras(s) { return String(s || '').split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean); }

  existing.forEach(function (ev) {
    var o = doc.createElement('option'); o.value = ev.slug; o.textContent = ev.title; F.load.appendChild(o);
  });

  function build() {
    var ev = JSON.parse(JSON.stringify(base || {}));
    var title = F.title.value.trim();
    ev.slug = F.slug.value.trim() || slugify(title);
    ev.title = title;
    var start = F.start.value;
    if (start) {
      ev.start = F.tentative.checked && !F.time.value ? start.slice(0, 7) : start + (F.time.value ? 'T' + F.time.value : '');
    } else { delete ev.start; }
    if (F.end.value) { ev.end = F.end.value + (F.endtime.value ? 'T' + F.endtime.value : ''); }
    else if (F.endtime.value && start) { ev.end = start + 'T' + F.endtime.value; }
    else { delete ev.end; }
    if (F.tentative.checked) { ev.dateTentative = true; } else { delete ev.dateTentative; }
    if (F.datetext.value.trim()) { ev.dateText = F.datetext.value.trim(); } else { delete ev.dateText; }
    ev.venue = F.venue.value.trim();
    ev.summary = F.summary.value.trim();
    ev.description = paras(F.desc.value);
    var reg = Object.assign({}, ev.registration || {});
    reg.mode = F.regmode.value; reg.open = F.regopen.checked;
    if (reg.mode === 'external') { reg.url = F.regurl.value.trim(); } else { delete reg.url; }
    if (F.deadline.value) { reg.deadline = F.deadline.value; } else { delete reg.deadline; }
    if (F.regnote.value.trim()) { reg.note = F.regnote.value.trim(); } else { delete reg.note; }
    ev.registration = reg;
    if (F.status.value !== 'auto') { ev.status = F.status.value; } else { delete ev.status; }
    var recap = Object.assign({ captions: {} }, ev.recap || {});
    recap.summary = paras(F.recap.value);
    recap.highlights = F.stats.value.split('\n').map(function (l) {
      var i = l.indexOf(':'); if (i < 1) { return null; }
      var label = l.slice(0, i).trim(), value = l.slice(i + 1).trim();
      return label && value ? { label: label, value: value } : null;
    }).filter(Boolean);
    ev.recap = recap;
    var order = ['slug', 'title', 'subtitle', 'tagline', 'start', 'end', 'dateTentative', 'dateText', 'venue', 'logo', 'page', 'summary', 'description', 'highlights', 'registration', 'status', 'recap'];
    var sorted = {};
    order.forEach(function (k) { if (ev[k] !== undefined && !(k === 'venue' && !ev[k])) { sorted[k] = ev[k]; } });
    Object.keys(ev).forEach(function (k) { if (!(k in sorted) && k !== 'venue') { sorted[k] = ev[k]; } });
    return sorted;
  }

  function check(ev) {
    var list = [];
    if (!ev.title) { list.push('Enter the event name.'); }
    if (!ev.start) { list.push('Choose the start date.'); }
    if (ev.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ev.slug)) { list.push('The web address may only use lowercase letters, numbers and hyphens.'); }
    var clash = existing.some(function (e) { return e.slug === ev.slug && (!base || base.slug !== ev.slug); });
    if (clash) { list.push('Another event already uses this web address. Change it.'); }
    if (ev.end && ev.start && ev.end < ev.start) { list.push('The end date is before the start date.'); }
    if (ev.registration && ev.registration.mode === 'external' && !ev.registration.url) { list.push('Paste the registration form link.'); }
    return list;
  }

  function render() {
    var ev = build();
    var list = check(ev);
    $('[data-slug-preview]').textContent = ev.slug || 'your-event';
    $('#folder').textContent = 'static/photos/events/' + (ev.slug || 'your-event') + '/';
    problems.hidden = !list.length;
    problems.innerHTML = '';
    if (list.length) {
      var ul = doc.createElement('ul');
      list.forEach(function (t) { var li = doc.createElement('li'); li.textContent = t; ul.appendChild(li); });
      problems.appendChild(ul);
    }
    var ready = !list.length;
    copyBtn.disabled = !ready;
    if (!ready) { out.value = ''; return; }
    if (tab === 'one') { out.value = JSON.stringify(ev, null, 2); return; }
    var all = existing.map(function (e) { return base && e.slug === base.slug ? ev : e; });
    if (!base || !existing.some(function (e) { return e.slug === base.slug; })) { all.push(ev); }
    out.value = JSON.stringify(all, null, 2) + '\n';
  }

  function fill(ev) {
    base = ev ? JSON.parse(JSON.stringify(ev)) : null;
    ev = ev || {};
    var s = ev.start || '';
    F.title.value = ev.title || '';
    F.slug.value = ev.slug || ''; slugTouched = !!ev.slug;
    F.start.value = s.length === 7 ? s + '-01' : s.slice(0, 10);
    F.time.value = s.length > 10 ? s.slice(11, 16) : '';
    var e = ev.end || '';
    F.end.value = e.slice(0, 10); F.endtime.value = e.length > 10 ? e.slice(11, 16) : '';
    F.tentative.checked = !!ev.dateTentative;
    F.datetext.value = ev.dateText || '';
    F.venue.value = ev.venue || '';
    F.summary.value = ev.summary || '';
    F.desc.value = (ev.description || []).join('\n\n');
    var r = ev.registration || {};
    F.regmode.value = r.mode || 'form'; F.regurl.value = r.url || ''; F.regopen.checked = r.open !== false;
    F.deadline.value = r.deadline || ''; F.regnote.value = r.note || '';
    F.status.value = ev.status || 'auto';
    var rc = ev.recap || {};
    F.recap.value = (rc.summary || []).join('\n\n');
    F.stats.value = (rc.highlights || []).map(function (h) { return h.label + ': ' + h.value; }).join('\n');
    toggleExternal();
  }
  function toggleExternal() {
    var box = doc.querySelector('[data-for="external"]'); if (box) { box.hidden = F.regmode.value !== 'external'; }
  }

  F.load.addEventListener('change', function () {
    var ev = existing.filter(function (x) { return x.slug === F.load.value; })[0];
    fill(ev || null); render();
  });
  F.title.addEventListener('input', function () { if (!slugTouched) { F.slug.value = slugify(F.title.value); } });
  F.slug.addEventListener('input', function () { slugTouched = true; });
  F.regmode.addEventListener('change', toggleExternal);
  $('#event-form').addEventListener('input', render);
  $('#event-form').addEventListener('change', render);
  $('#event-form').addEventListener('submit', function (e) { e.preventDefault(); });

  var tabs = Array.prototype.slice.call(doc.querySelectorAll('[data-tab]'));
  function selectTab(btn) {
    tab = btn.getAttribute('data-tab');
    tabs.forEach(function (b) { var on = b === btn; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    $('#out-panel').setAttribute('aria-labelledby', btn.id);
    $('#out-help').innerHTML = tab === 'all' ? 'Replace everything in <code>data/events.json</code> with this.' : 'Just this event. Add it to the list in <code>data/events.json</code> yourself.';
    render();
  }
  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () { selectTab(b); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); selectTab(n); }
    });
  });

  copyBtn.addEventListener('click', function () {
    out.select();
    (window.SFCopy || function (t, cb) { try { if (doc.execCommand('copy')) { cb(); } } catch (e) { /* manual copy */ } })(out.value, function () {
      outStatus.textContent = 'Copied. Paste it into data/events.json.';
      window.setTimeout(function () { outStatus.textContent = ''; }, 3000);
    });
  });

  fill(null); render();
})();
