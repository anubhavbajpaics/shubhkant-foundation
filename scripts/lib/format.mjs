// Turns the dates in data/events.json into the text people read.
import { ES } from './util.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const two = (n) => (n < 10 ? `0${n}` : String(n));

const day = (p) => `${p.d} ${MONTHS[p.mo - 1]} ${p.y}`;
const clock = (p) => {
  const h = p.h % 12 || 12;
  return `${h}:${two(p.mi)} ${p.h >= 12 ? 'pm' : 'am'}`;
};
const sameDay = (a, b) => a.y === b.y && a.mo === b.mo && a.d === b.d;

/** "16 and 17 November 2026", "27 December 2026", "Tentatively January 2027" ... */
export function whenText(ev) {
  if (ev.dateText) return ev.dateText;
  const s = ES.parse(ev.start);
  if (!s) return 'Date to be announced';
  if (ES.isTentative(ev)) return `${MONTHS[s.mo - 1]} ${s.y} (tentative)`;
  const e = ES.parse(ev.end) || s;

  if (s.h != null) {
    if (sameDay(s, e)) {
      return e.h != null && (e.h !== s.h || e.mi !== s.mi)
        ? `${day(s)}, ${clock(s)} to ${clock(e)} IST`
        : `${day(s)}, ${clock(s)} IST`;
    }
    return `${day(s)}, ${clock(s)} to ${day(e)}${e.h != null ? `, ${clock(e)}` : ''} IST`;
  }
  if (sameDay(s, e)) return day(s);
  if (s.y === e.y && s.mo === e.mo) {
    return e.d - s.d === 1
      ? `${s.d} and ${e.d} ${MONTHS[s.mo - 1]} ${s.y}`
      : `${s.d} to ${e.d} ${MONTHS[s.mo - 1]} ${s.y}`;
  }
  if (s.y === e.y) return `${s.d} ${MONTHS[s.mo - 1]} to ${day(e)}`;
  return `${day(s)} to ${day(e)}`;
}

/** Shorter form for badges and the footer: "16 Nov 2026" */
export function shortWhen(ev) {
  const s = ES.parse(ev.start);
  if (!s) return '';
  if (ES.isTentative(ev)) return `${MONTHS[s.mo - 1].slice(0, 3)} ${s.y}`;
  return `${s.d} ${MONTHS[s.mo - 1].slice(0, 3)} ${s.y}`;
}

/** ISO date used in structured data, e.g. 2026-11-16T10:00:00+05:30 */
export function isoStamp(str, end = false) {
  const p = ES.parse(str);
  if (!p) return undefined;
  if (p.d == null) return `${p.y}-${two(p.mo)}`;
  if (p.h == null) return `${p.y}-${two(p.mo)}-${two(p.d)}`;
  return `${p.y}-${two(p.mo)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}:00+05:30`;
}

/** Google Calendar "add event" link. All-day events use an exclusive end date. */
export function calendarUrl(ev, pageUrl = '') {
  const s = ES.parse(ev.start);
  if (!s || ES.isTentative(ev)) return '';
  const e = ES.parse(ev.end) || s;
  let dates;
  if (s.h != null) {
    const f = (p) => `${p.y}${two(p.mo)}${two(p.d)}T${two(p.h ?? 0)}${two(p.mi)}00`;
    const endP = e.h != null ? e : { ...s, h: Math.min(s.h + 2, 23), mi: s.mi };
    dates = `${f(s)}/${f(endP)}`;
  } else {
    const next = new Date(Date.UTC(e.y, e.mo - 1, e.d + 1));
    const f1 = `${s.y}${two(s.mo)}${two(s.d)}`;
    const f2 = `${next.getUTCFullYear()}${two(next.getUTCMonth() + 1)}${two(next.getUTCDate())}`;
    dates = `${f1}/${f2}`;
  }
  const details = [ev.summary || '', pageUrl].filter(Boolean).join('\n\n');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates, details });
  if (ev.venue) q.set('location', ev.venue);
  if (s.h != null) q.set('ctz', 'Asia/Kolkata');
  return `https://calendar.google.com/calendar/render?${q.toString().replace(/\+/g, '%20')}`;
}

/** "14 November 2026" or "14 November 2026, 6:00 pm IST" for a registration deadline. */
export function deadlineText(str) {
  const p = ES.parse(str);
  if (!p) return '';
  const d = p.d || new Date(Date.UTC(p.y, p.mo, 0)).getUTCDate();
  const base = `${d} ${MONTHS[p.mo - 1]} ${p.y}`;
  return p.h != null ? `${base}, ${clock(p)} IST` : base;
}
