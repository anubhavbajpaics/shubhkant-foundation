// POST /api/register
// Checks a registration, then forwards it to REGISTRATION_WEBHOOK_URL
// (see docs/registrations-google-sheet.gs). Nothing is stored on Vercel.
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import ES from '../static/js/event-state.js';

const MAX_BODY = 16 * 1024;
const MIN_FILL_MS = 1200;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

async function loadJson(rel) {
  try {
    return JSON.parse(await readFile(new URL(rel, import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}

const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);

function checkFields(defs, input) {
  const errors = {};
  const values = {};
  for (const f of defs) {
    const raw = input?.[f.id];
    const v = clean(raw, f.maxlength || (f.type === 'textarea' ? 1000 : 200));
    if (f.required && !v) { errors[f.id] = 'Please fill in this field.'; continue; }
    if (!v) { values[f.id] = ''; continue; }
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errors[f.id] = 'Enter a valid email address.';
    else if (f.type === 'tel' && (!/^[+\d\s().-]+$/.test(v) || v.replace(/\D/g, '').length < 7 || v.replace(/\D/g, '').length > 15)) errors[f.id] = 'Enter a valid phone number.';
    else if (f.type === 'select' && !(f.options || []).includes(v)) errors[f.id] = 'Choose one of the options.';
    values[f.id] = v;
  }
  return { errors, values };
}

export async function handle(request, env = process.env, now = Date.now()) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).host; } catch { /* invalid */ }
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (oh !== host && !allowed.includes(origin)) return json({ ok: false, error: 'forbidden' }, 403);
  }
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json({ ok: false, error: 'bad_request' }, 415);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_request' }, 400);

  const ref = `SF-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
  if (body.hp) return json({ ok: true, ref }); // honeypot: pretend it worked
  if (Number(body.t) < MIN_FILL_MS) return json({ ok: false, error: 'too_fast' }, 400);

  const slug = clean(body.event, 80);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return json({ ok: false, error: 'unknown_event' }, 404);

  const site = await loadJson('../data/site.json');
  const events = await loadJson('../data/events.json');
  let title = slug;
  let when = '';
  let defs = site?.registrationFields;
  if (events) {
    const ev = events.find((e) => e.slug === slug);
    if (!ev) return json({ ok: false, error: 'unknown_event' }, 404);
    const d = ES.describe({ status: 'auto', ...ev }, now);
    if (d.state === 'completed') return json({ ok: false, error: 'ended' }, 409);
    if (d.reg !== 'open' || ev.registration?.mode === 'external') return json({ ok: false, error: 'closed' }, 409);
    title = ev.title;
    when = ev.dateText || ev.start;
    defs = ev.registration?.fields || defs;
  }
  if (!defs) return json({ ok: false, error: 'not_configured' }, 503);

  const { errors, values } = checkFields(defs, body.fields);
  if (body.fields?.consent !== true) errors.consent = 'Please tick this box to continue.';
  if (Object.keys(errors).length) return json({ ok: false, error: 'invalid', fields: errors }, 400);

  const url = env.REGISTRATION_WEBHOOK_URL;
  if (!url) return json({ ok: false, error: 'not_configured' }, 503);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        secret: env.REGISTRATION_WEBHOOK_SECRET || undefined,
        kind: 'registration',
        ref,
        submittedAt: new Date(now).toISOString(),
        event: { slug, title, when },
        fields: values,
        fieldLabels: Object.fromEntries(defs.map((f) => [f.id, f.label])),
      }),
    });
    const type = res.headers.get('content-type') || '';
    const raw = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
    if (!res.ok || type.includes('text/html') || parsed?.ok === false || parsed?.error) {
      console.error('Registration webhook rejected the request', res.status, raw.slice(0, 200));
      return json({ ok: false, error: 'upstream' }, 502);
    }
    return json({ ok: true, ref: parsed?.ref || ref, duplicate: Boolean(parsed?.duplicate) });
  } catch (err) {
    console.error('Registration webhook failed', err?.message);
    return json({ ok: false, error: 'upstream' }, 502);
  }
}

export default {
  fetch(request) {
    return handle(request);
  },
};
