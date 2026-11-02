// Small helpers shared by the build scripts. No dependencies.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** The same event logic the browser and the API use. */
export const ES = require('../../static/js/event-state.js');

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** JSON that is safe inside a <script> element. */
export const jsonForScript = (v) =>
  JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029');

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** Accepts an array of paragraphs or one string with blank lines between paragraphs. */
export const paragraphs = (v) =>
  Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter(Boolean)
    : v
      ? String(v).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)
      : [];

/** Natural sort so photo-2 comes before photo-10. */
export const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

export function warn(msg) {
  console.warn(`  ! ${msg}`);
}
