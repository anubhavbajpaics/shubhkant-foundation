#!/usr/bin/env node
// Builds the site into ./dist (or --out=<dir>).
//
//   node scripts/build.mjs                 production build (what Vercel runs)
//   node scripts/build.mjs --sample        also include the sample completed event from docs/
//   node scripts/build.mjs --preview       relative .html links, so the pages open straight from a folder
//   node scripts/build.mjs --now=2026-11-20T10:00:00+05:30   pretend it is this moment (to test states)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ES, esc, warn } from './lib/util.mjs';
import { whenText, calendarUrl, deadlineText } from './lib/format.mjs';
import { loadSharp, createPhotoProcessor, eventPhotos, slotPhoto, galleryPhotos } from './lib/photos.mjs';
import { header, footer, eventCard, fill, imgTag, icon } from './lib/render.mjs';
import { eventPage } from './lib/render-events.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const PREVIEW = Boolean(args.preview || args.artifact);
const OUT = path.resolve(ROOT, args.out || (PREVIEW ? 'dist-preview' : 'dist'));
const NOW = args.now ? Date.parse(args.now) : Date.now();
if (Number.isNaN(NOW)) throw new Error(`--now must be a date, e.g. 2026-11-20T10:00:00+05:30`);

const readJson = async (rel, fallback) => {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, rel), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw new Error(`Could not read ${rel}: ${err.message}`);
  }
};

/* ---------- data ---------- */

function validateEvents(list) {
  if (!Array.isArray(list)) throw new Error('data/events.json must be a list: [ { ... }, { ... } ]');
  const seen = new Set();
  list.forEach((e, i) => {
    const where = `data/events.json, event ${i + 1}${e?.title ? ` ("${e.title}")` : ''}`;
    if (!e || typeof e !== 'object') throw new Error(`${where}: each event must be an object`);
    if (!e.title) throw new Error(`${where}: "title" is required`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug || '') || e.slug === 'index')
      throw new Error(`${where}: "slug" must use lowercase letters, numbers and hyphens only, e.g. "youth-summit-2026"`);
    if (seen.has(e.slug)) throw new Error(`${where}: the slug "${e.slug}" is used twice`);
    seen.add(e.slug);
    if (!ES.parse(e.start)) throw new Error(`${where}: "start" must look like 2026-11-16, 2026-11-16T10:00 or 2027-01`);
    if (e.end && !ES.parse(e.end)) throw new Error(`${where}: "end" must look like 2026-11-17 or 2026-11-17T17:00`);
    if (e.end && ES.endMs(e) < ES.startMs(e)) warn(`${where}: "end" is before "start"`);
    if (e.status && !['auto', 'upcoming', 'completed'].includes(e.status))
      throw new Error(`${where}: "status" must be "auto", "upcoming" or "completed"`);
    const r = e.registration || {};
    if (r.mode && !['form', 'external', 'none'].includes(r.mode))
      throw new Error(`${where}: registration "mode" must be "form", "external" or "none"`);
    if (r.mode === 'external' && !r.url) warn(`${where}: registration mode is "external" but no "url" was given; using the built-in form`);
    if (r.deadline && !ES.parse(r.deadline)) throw new Error(`${where}: registration "deadline" must look like 2026-11-14`);
  });
}

/* ---------- page files ---------- */

function parsePage(src, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  const meta = {};
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const base = file.replace(/\.html$/, '');
  return { meta, body: m ? src.slice(m[0].length) : src, file, url: base === 'index' ? '/' : `/${base}`, out: `${base}.html` };
}

function layout(ctx, page, body, extra = {}) {
  const { site, baseUrl } = ctx;
  const title = /shubhkant/i.test(page.title) ? page.title : `${page.title} | ${site.name}`;
  const desc = page.description || site.description;
  const abs = baseUrl ? `${baseUrl}${page.url}` : '';
  const ogImage = baseUrl ? `${baseUrl}/assets/og.png` : '';
  const needs = new Set((page.scripts || []).filter(Boolean));
  const usesState = needs.has('events') || needs.has('register') || needs.has('admin');
  const list = [...(usesState ? ['event-state'] : []), 'site', ...needs];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0d2a16">
${page.noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
${abs ? `<link rel="canonical" href="${esc(abs)}">` : ''}
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${abs ? `<meta property="og:url" content="${esc(abs)}">` : ''}
${ogImage && !page.noindex ? `<meta property="og:image" content="${esc(ogImage)}"><meta name="twitter:card" content="summary_large_image">` : ''}
${PREVIEW ? '<meta name="sf-preview" content="1">' : ''}
<link rel="icon" href="/assets/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Instrument+Sans:wght@400..700&family=Tiro+Devanagari+Hindi:ital@0;1&display=swap">
<link rel="stylesheet" href="/css/style.css">
${extra.head || ''}
</head>
<body>
${ctx.sprite}
<a class="skip" href="#main">Skip to main content</a>
${header(ctx, page)}
<main id="main"${extra.mainAttrs || ''}>
${body}
</main>
${footer(ctx)}
<dialog class="lightbox" id="lightbox" aria-label="Photo viewer">
  <button class="lightbox__close" type="button" aria-label="Close photo">${icon('close')}</button>
  <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous photo">${icon('arrow-left')}</button>
  <img src="" alt="">
  <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next photo">${icon('arrow')}</button>
  <p class="lightbox__cap"></p>
</dialog>
<button class="to-top" id="to-top" type="button" aria-label="Back to top" hidden>${icon('up')}</button>
${list.map((n) => `<script src="/js/${n}.js" defer></script>`).join('\n')}
</body>
</html>
`;
}

/* ---------- preview mode: make links relative so the pages open from a folder ---------- */

function relativize(html, outFile) {
  const fromDir = path.posix.dirname(outFile);
  const fix = (u) => {
    if (!u.startsWith('/') || u.startsWith('//')) return u;
    const m = /^([^?#]*)(.*)$/.exec(u);
    let p = m[1];
    if (p === '/' || p === '') p = '/index.html';
    else if (!/\.[a-z0-9]+$/i.test(p)) p = `${p}.html`;
    let rel = path.posix.relative(fromDir, p.slice(1));
    if (!rel) rel = path.posix.basename(p);
    return rel + m[2];
  };
  return html
    .replace(/\b(href|src)="([^"]*)"/g, (m, a, u) => `${a}="${fix(u)}"`)
    .replace(/\bsrcset="([^"]*)"/g, (m, set) => `srcset="${set.split(',').map((part) => { const [u, ...d] = part.trim().split(/\s+/); return [fix(u), ...d].join(' '); }).join(', ')}"`);
}

/** The artifact host wraps the main page itself, so it wants a fragment, not a document. */
function toFragment(html) {
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)[1];
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1]
    .replace(/<meta charset[^>]*>\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  const body = /<body>([\s\S]*?)<\/body>/.exec(html)[1];
  return `<title>${title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${head}\n${body}`;
}

/* ---------- main ---------- */

async function main() {
  const t0 = Date.now();
  console.log(`Building ${PREVIEW ? 'preview' : 'production'} site -> ${path.relative(ROOT, OUT) || '.'}${args.now ? `  (pretending it is ${args.now})` : ''}`);

  const site = await readJson('data/site.json');
  let rawEvents = await readJson('data/events.json');
  const photoMeta = await readJson('data/photos.json', {});
  const sampleDir = path.join(ROOT, 'docs', 'sample-photos');
  if (args.sample) {
    const sample = await readJson('docs/sample-events.json');
    rawEvents = [...rawEvents, ...sample.map((e) => ({ ...e, _sample: true }))];
  }
  validateEvents(rawEvents);

  const envUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '';
  const baseUrl = PREVIEW ? '' : (process.env.SITE_URL || site.url || envUrl || '').replace(/\/+$/, '');
  if (!PREVIEW && !baseUrl) warn('No site address known (set "url" in data/site.json). Canonical links, share previews and the sitemap are skipped.');

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  await fs.cp(path.join(ROOT, 'static'), OUT, { recursive: true, filter: (src) => !src.startsWith(path.join(ROOT, 'static', 'photos')) });

  const hasSharp = await loadSharp();
  if (!hasSharp) warn('The "sharp" image package is not installed, so photos are copied as they are (not resized).');
  const processPhoto = createPhotoProcessor(OUT);
  const staticRoot = path.join(ROOT, 'static');

  const ctx = {
    mode: PREVIEW ? 'preview' : 'production',
    site, baseUrl, now: NOW, year: new Date(NOW).getFullYear(),
    rawEvents: rawEvents.filter((e) => !e._sample),
    photoAlts: photoMeta,
    slots: {}, events: [], galleryHtml: '',
  };

  const sprite = (await fs.readFile(path.join(ROOT, 'src/partials/sprite.html'), 'utf8')).replace('{{VINE}}', await fs.readFile(path.join(ROOT, 'src/partials/vine.symbol.html'), 'utf8'));
  ctx.sprite = sprite;
  ctx.qrSvg = (await fs.readFile(path.join(ROOT, 'src/partials/qr.svg'), 'utf8')).replace(' class="segno"', '');

  const slotIds = new Set();
  const pageFiles = (await fs.readdir(path.join(ROOT, 'src/pages'))).filter((f) => f.endsWith('.html')).sort();
  const pages = [];
  for (const file of pageFiles) {
    const raw = await fs.readFile(path.join(ROOT, 'src/pages', file), 'utf8');
    const page = parsePage(raw, file);
    for (const m of page.body.matchAll(/\{\{\s*slot\s*:\s*([^|}]+)/g)) slotIds.add(m[1].trim());
    pages.push(page);
  }
  for (const id of slotIds) {
    const p = await slotPhoto(id, { staticRoot, processPhoto });
    if (p) ctx.slots[id] = p;
  }

  for (const raw of rawEvents) {
    const ev = { status: 'auto', ...raw };
    ev.url = `/events/${ev.slug}`;
    ev.when = whenText(ev);
    ev.d = ES.describe(ev, NOW);
    ev.cal = calendarUrl(ev, baseUrl ? `${baseUrl}${ev.url}` : '');
    ev.fmtDeadline = ev.registration?.deadline ? deadlineText(ev.registration.deadline) : '';
    ev.summary = ev.summary || String((Array.isArray(ev.description) ? ev.description[0] : ev.description) || '').trim();
    ev.photos = await eventPhotos(ev, { staticRoot, processPhoto, dirOverride: ev._sample ? path.join(sampleDir, ev.slug) : undefined });
    ctx.events.push(ev);
  }

  const gallery = await galleryPhotos({ staticRoot, processPhoto, captions: photoMeta.gallery || {} });
  const doneWithPhotos = ES.sortEvents(ctx.events, NOW).done.filter((e) => e.photos.gallery.length);
  ctx.galleryHtml = renderGallery(ctx, gallery, doneWithPhotos);

  const written = [];
  const write = async (outFile, html) => {
    const final = PREVIEW ? relativize(html, outFile) : html;
    const file = path.join(OUT, outFile);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, args.artifact && outFile === 'index.html' ? toFragment(final) : final);
    written.push(outFile);
  };

  for (const page of pages) {
    const p = { ...page.meta, file: page.file, url: page.url, scripts: (page.meta.scripts || '').split(',').map((s) => s.trim()).filter(Boolean), noindex: page.meta.noindex === 'true' };
    p.title = p.title || 'Shubhkant Foundation';
    const body = fill(page.body, ctx, p);
    await write(page.out, layout(ctx, p, body, { head: '' }));
  }

  for (const ev of ctx.events) {
    const p = { title: ev.title, description: ev.summary, nav: 'events', url: ev.url, scripts: ['events', 'register'], file: 'event' };
    const out = eventPage(ctx, ev);
    await write(`events/${ev.slug}.html`, layout(ctx, p, out.body, { mainAttrs: out.mainAttrs, head: out.head }));
  }

  if (!PREVIEW) {
    const urls = pages.filter((p) => !['404.html', 'add-event.html'].includes(p.file) && p.meta.noindex !== 'true').map((p) => p.url).concat(ctx.events.map((e) => e.url));
    await fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /add-event\n${baseUrl ? `Sitemap: ${baseUrl}/sitemap.xml\n` : ''}`);
    if (baseUrl) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(baseUrl + (u === '/' ? '/' : u))}</loc></url>`).join('\n')}\n</urlset>\n`;
      await fs.writeFile(path.join(OUT, 'sitemap.xml'), xml);
    }
  }

  const g = ES.sortEvents(ctx.events, NOW);
  console.log(`  ${written.length} pages  |  ${g.open.length} upcoming, ${g.done.length} completed event(s)  |  ${Object.keys(ctx.slots).length} slot photo(s), ${gallery.length} gallery photo(s)  |  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function renderGallery(ctx, general, doneEvents) {
  const photo = (p, group) =>
    `<a class="photo" href="${esc(p.src)}" data-lb="${esc(group)}" data-full="${esc(p.src)}"${p.caption ? ` data-caption="${esc(p.caption)}"` : ''}>${imgTag(p, { alt: p.alt, sizes: '(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 400px' })}</a>`;
  const blocks = [];
  for (const ev of doneEvents) {
    const items = ev.photos.gallery;
    blocks.push(`<section class="gal-block" aria-labelledby="g-${esc(ev.slug)}">
      <div class="gal-block__head"><h3 id="g-${esc(ev.slug)}">${esc(ev.title)}</h3><a class="link" href="${esc(ev.url)}">Event summary</a></div>
      <div class="photos" data-n="${Math.min(items.length, 4)}">${items.map((p) => photo(p, ev.slug)).join('')}</div></section>`);
  }
  if (general.length) {
    blocks.push(`<section class="gal-block" aria-labelledby="g-general">
      <div class="gal-block__head"><h3 id="g-general">${doneEvents.length ? 'More moments' : 'Moments from our work'}</h3></div>
      <div class="photos" data-n="${Math.min(general.length, 4)}">${general.map((p) => photo(p, 'general')).join('')}</div></section>`);
  }
  if (!blocks.length) {
    const blank = [1, 2, 3, 4, 5, 6]
      .map((n) => `<div class="g${n}"><figure class="slot" style="--ratio:1/1"><div class="slot__ph" aria-hidden="true"><svg class="slot__lines" focusable="false"><use href="#arch-lines-fit"/></svg><span class="slot__tag">${icon('image')}Gallery photograph</span></div></figure></div>`)
      .join('');
    return `<div class="gallery gallery--blank">${blank}</div><p class="photos__note">Photographs from our programmes and events will be added here.</p>`;
  }
  return blocks.join('\n');
}

main().catch((err) => {
  console.error(`\nBuild failed: ${err.message}\n`);
  process.exit(1);
});
