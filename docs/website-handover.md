# Website access and handover checklist

This document describes the access that the Foundation should control. No account ownership,
passwords, registrar settings or third-party permissions are changed by editing this repository.

## Accounts the Foundation should own

1. **GitHub repository** — the repository should belong to a Foundation-controlled GitHub
   organisation or account. Add developers as collaborators with the least access needed.
2. **Vercel project** — keep the project in a Foundation-controlled Vercel team. Invite
   administrators from the Vercel project/team settings. Confirm that the GitHub repository
   connected to Vercel is the Foundation-owned repository.
3. **Domain registrar** — register any future domain using a Foundation-controlled email
   and billing profile. Keep renewal notices and recovery methods under Foundation control.
4. **Google Forms and Drive** — the registration form and event media should be owned by, or
   shared with, an official Foundation Google account. Check that public-facing form access
   is intentional before announcing it.
5. **Social media** — add only verified official profile URLs in `data/site.json`. The
   current project does not contain verified social profile URLs, so no account audit or
   publishing access has been assumed.

## Connecting a custom domain

The site can run on its Vercel-provided `*.vercel.app` address before a custom domain is
purchased. A custom domain is optional, but gives the Foundation a stable branded address.

After the Foundation chooses and registers a domain:

1. Open the Vercel project and add the domain under **Settings → Domains**.
2. Follow the exact DNS records Vercel displays at the registrar.
3. Wait for Vercel to verify the records and issue HTTPS.
4. Choose the preferred `www` or apex hostname and configure the redirect in Vercel.
5. Set `url` in `data/site.json` to the final HTTPS origin, without a trailing slash.
6. Redeploy and check canonical URLs, Open Graph image URLs and the generated sitemap.

Do not place registrar credentials, access tokens, passwords or one-time codes in this
repository.

## Updating website content

- Events and registration destinations: `data/events.json`.
- Blogs and announcements: `data/blogs.json`.
- Press clippings and video: `static/press/` and `static/video/`.
- Event photos: `static/photos/events/<event-slug>/`.
- General site details and official social links: `data/site.json`.

Use `npm test` and `npm run build` before deploying changes. Vercel can deploy from the
connected GitHub repository after an authorised team member pushes the approved changes.

## Items still requiring Foundation-side action

- Confirm the official GitHub owner and Vercel team.
- Confirm the Foundation administrator email(s) to invite.
- Decide whether and when to purchase a custom domain.
- Confirm ownership/sharing settings for the Google Form and media Drive.
- Supply verified social profile URLs before adding them to the footer.
