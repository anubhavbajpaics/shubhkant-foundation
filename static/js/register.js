/* Registration form on an event page. Validates, posts to /api/register and shows a confirmation. */
(function () {
  'use strict';
  var doc = document;
  var form = doc.querySelector('form[data-register]');
  if (!form) { return; }

  var PREVIEW = !!doc.querySelector('meta[name="sf-preview"]');
  var slug = form.getAttribute('data-slug');
  var endpoint = form.getAttribute('data-endpoint') || '/api/register';
  var card = form.closest('.reg-card');
  var success = card.querySelector('[data-success]');
  var status = form.querySelector('[data-status]');
  var btn = form.querySelector('button[type="submit"]');
  var label = btn.querySelector('[data-label]');
  var idleLabel = label.textContent;
  var loadedAt = Date.now();

  function controls() {
    return Array.prototype.filter.call(form.elements, function (el) {
      return el.name && el.name !== 'fax_number' && el.type !== 'submit' && el.type !== 'button';
    });
  }
  function errorEl(el) { return doc.getElementById(el.id + '-err'); }

  function problem(el) {
    var isBox = el.type === 'checkbox';
    var v = isBox ? el.checked : String(el.value || '').trim();
    if (el.required && !v) { return isBox ? 'Please tick this box to continue.' : 'Please fill in this field.'; }
    if (el.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { return 'Enter a valid email address, like name@example.com.'; }
    if (el.type === 'tel' && v) {
      var digits = v.replace(/\D/g, '');
      if (!/^[+\d\s().-]+$/.test(v) || digits.length < 7 || digits.length > 15) { return 'Enter a valid phone number.'; }
    }
    return '';
  }
  function setError(el, msg) {
    var box = errorEl(el);
    if (!box) { return; }
    box.textContent = msg; box.hidden = !msg;
    if (msg) { el.setAttribute('aria-invalid', 'true'); } else { el.removeAttribute('aria-invalid'); }
  }
  function validate() {
    var first = null;
    controls().forEach(function (el) {
      var msg = problem(el);
      setError(el, msg);
      if (msg && !first) { first = el; }
    });
    if (first) { first.focus(); }
    return !first;
  }

  controls().forEach(function (el) {
    el.addEventListener('blur', function () { if (el.value || el.type === 'checkbox') { setError(el, problem(el)); } });
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) { setError(el, problem(el)); } });
    el.addEventListener('change', function () { if (el.getAttribute('aria-invalid')) { setError(el, problem(el)); } });
  });

  function say(msg, tone) {
    status.textContent = msg || '';
    if (tone) { status.setAttribute('data-tone', tone); } else { status.removeAttribute('data-tone'); }
  }
  function busy(on) {
    btn.disabled = on;
    label.textContent = on ? 'Submitting...' : idleLabel;
    form.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  var MESSAGES = {
    closed: 'Registration for this event is closed.',
    ended: 'This event has already taken place.',
    unknown_event: 'This event could not be found. Please reload the page.',
    not_configured: 'Registration is not switched on yet. Please try again later or contact us.',
    too_fast: 'That was very quick. Please check your details and press the button again.',
    upstream: 'We could not save your registration just now. Please try again in a minute.',
    too_large: 'That message is too long. Please shorten it and try again.',
    forbidden: 'This request was blocked. Please reload the page and try again.'
  };

  function fail(res) {
    busy(false);
    var b = (res && res.body) || {};
    if (b.error === 'invalid' && b.fields) {
      controls().forEach(function (el) { if (b.fields[el.name]) { setError(el, b.fields[el.name]); } });
      say('Please check the highlighted fields.', 'error');
      var bad = controls().filter(function (el) { return el.getAttribute('aria-invalid'); })[0];
      if (bad) { bad.focus(); }
      return;
    }
    say(MESSAGES[b.error] || (res && res.status ? 'Something went wrong. Please try again.' : 'We could not reach the server. Check your connection and try again.'), 'error');
  }
  function done(body) {
    busy(false);
    card.classList.add('is-done');
    form.hidden = true;
    success.hidden = false;
    var ref = success.querySelector('[data-ref]');
    if (ref) { ref.textContent = body.ref || ''; }
    success.focus();
    if (card.scrollIntoView) { card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  function payload() {
    var fields = {};
    controls().forEach(function (el) {
      fields[el.name] = el.type === 'checkbox' ? el.checked : String(el.value || '').trim();
    });
    return { event: slug, fields: fields, hp: form.elements.fax_number ? form.elements.fax_number.value : '', t: Date.now() - loadedAt };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    say('');
    if (!validate()) { say('Please check the highlighted fields.', 'error'); return; }
    busy(true);
    if (PREVIEW) {
      window.setTimeout(function () { done({ ok: true, ref: 'SF-PREVIEW' }); }, 700);
      return;
    }
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
      })
      .then(function (res) { if (res.body && res.body.ok) { done(res.body); } else { fail(res); } })
      .catch(function () { fail(null); });
  });

  var again = card.querySelector('[data-again]');
  if (again) {
    again.addEventListener('click', function () {
      form.reset();
      controls().forEach(function (el) { setError(el, ''); });
      say('');
      loadedAt = Date.now();
      card.classList.remove('is-done');
      success.hidden = true;
      form.hidden = false;
      var first = controls()[0]; if (first) { first.focus(); }
    });
  }
})();
