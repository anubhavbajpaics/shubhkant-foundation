#!/usr/bin/env node
// npm test: event logic, the registration API (against a fake webhook) and a link check on the built site.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ES } from './lib/util.mjs';
import { handle } from '../api/register.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n${e.stack}`); process.exitCode = 1; } };
const at = (s) => Date.parse(s);

await test('event states follow the clock (IST)', () => {
  const ev = { start: '2026-11-16', end: '2026-11-17' };
  assert.equal(ES.stateOf(ev, at('2026-11-15T23:59:00+05:30')), 'upcoming');
  assert.equal(ES.stateOf(ev, at('2026-11-16T00:00:00+05:30')), 'live');
  assert.equal(ES.stateOf(ev, at('2026-11-17T23:59:00+05:30')), 'live');
  assert.equal(ES.stateOf(ev, at('2026-11-18T00:00:01+05:30')), 'completed');
});
await test('tentative, forced and timed events', () => {
  assert.equal(ES.stateOf({ start: '2027-01', dateTentative: true }, at('2026-11-01T00:00:00+05:30')), 'tentative');
  assert.equal(ES.stateOf({ start: '2026-01-01', status: 'completed' }), 'completed');
  assert.equal(ES.stateOf({ start: '2026-01-01', status: 'upcoming' }, at('2026-11-01T00:00:00+05:30')), 'upcoming');
  const t = { start: '2026-11-16T10:00', end: '2026-11-16T17:00' };
  assert.equal(ES.stateOf(t, at('2026-11-16T17:01:00+05:30')), 'completed');
});
await test('registration closes on deadline or by hand', () => {
  const ev = { start: '2026-12-01', registration: { deadline: '2026-11-20' } };
  assert.equal(ES.regState(ev, at('2026-11-20T23:00:00+05:30')), 'open');
  assert.equal(ES.regState(ev, at('2026-11-21T00:01:00+05:30')), 'closed');
  assert.equal(ES.regState({ registration: { open: false } }), 'closed');
  assert.equal(ES.describe({ start: '2026-12-01' }, at('2026-11-01T00:00:00+05:30')).cta, 'Register now');
  assert.equal(ES.describe({ start: '2026-09-01' }, at('2026-11-01T00:00:00+05:30')).cta, 'View recap');
});

/* ---------- API ---------- */
const hook = []; let hookMode = 'ok';
const server = http.createServer(async (req, res) => {
  let b = ''; for await (const c of req) b += c;
  hook.push(JSON.parse(b));
  if (hookMode === 'html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html>login</html>'); }
  if (hookMode === 'fail') { res.writeHead(500); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
}).listen(0);
const env = { REGISTRATION_WEBHOOK_URL: `http://127.0.0.1:${server.address().port}/` };
const NOW = at('2026-11-01T10:00:00+05:30');
const good = { event: 'navnirman-e-bharat', t: 5000, hp: '', fields: { name: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210', city: 'Delhi', consent: true } };
const post = (body, e = env, headers = {}) => handle(new Request('https://site.test/api/register', { method: 'POST', headers: { 'content-type': 'application/json', host: 'site.test', ...headers }, body: JSON.stringify(body) }), e, NOW);

await test('API accepts a valid registration and forwards it', async () => {
  const r = await post(good); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.match(j.ref, /^SF-[0-9A-F]{6}$/);
  const sent = hook.at(-1);
  assert.equal(sent.event.title, 'Navnirman-e-Bharat Youth Parliament'); assert.equal(sent.fields.email, 'asha@example.com'); assert.equal(sent.ref, j.ref);
});
await test('API rejects bad input with field messages', async () => {
  const r = await post({ ...good, fields: { ...good.fields, email: 'nope', phone: '12', name: '' } }); const j = await r.json();
  assert.equal(r.status, 400); assert.ok(j.fields.email && j.fields.phone && j.fields.name);
  const r2 = await post({ ...good, fields: { ...good.fields, consent: false } }); assert.ok((await r2.json()).fields.consent);
});
await test('API blocks unknown, ended and spam requests', async () => {
  assert.equal((await post({ ...good, event: 'nope' })).status, 404);
  const late = handle(new Request('https://site.test/api/register', { method: 'POST', headers: { 'content-type': 'application/json', host: 'site.test' }, body: JSON.stringify(good) }), env, at('2026-11-20T10:00:00+05:30'));
  assert.equal((await late).status, 409);
  const n = hook.length;
  const hp = await post({ ...good, hp: 'x' }); assert.equal((await hp.json()).ok, true); assert.equal(hook.length, n);
  assert.equal((await post({ ...good, t: 100 })).status, 400);
  assert.equal((await post(good, env, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await handle(new Request('https://site.test/api/register'), env, NOW)).status, 405);
});
await test('API never claims success when the webhook is missing or broken', async () => {
  assert.equal((await post(good, {})).status, 503);
  hookMode = 'html'; assert.equal((await post(good)).status, 502);
  hookMode = 'fail'; assert.equal((await post(good)).status, 502);
  hookMode = 'ok';
});
server.close();

/* ---------- built site ---------- */
await test('site builds and every internal link resolves', async () => {
  const out = 'dist-test';
  const b = spawnSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs'), '--sample', `--out=${out}`], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  const dist = path.join(ROOT, out);
  const files = []; const walk = async (d) => { for (const e of await fs.readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? await walk(p) : files.push(p); } };
  await walk(dist);
  const have = new Set(files.map((f) => '/' + path.relative(dist, f).split(path.sep).join('/')));
  const bad = [];
  for (const f of files.filter((x) => x.endsWith('.html'))) {
    const html = await fs.readFile(f, 'utf8');
    assert.ok(!/\{\{|undefined|\[object/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), `placeholder text left in ${f}`);
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      const u = m[1]; if (u.startsWith('//')) continue;
      const ok = have.has(u) || have.has(u + '.html') || (u === '/' && have.has('/index.html')) || u === '/api/register';
      if (!ok) bad.push(`${path.relative(dist, f)} -> ${u}`);
    }
  }
  await fs.rm(dist, { recursive: true, force: true });
  assert.deepEqual([...new Set(bad)], []);
});
console.log(`\n${passed} checks passed${process.exitCode ? ', some FAILED' : ''}`);
