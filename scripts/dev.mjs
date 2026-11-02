#!/usr/bin/env node
// Local preview that behaves like Vercel: clean URLs, 404 page and /api/register.
//   npm run dev            build, then serve http://localhost:3000
//   npm run dev:sample     same, with the sample completed event
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const port = Number((argv.find((a) => a.startsWith('--port=')) || '').slice(7)) || Number(process.env.PORT) || 3000;
const out = (argv.find((a) => a.startsWith('--out=')) || '--out=dist').slice(6);
if (!argv.includes('--no-build')) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs'), ...argv.filter((a) => a === '--sample' || a.startsWith('--now=')), `--out=${out}`], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
const DIST = path.join(ROOT, out);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain', '.xml': 'application/xml' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
const { handle } = await import('../api/register.mjs');

const exists = (f) => fs.stat(f).then((s) => s.isFile(), () => false);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/register') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await handle(new Request(`http://${req.headers.host}/api/register`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/') && p !== '/') { res.writeHead(308, { Location: p.slice(0, -1) }); return res.end(); }
  const candidates = p === '/' ? ['index.html'] : [p.slice(1), `${p.slice(1)}.html`];
  for (const c of candidates) {
    const f = path.join(DIST, c);
    if (f.startsWith(DIST) && (await exists(f))) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Content-Security-Policy': CSP });
      return res.end(await fs.readFile(f));
    }
  }
  res.writeHead(404, { 'Content-Type': TYPES['.html'], 'Content-Security-Policy': CSP });
  res.end(await fs.readFile(path.join(DIST, '404.html')));
}).listen(port, () => console.log(`\nServing ${out} at http://localhost:${port}`));
