# Shubhkant Foundation website

A multi-page site for Vercel. Each event is a button; opening it shows the **registration page** while the event is
upcoming, and **photographs plus a written summary** once it has taken place. It switches by itself on the event date.

Pages: Home, About, Events, one page per event, Blogs, Gallery, Press coverage, Partner with us, Join the team, Add an event (for organisers).

## 1. Put it on Vercel (once)

1. Create a GitHub repository and upload this folder's contents.
2. On vercel.com: **Add New > Project**, pick the repository, leave every setting as it is (it reads `vercel.json`), **Deploy**.
3. Open **Settings > Domains** to add your own domain.
4. Fill in `data/site.json`: `"url"` (your final web address, for share previews) and the `"contact"` details.

Every time you commit a change on GitHub, Vercel rebuilds the site in about a minute.

## 2. Turn on registrations (once)

Registrations are saved to a Google Sheet. Follow the steps at the top of `docs/registrations-google-sheet.gs`
(about 5 minutes). You end up with one Vercel setting: `REGISTRATION_WEBHOOK_URL`. Until it is set, the form
tells people registration is not available yet; it never pretends to save.

Prefer your own Google Form? In `data/events.json` set that event's `"registration"` to
`{ "mode": "external", "url": "https://forms.gle/..." }`.

## 3. Add or update an event

Easiest: open `/add-event` on your site, fill in the form, copy the result, and paste it over `data/events.json`
on GitHub (pencil icon, then Commit). To do it by hand, copy an entry in `data/events.json`; `docs/events.example.json`
explains every field.

- **Upcoming event:** it shows the registration page. Close registration with `"open": false` or a `"deadline": "2026-11-14"`.
- **After the event:** nothing is needed for it to show as Completed. Open `/add-event`, choose the event, write the
  summary, copy the result into `data/events.json`, and upload photographs to `static/photos/events/<event-slug>/`.
- Dates are India time. `"start": "2026-11-16T10:00"` adds a time; `"start": "2027-01"` with `"dateTentative": true` is a month only.

## 4. Photographs

Upload to the folders listed in `static/photos/README.md`. Large phone photos are fine; they are resized when the site
builds. Photo spaces stay blank until a file is added.

## 5. Look at it on your computer (optional)

    npm install
    npm run dev           # http://localhost:3000
    npm run dev:sample    # adds a sample completed event so you can see a recap
    npm test

## Notes
- Contact details show in the footer and the Partner page once filled in `data/site.json`.
- The site sends a strict Content-Security-Policy (see `vercel.json`). If you add an embed (for example a YouTube video or a Google Form iframe), add its address to `frame-src`/`script-src` there.
- Registration data lives only in your Google Sheet. The site stores nothing.


## 6. Blogs and announcements

Add or update editorial content in `data/blogs.json`. Each entry becomes a page at
`/blogs/<slug>` and appears in the `/blogs` index. Supported content blocks include
paragraphs, quotations, lists and signatures. Featured images use paths under `static/`.

## 7. Press coverage and event media

Press clippings and press-gallery images are stored in `static/press/`. Event photographs
belong in `static/photos/events/<event-slug>/`; a `cover.*` file is used as the event card
and recap cover. The supplied Navnirman video is stored under `static/video/`.

## 8. Navnirman Youth Parliament 2.0

The second-edition details and external registration URL are stored in `data/events.json`.
Update the same event entry when the exact date, venue or registration status changes.


## 9. Original source materials

Original supplied article, newspaper clippings, event photographs and video are retained in
`docs/source-materials/`. Optimised copies used by the public website live under `static/`.

See `docs/website-handover.md` for the Foundation-side account, domain and access checklist.
