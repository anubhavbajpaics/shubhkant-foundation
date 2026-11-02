// Building blocks shared by every page: icons, photo slots, header, footer,
// event cards and the {{token}} engine used by src/pages/*.html.
import { esc, jsonForScript, ES } from './util.mjs';

export const icon = (name, cls = '') =>
  `<svg class="i${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

/* ---------- images and photo slots ---------- */

export function imgTag(photo, { alt = '', sizes = '100vw', eager = false, cls = '' } = {}) {
  if (!photo) return '';
  const dims = photo.w ? ` width="${photo.w}" height="${photo.h}"` : '';
  const set = photo.srcset ? ` srcset="${esc(photo.srcset)}" sizes="${esc(sizes)}"` : '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(photo.src)}"${set}${dims} alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
}

/** A framed photo space. Blank until a file named <id>.jpg is placed in static/photos/slots/. */
export function slot(ctx, [id, variant = 'round', ratio = '1/1', label = 'Photograph', fit = 'cover']) {
  const photo = ctx.slots[id];
  const arch = variant === 'arch';
  const alt = ctx.photoAlts.slots?.[id] || label;
  const attrs =
    `class="slot${arch ? ' slot--arch' : ''}${photo ? ' has-photo' : ''}" data-slot="${esc(id)}" style="--ratio:${esc(ratio)}"` +
    (fit === 'contain' ? ' data-fit="contain"' : '');
  const ph =
    `<div class="slot__ph" aria-hidden="true"><svg class="slot__lines" focusable="false"><use href="#${arch ? 'arch-lines' : 'arch-lines-fit'}"/></svg>` +
    `<span class="slot__tag">${icon('image')}${esc(label)}</span></div>`;
  return `<figure ${attrs}>${ph}${photo ? imgTag(photo, { alt, sizes: '(max-width: 960px) 100vw, 50vw' }) : ''}</figure>`;
}

/* ---------- contact details (filled in data/site.json) ---------- */

export function contactBlock(ctx, heading = '') {
  const c = ctx.site.contact || {};
  const row = (ic, label, value, href) =>
    `<li>${icon(ic)}${href ? `<a href="${esc(href)}">${esc(value)}</a>` : `<span class="val">${esc(value)}</span>`}` +
    (href
      ? `<button class="copy" type="button" data-copy="${esc(value)}" title="Copy ${esc(label.toLowerCase())}">${icon('copy')}<span class="sr-only">Copy</span></button>`
      : '<span></span>') +
    '</li>';
  const rows = [];
  if (c.email) rows.push(row('mail', 'Email', c.email, `mailto:${c.email}`));
  if (c.phone) rows.push(row('phone', 'Phone', c.phone, `tel:${String(c.phone).replace(/[^+\d]/g, '')}`));
  if (c.whatsapp) {
    const digits = String(c.whatsapp).replace(/\D/g, '');
    rows.push(row('chat', 'WhatsApp', c.whatsapp, `https://wa.me/${digits}`));
  }
  if (c.address) rows.push(row('pin', 'Address', c.address, ''));
  const social = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['facebook', 'Facebook'], ['youtube', 'YouTube']]
    .filter(([k]) => c[k])
    .map(([k, label]) => `<a class="link" href="${esc(c[k])}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (opens in a new tab)</span></a>`);
  const h = heading ? `<h3>${esc(heading)}</h3>` : '';
  if (!rows.length && !social.length) {
    return `${h}<p class="contact-empty">Contact details will be added here shortly.</p>`;
  }
  return `${h}${rows.length ? `<ul class="contact-list">${rows.join('')}</ul>` : ''}${social.length ? `<div class="social">${social.join('')}</div>` : ''}`;
}

/* ---------- header and footer ---------- */

const NAV = [
  ['about', '/about', 'About'],
  ['events', '/events', 'Events'],
  ['bana-daal', '/bana-daal', 'BANA DAAL'],
  ['gallery', '/gallery', 'Gallery'],
  ['partner', '/partner', 'Partner with us'],
  ['contact', '#contact', 'Contact'],
];

export function header(ctx, page) {
  const items = NAV.map(([key, href, label]) => {
    const current = key === page.nav ? ' aria-current="page"' : '';
    return `<li><a href="${href}"${current}>${label}</a></li>`;
  }).join('');
  return `<header class="site-header" id="site-header">
  <div class="wrap site-header__bar">
    <a class="brand" href="/" aria-label="Shubhkant Foundation, home">
      <img class="brand__mark" src="/assets/logo-shubhkant-emblem.webp" width="46" height="46" alt="">
      <span class="brand__name">Shubhkant Foundation</span>
    </a>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">
      <svg class="i i--menu" aria-hidden="true"><use href="#i-menu"/></svg>
      <svg class="i i--close" aria-hidden="true"><use href="#i-close"/></svg>
      <span class="sr-only">Menu</span>
    </button>
    <nav class="nav" id="nav" aria-label="Primary">
      <ul class="nav__list">${items}</ul>
      <a class="btn nav__cta" href="/join"${page.nav === 'join' ? ' aria-current="page"' : ''}>Join the team</a>
    </nav>
  </div>
</header>`;
}

export function footer(ctx) {
  const initiatives = ctx.events
    .filter((e) => e.logo)
    .slice(0, 4)
    .map(
      (e) =>
        `<li><a href="${esc(e.url)}"><img src="/${esc(e.logo)}" width="48" height="48" alt=""><span>${esc(e.title)}</span></a></li>`,
    )
    .join('');
  return `<footer class="foot tone-inv" id="contact">
  <div class="wrap">
    <div class="foot__grid">
      <div class="foot__brand">
        <img class="brand__mark" src="/assets/logo-shubhkant-emblem.webp" width="64" height="64" alt="">
        <p class="brand__name">Shubhkant Foundation</p>
        <p class="deva" lang="hi">${esc(ctx.site.taglineHi)}</p>
        <p>A Section 8 non-profit organisation committed to social development, youth empowerment, education and community welfare.</p>
      </div>
      <nav aria-label="Footer">
        <h2>Explore</h2>
        <ul class="foot__links">
          <li><a href="/about">About us</a></li>
          <li><a href="/events">Events</a></li>
          <li><a href="/bana-daal">BANA DAAL</a></li>
          <li><a href="/gallery">Gallery</a></li>
          <li><a href="/partner">Partner with us</a></li>
          <li><a href="/join">Join the team</a></li>
        </ul>
      </nav>
      <div>
        <h2>Our events</h2>
        <ul class="initiatives">${initiatives}</ul>
      </div>
      <div class="foot__contact">
        <h2>Contact</h2>
        ${contactBlock(ctx)}
      </div>
    </div>
    <div class="foot__bar">
      <p>&copy; <span id="year">${ctx.year}</span> Shubhkant Foundation. All rights reserved.</p>
      <p>Section 8 non-profit organisation <span aria-hidden="true">&middot;</span> <a href="/add-event" class="foot__admin">Organisers: add an event</a></p>
    </div>
  </div>
</footer>`;
}

/* ---------- event cards (the "event buttons") ---------- */

export function eventCard(ctx, ev) {
  const d = ev.d;
  const cover = ev.photos.cover;
  const media = cover
    ? imgTag(cover, { alt: '', sizes: '(max-width: 720px) 100vw, 400px', cls: 'cover' })
    : `<svg class="ev-card__lines" aria-hidden="true" focusable="false"><use href="#arch-lines-fit"/></svg>` +
      (ev.logo ? `<img class="ev-card__logo" src="/${esc(ev.logo)}" width="128" height="128" alt="">` : '');
  return `<article class="ev-card" data-event="${esc(ev.slug)}" data-state="${d.state}" data-reg="${d.reg}">
  <div class="ev-card__media">${media}<span class="badge" data-tone="${d.tone}" data-badge>${esc(d.badge)}</span></div>
  <div class="ev-card__body">
    <p class="ev-card__when">${icon('calendar')}<span data-when>${esc(ev.when)}</span></p>
    <h3><a href="${esc(ev.url)}">${esc(ev.title)}<span class="sr-only">: <span data-cta-sr>${esc(d.cta.toLowerCase())}</span></span></a></h3>
    ${ev.subtitle ? `<p class="ev-card__sub deva" lang="hi">${esc(ev.subtitle)}</p>` : ''}
    ${ev.summary ? `<p class="sum">${esc(ev.summary)}</p>` : ''}
    <span class="ev-card__cta" aria-hidden="true"><span data-cta>${esc(d.cta)}</span>${icon('arrow')}</span>
  </div>
</article>`;
}

/** Compact data the browser needs to keep event states fresh without a redeploy. */
export function clientEvents(list) {
  return list.map((e) => ({
    slug: e.slug,
    title: e.title,
    url: e.url,
    when: e.when,
    cal: e.cal || '',
    start: e.start,
    end: e.end || '',
    status: e.status || 'auto',
    dateTentative: Boolean(e.dateTentative),
    registration: { mode: e.registration?.mode || 'form', open: e.registration?.open !== false, deadline: e.registration?.deadline || '' },
  }));
}

export const eventsDataScript = (list) =>
  `<script type="application/json" id="events-data">${jsonForScript(clientEvents(list))}</script>`;

/* ---------- the next-event card on the home page ---------- */

export function nextEventCard(ctx) {
  const next = ES.nextEvent(ctx.events, ctx.now);
  if (!next) return '';
  const d = next.d;
  const start = ES.isTentative(next) ? '' : ES.startMs(next);
  return `<div class="wrap next-wrap">
  <aside class="next" id="next-event" aria-labelledby="next-title">
    <div class="next__main">
      <p class="next__label"><span class="next__dot" aria-hidden="true"></span><span id="next-label">${d.state === 'live' ? 'Happening now' : d.state === 'tentative' ? 'Coming up' : 'Next event'}</span></p>
      <h2 class="next__title" id="next-title">${esc(next.title)}</h2>
      <p class="next__date" id="next-date">${esc(next.when)}</p>
      <div class="next__actions">
        <a class="btn btn--small" id="next-details" href="${esc(next.url)}"><span id="next-cta">${esc(d.cta)}</span>${icon('arrow')}</a>
        <a class="btn btn--small btn--ghost" id="next-cal" href="${esc(next.cal || '#')}"${next.cal ? '' : ' hidden'} target="_blank" rel="noopener noreferrer">${icon('calendar-plus')}Add to calendar<span class="sr-only"> (opens in a new tab)</span></a>
      </div>
    </div>
    <div class="clock" id="clock" data-clock data-start="${start}" role="timer" aria-label="Time until the event"${start === '' || d.state === 'live' ? ' hidden' : ''}>
      <div class="clock__cell"><span class="clock__num" data-c="d">--</span><span class="clock__unit">days</span></div>
      <div class="clock__cell"><span class="clock__num" data-c="h">--</span><span class="clock__unit">hours</span></div>
      <div class="clock__cell"><span class="clock__num" data-c="m">--</span><span class="clock__unit">minutes</span></div>
      <div class="clock__cell"><span class="clock__num" data-c="s">--</span><span class="clock__unit">seconds</span></div>
    </div>
    <p class="next__live" id="next-live"${d.state === 'live' ? '' : ' hidden'}>This event is on today.</p>
  </aside>
</div>`;
}

/* ---------- inner-page hero ---------- */

export function pageHero(ctx, page) {
  const crumbs = page.crumbs || [['Home', '/'], [page.h1 || page.title, null]];
  const trail = crumbs
    .map(([label, href], i) => {
      const last = i === crumbs.length - 1;
      return (i ? '<span aria-hidden="true">/</span>' : '') + (last || !href ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${href}">${esc(label)}</a>`);
    })
    .join('');
  return `<section class="page-hero tone-inv" aria-labelledby="page-title">
  <svg class="page-hero__arches" aria-hidden="true" focusable="false"><use href="#arch-lines"/></svg>
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb">${trail}</nav>
    <h1 id="page-title">${esc(page.h1 || page.title)}</h1>
    ${page.lead ? `<p class="page-hero__lead">${esc(page.lead)}</p>` : ''}
  </div>
</section>`;
}

/* ---------- the {{token}} engine for src/pages/*.html ---------- */

const eventBySlug = (ctx, slug) => ctx.events.find((e) => e.slug === slug);

const components = {
  slot: (ctx, a) => slot(ctx, a),
  icon: (ctx, [name, cls]) => icon(name, cls),
  qr: (ctx) => ctx.qrSvg,
  apply_url: (ctx) => esc(ctx.site.applyUrl),
  year: (ctx) => String(ctx.year),
  contact_block: (ctx, [heading]) => contactBlock(ctx, heading),
  next_event: (ctx) => nextEventCard(ctx),
  page_hero: (ctx, a, page) => pageHero(ctx, page),
  events_preview: (ctx) => {
    const g = ES.sortEvents(ctx.events, ctx.now);
    const pick = [...g.open, ...g.done].slice(0, 3);
    return pick.map((e) => eventCard(ctx, e)).join('\n');
  },
  events_open: (ctx) => ES.sortEvents(ctx.events, ctx.now).open.map((e) => eventCard(ctx, e)).join('\n'),
  events_done: (ctx) => ES.sortEvents(ctx.events, ctx.now).done.map((e) => eventCard(ctx, e)).join('\n'),
  count_open: (ctx) => String(ES.sortEvents(ctx.events, ctx.now).open.length),
  count_done: (ctx) => String(ES.sortEvents(ctx.events, ctx.now).done.length),
  hidden_if_open_empty: (ctx) => (ES.sortEvents(ctx.events, ctx.now).open.length ? ' hidden' : ''),
  hidden_if_done_empty: (ctx) => (ES.sortEvents(ctx.events, ctx.now).done.length ? ' hidden' : ''),
  event_when: (ctx, [slug]) => esc(eventBySlug(ctx, slug)?.when || ''),
  event_url: (ctx, [slug]) => esc(eventBySlug(ctx, slug)?.url || '/events'),
  event_cta: (ctx, [slug]) => esc(eventBySlug(ctx, slug)?.d.cta || 'See all events'),
  event_cal: (ctx, [slug]) => esc(eventBySlug(ctx, slug)?.cal || ''),
  event_state: (ctx, [slug]) => esc(eventBySlug(ctx, slug)?.d.state || ''),
  event_cal_button: (ctx, [slug, cls = 'btn btn--ghost']) => {
    const url = eventBySlug(ctx, slug)?.cal;
    return url
      ? `<a class="${esc(cls)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('calendar-plus')}Add to calendar<span class="sr-only"> (opens in a new tab)</span></a>`
      : '';
  },
  gallery: (ctx, a, page) => ctx.galleryHtml,
  events_data: (ctx) => eventsDataScript(ctx.events),
  events_source: (ctx) => `<script type="application/json" id="events-source">${jsonForScript(ctx.rawEvents)}</script>`,
};

export function fill(html, ctx, page) {
  return html.replace(/\{\{\s*([a-z_]+)\s*(?::([^}]*))?\}\}/g, (m, name, args) => {
    const fn = components[name];
    if (!fn) throw new Error(`Unknown token {{${name}}} in ${page.file}`);
    return fn(ctx, (args || '').split('|').map((s) => s.trim()), page);
  });
}
