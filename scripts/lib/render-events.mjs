// One page per event: /events/<slug>
//   upcoming  -> details + the registration form
//   completed -> summary + photographs
// Both are in the HTML; data-state on <main> decides which one shows, and the
// browser re-checks the clock so an event flips to "completed" on its own.
import { esc, paragraphs, jsonForScript, ES } from './util.mjs';
import { icon, imgTag, eventCard, eventsDataScript } from './render.mjs';
import { isoStamp } from './format.mjs';

/* ---------- registration form ---------- */

function fieldHtml(f) {
  const id = `f-${f.id}`;
  const req = f.required ? ' required' : '';
  const label =
    `<label for="${id}">${esc(f.label)}` +
    (f.required ? '<span class="req" aria-hidden="true"> *</span>' : ' <span class="opt">(optional)</span>') +
    '</label>';
  const hint = f.hint ? `<p class="field__hint" id="${id}-hint">${esc(f.hint)}</p>` : '';
  const err = `<p class="field__err" id="${id}-err" hidden></p>`;
  const describedby = ` aria-describedby="${[f.hint ? `${id}-hint` : '', `${id}-err`].filter(Boolean).join(' ')}"`;
  const max = f.maxlength ? ` maxlength="${Number(f.maxlength)}"` : '';
  const auto = f.autocomplete ? ` autocomplete="${esc(f.autocomplete)}"` : '';
  let control;
  if (f.type === 'select') {
    const opts = (f.options || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    control = `<select id="${id}" name="${esc(f.id)}"${req}${describedby}><option value="">Select one</option>${opts}</select>`;
  } else if (f.type === 'textarea') {
    control = `<textarea id="${id}" name="${esc(f.id)}" rows="3"${max}${req}${describedby}></textarea>`;
  } else {
    const type = ['email', 'tel', 'number', 'text'].includes(f.type) ? f.type : 'text';
    const mode = type === 'tel' ? ' inputmode="tel"' : type === 'email' ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : '';
    control = `<input id="${id}" name="${esc(f.id)}" type="${type}"${mode}${max}${auto}${req}${describedby}>`;
  }
  return `<div class="field">${label}${control}${hint}${err}</div>`;
}

function registrationCard(ctx, ev) {
  const reg = ev.registration || {};
  const mode = reg.mode === 'external' && !reg.url ? 'form' : reg.mode || 'form';
  const tentative = ev.d.state === 'tentative';
  const title = tentative ? 'Register your interest' : 'Register for this event';
  const note = reg.note ? `<p class="reg-card__note">${esc(reg.note)}</p>` : '';
  const deadline = reg.deadline ? `<p class="reg-card__note">Registration closes on ${esc(ev.fmtDeadline)}.</p>` : '';

  let on = '';
  if (mode === 'external' && reg.url) {
    on = `<h2>${title}</h2>${note}${deadline}
      <p>Registration for this event happens on a separate form.</p>
      <div class="btn-row"><a class="btn" href="${esc(reg.url)}" target="_blank" rel="noopener noreferrer">Open the registration form${icon('external')}<span class="sr-only"> (opens in a new tab)</span></a></div>`;
  } else if (mode === 'form') {
    const fields = (ev.registration?.fields || ctx.site.registrationFields).map(fieldHtml).join('\n');
    const submit = tentative ? 'Register my interest' : 'Submit registration';
    on = `<h2>${title}</h2>${note}${deadline}
      <p class="reg-card__lead">It takes about a minute. Fields marked <span class="req" aria-hidden="true">*</span><span class="sr-only">with an asterisk</span> are required.</p>
      ${ctx.mode === 'preview' ? '<p class="notice" data-preview-note>Preview only: this form is not connected yet, so nothing is sent or saved.</p>' : ''}
      <form class="form" data-register data-slug="${esc(ev.slug)}" data-endpoint="/api/register" novalidate>
        ${fields}
        <div class="field">
          <label class="check" for="f-consent"><input type="checkbox" id="f-consent" name="consent" required aria-describedby="f-consent-err"><span>I agree to be contacted by Shubhkant Foundation about this event.<span class="req" aria-hidden="true"> *</span></span></label>
          <p class="field__err" id="f-consent-err" hidden></p>
        </div>
        <div class="hp" aria-hidden="true"><label>Leave this field empty<input type="text" name="fax_number" tabindex="-1" autocomplete="off"></label></div>
        <button class="btn" type="submit"><span data-label>${submit}</span></button>
        <p class="form__status" role="status" aria-live="polite" data-status></p>
      </form>
      <div class="success" data-success hidden tabindex="-1">
        <span class="success__icon" aria-hidden="true">${icon('check-circle')}</span>
        <h2>${tentative ? 'Thank you, we have your interest' : 'You are registered'}</h2>
        <p>We have received your ${tentative ? 'details' : 'registration'} for <strong>${esc(ev.title)}</strong>.</p>
        <p>Your reference: <span class="ref" data-ref></span></p>
        <div class="btn-row">
          ${ev.cal ? `<a class="btn btn--small" href="${esc(ev.cal)}" target="_blank" rel="noopener noreferrer">${icon('calendar-plus')}Add to calendar<span class="sr-only"> (opens in a new tab)</span></a>` : ''}
          <button class="btn btn--small btn--ghost" type="button" data-again>Register another person</button>
        </div>
      </div>`;
  }

  const offText =
    mode === 'none'
      ? esc(reg.note || 'Registration is not available for this event.')
      : 'Registration for this event is closed. Please check the other events, or get in touch with us.';
  const off = `<h2>${mode === 'none' ? 'Attending this event' : 'Registration is closed'}</h2><p>${offText}</p>
      <div class="btn-row"><a class="btn btn--small btn--ghost" href="/events">See all events</a></div>`;

  return `<div class="reg-card" id="register">
    ${on ? `<div class="reg-on">${on}</div>` : ''}
    <div class="reg-off">${off}</div>
  </div>`;
}

/* ---------- pieces ---------- */

function factsList(ev) {
  const rows = [['Date', ev.when]];
  if (ev.venue) rows.push(['Venue', ev.venue]);
  else rows.push(['Venue', 'To be announced']);
  if (ev.entry) rows.push(['Entry', ev.entry]);
  if (ev.registration?.deadline && ev.d.state !== 'completed') rows.push(['Register by', ev.fmtDeadline]);
  return `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

function photosHtml(ctx, ev) {
  const g = ev.photos.gallery;
  if (!g.length) {
    const blank = [1, 2, 3, 4, 5, 6]
      .map(
        (n) =>
          `<div class="g${n}"><figure class="slot" style="--ratio:1/1"><div class="slot__ph" aria-hidden="true"><svg class="slot__lines" focusable="false"><use href="#arch-lines-fit"/></svg><span class="slot__tag">${icon('image')}Event photograph</span></div></figure></div>`,
      )
      .join('');
    return `<div class="gallery gallery--blank">${blank}</div>
      <p class="photos__note">Photographs from this event will be added here.</p>`;
  }
  const items = g
    .map((p) => {
      const cap = p.caption ? ` data-caption="${esc(p.caption)}"` : '';
      return `<a class="photo" href="${esc(p.src)}" data-lb="${esc(ev.slug)}" data-full="${esc(p.src)}"${cap}>${imgTag(p, { alt: p.alt, sizes: '(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 400px' })}</a>`;
    })
    .join('');
  return `<div class="photos" data-n="${Math.min(g.length, 4)}">${items}</div>`;
}

function recapSection(ctx, ev) {
  const rc = ev.recap || {};
  const summary = paragraphs(rc.summary);
  const desc = paragraphs(ev.description);
  const body = summary.length
    ? summary.map((p) => `<p>${esc(p)}</p>`).join('')
    : `${desc.map((p) => `<p>${esc(p)}</p>`).join('')}<p class="notice">A full summary of this event will be added here soon.</p>`;
  const stats = (rc.highlights || [])
    .filter((h) => h && h.label && h.value)
    .map((h) => `<div class="stat"><strong>${esc(h.value)}</strong><span>${esc(h.label)}</span></div>`)
    .join('');
  return `<section class="band when-done" id="recap" aria-labelledby="recap-title">
  <div class="wrap ev-layout">
    <div class="ev-main">
      <div class="prose"><h2 id="recap-title">About this event</h2>${body}</div>
      ${stats ? `<div class="stats">${stats}</div>` : ''}
      ${ev.page ? `<p><a class="link" href="${esc(ev.page)}">Read more about ${esc(ev.title)}</a></p>` : ''}
    </div>
    <aside class="ev-side" aria-label="Event details">${factsList(ev)}</aside>
  </div>
  <div class="wrap recap__photos" id="photos">
    <div class="sec-head"><h2>Photographs</h2><p class="lead">${ev.photos.gallery.length ? 'Select a photograph to view it larger.' : 'The photographs of this event will appear here.'}</p></div>
    ${photosHtml(ctx, ev)}
  </div>
</section>`;
}

function detailsSection(ctx, ev) {
  const paras = paragraphs(ev.description);
  const highlights = (ev.highlights || []).filter(Boolean);
  return `<section class="band when-open" id="details" aria-labelledby="about-title">
  <div class="wrap ev-layout">
    <div class="ev-main">
      <div class="prose"><h2 id="about-title">About the event</h2>${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${highlights.length ? `<div><h3 class="list-title">What to expect</h3><ul class="tick-list">${highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      ${factsList(ev)}
      ${ev.page ? `<p><a class="link" href="${esc(ev.page)}">Read more about ${esc(ev.title)}</a></p>` : ''}
    </div>
    <aside class="ev-side" aria-label="Registration">
      ${registrationCard(ctx, ev)}
    </aside>
  </div>
</section>`;
}

function moreEvents(ctx, ev) {
  const others = ES.sortEvents(ctx.events, ctx.now);
  const list = [...others.open, ...others.done].filter((e) => e.slug !== ev.slug).slice(0, 3);
  if (!list.length) return '';
  return `<section class="band tone-alt" aria-labelledby="more-title">
  <div class="wrap">
    <div class="sec-head"><h2 id="more-title">More events</h2></div>
    <div class="ev-grid">${list.map((e) => eventCard(ctx, e)).join('\n')}</div>
    <p class="more__all"><a class="btn btn--ghost" href="/events">See all events</a></p>
  </div>
</section>`;
}

function jsonLd(ctx, ev) {
  if (!ctx.baseUrl) return '';
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.title,
    description: ev.summary || undefined,
    startDate: isoStamp(ev.start),
    endDate: isoStamp(ev.end || ev.start),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@type': 'Organization', name: 'Shubhkant Foundation', url: ctx.baseUrl },
    url: `${ctx.baseUrl}${ev.url}`,
    image: ev.photos.cover ? `${ctx.baseUrl}${ev.photos.cover.src}` : ev.logo ? `${ctx.baseUrl}/${ev.logo}` : undefined,
    location: ev.venue ? { '@type': 'Place', name: ev.venue } : undefined,
  };
  if (ES.isTentative(ev)) return '';
  return `<script type="application/ld+json">${jsonForScript(JSON.parse(JSON.stringify(obj)))}</script>`;
}

/* ---------- the whole event page ---------- */

export function eventPage(ctx, ev) {
  const d = ev.d;
  const completed = d.state === 'completed';
  const dated = !ES.isTentative(ev);
  const start = dated ? ES.startMs(ev) : '';
  const hasPhotos = ev.photos.gallery.length > 0;

  const hero = `<section class="page-hero ev-hero tone-inv" aria-labelledby="page-title">
  <svg class="page-hero__arches" aria-hidden="true" focusable="false"><use href="#arch-lines"/></svg>
  <div class="wrap ev-hero__grid">
    <div class="ev-hero__copy">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/events">Events</a><span aria-hidden="true">/</span><span aria-current="page">${esc(ev.title)}</span></nav>
      <span class="badge" data-tone="${d.tone}" data-badge>${esc(d.badge)}</span>
      <h1 id="page-title">${esc(ev.title)}</h1>
      ${ev.subtitle ? `<p class="ev-hero__sub deva" lang="hi">${esc(ev.subtitle)}</p>` : ''}
      ${ev.tagline ? `<p class="ev-hero__tag${/[a-z]/i.test(ev.tagline) ? ' ev-hero__tag--latin' : ' deva'}"${/[a-z]/i.test(ev.tagline) ? '' : ' lang="hi"'}>${esc(ev.tagline)}</p>` : ''}
      <div class="meta">
        <span class="chip">${icon('calendar')}<span data-when>${esc(ev.when)}</span></span>
        ${ev.venue ? `<span class="chip">${icon('pin')}${esc(ev.venue)}</span>` : ''}
      </div>
      <div class="btn-row">
        <a class="btn reg-on when-open" href="#register" data-cta-link><span data-cta>${esc(d.cta)}</span>${icon('arrow')}</a>
        <a class="btn when-done" href="#photos">${hasPhotos ? 'View the photographs' : 'Read the summary'}${icon('arrow')}</a>
        ${ev.cal ? `<a class="btn btn--ghost when-open" href="${esc(ev.cal)}" target="_blank" rel="noopener noreferrer">${icon('calendar-plus')}Add to calendar<span class="sr-only"> (opens in a new tab)</span></a>` : ''}
        <a class="btn btn--ghost" href="#" data-share="whatsapp" hidden target="_blank" rel="noopener noreferrer">${icon('chat')}Share<span class="sr-only"> on WhatsApp (opens in a new tab)</span></a>
      </div>
      ${
        dated
          ? `<div class="clock when-open" data-clock data-start="${start}" role="timer" aria-label="Time until this event"${d.state === 'live' ? ' hidden' : ''}>
        <div class="clock__cell"><span class="clock__num" data-c="d">--</span><span class="clock__unit">days</span></div>
        <div class="clock__cell"><span class="clock__num" data-c="h">--</span><span class="clock__unit">hours</span></div>
        <div class="clock__cell"><span class="clock__num" data-c="m">--</span><span class="clock__unit">minutes</span></div>
        <div class="clock__cell"><span class="clock__num" data-c="s">--</span><span class="clock__unit">seconds</span></div>
      </div>`
          : ''
      }
    </div>
    ${
      ev.photos.cover
        ? `<div class="ev-hero__art"><div class="arch">${`<div class="slot slot--arch has-photo" style="--ratio:4/5">${imgTag(ev.photos.cover, { alt: ev.photos.cover.alt, sizes: '(max-width: 960px) 80vw, 400px', eager: true })}</div>`}</div></div>`
        : ev.logo
          ? `<img class="ev-hero__logo" src="/${esc(ev.logo)}" width="220" height="220" alt="${esc(ev.title)} logo">`
          : ''
    }
  </div>
</section>`;

  const body = [hero, completed ? '' : detailsSection(ctx, ev), recapSection(ctx, ev), moreEvents(ctx, ev), eventsDataScript([ev, ...ctx.events.filter((e) => e.slug !== ev.slug)])].join('\n');

  return {
    body,
    mainAttrs: ` data-event-page data-slug="${esc(ev.slug)}" data-state="${d.state}" data-reg="${d.reg}"`,
    head: jsonLd(ctx, ev),
  };
}
