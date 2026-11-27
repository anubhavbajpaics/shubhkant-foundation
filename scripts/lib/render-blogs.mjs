import { esc } from './util.mjs';

const dateMarkup = (blog) => `<time datetime="${esc(blog.date)}">${esc(blog.dateLabel || blog.date)}</time>`;

export function blogCard(blog, compact = false) {
  const image = blog.featuredImage
    ? `<img src="${esc(blog.featuredImage)}" alt="${esc(blog.featuredAlt || '')}" loading="lazy" decoding="async">`
    : '';
  return `<article class="blog-card${compact ? ' blog-card--compact' : ''}">
    <a class="blog-card__image" href="/blogs/${esc(blog.slug)}" aria-label="Read ${esc(blog.title)}">${image}</a>
    <div class="blog-card__body">
      <p class="blog-card__category">${esc(blog.category || 'From the Foundation')}</p>
      <p class="blog-card__date">${dateMarkup(blog)}</p>
      <h2><a href="/blogs/${esc(blog.slug)}">${esc(blog.title)}</a></h2>
      <p>${esc(blog.excerpt || '')}</p>
      <p class="blog-card__by">By ${esc(blog.author || 'Shubhkant Foundation')}${blog.designation ? ` · ${esc(blog.designation)}` : ''}</p>
      <a class="link" href="/blogs/${esc(blog.slug)}">Read article <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

export function blogsList(ctx) {
  const items = [...(ctx.blogs || [])].sort((a, b) => b.date.localeCompare(a.date));
  return items.map((blog) => blogCard(blog)).join('\n');
}

export function featuredBlogs(ctx) {
  const items = [...(ctx.blogs || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  return items.map((blog) => blogCard(blog, true)).join('\n');
}

function contentBlock(block) {
  if (block.type === 'paragraph') return `<p>${esc(block.text)}</p>`;
  if (block.type === 'quote') return `<blockquote><p>${esc(block.text)}</p>${block.attribution ? `<cite>${esc(block.attribution)}</cite>` : ''}</blockquote>`;
  if (block.type === 'list') return `<ul>${(block.items || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
  if (block.type === 'signature') return `<div class="article-signature"><strong>${esc(block.author || '')}</strong>${block.label ? `<span>${esc(block.label)}</span>` : ''}</div>`;
  return '';
}

export function blogPageBody(ctx, blog) {
  const image = blog.featuredImage
    ? `<figure class="article__feature"><img src="${esc(blog.featuredImage)}" alt="${esc(blog.featuredAlt || '')}" loading="eager" decoding="async"></figure>`
    : '';
  const pdf = blog.pdf
    ? `<p class="article__source"><a class="btn btn--ghost btn--small" href="${esc(blog.pdf)}" target="_blank" rel="noopener noreferrer">View original PDF <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></p>`
    : '';
  const cta = blog.ctaUrl
    ? `<aside class="nab-cta" aria-labelledby="article-cta-title">
        <div><p class="eyebrow">Navnirman-e-Bharat 2.0</p><h2 id="article-cta-title">Take part in the second edition</h2><p>${esc(blog.ctaDescription || 'Register using the official form.')}</p></div>
        <a class="btn" href="${esc(blog.ctaUrl)}" target="_blank" rel="noopener noreferrer">${esc(blog.ctaLabel || 'Register now')} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>
      </aside>`
    : '';
  const related = (ctx.blogs || []).filter((item) => item.slug !== blog.slug).slice(0, 2);
  const relatedHtml = related.length
    ? `<section class="related" aria-labelledby="related-title"><div class="sec-head"><h2 id="related-title">More from the Foundation</h2></div><div class="blog-grid">${related.map((item) => blogCard(item, true)).join('')}</div></section>`
    : '';
  return `<section class="band article-band">
    <div class="wrap article-layout">
      <article class="article" itemscope itemtype="https://schema.org/BlogPosting">
        <meta itemprop="headline" content="${esc(blog.title)}">
        <meta itemprop="datePublished" content="${esc(blog.date)}">
        <meta itemprop="author" content="${esc(blog.author || 'Shubhkant Foundation')}">
        <div class="article__meta">
          <span class="article__category">${esc(blog.category || 'From the Foundation')}</span>
          ${dateMarkup(blog)}
        </div>
        <div class="article__byline"><strong>${esc(blog.author || 'Shubhkant Foundation')}</strong>${blog.designation ? `<span>${esc(blog.designation)}</span>` : ''}</div>
        ${image}
        <div class="article__prose" itemprop="articleBody">
          ${(blog.content || []).map(contentBlock).join('\n')}
        </div>
        ${pdf}
        ${cta}
      </article>
    </div>
  </section>${relatedHtml}`;
}

export function navnirmanCta(ctx) {
  const ev = (ctx.events || []).find((item) => item.slug === 'navnirman-youth-parliament-2');
  const reg = ev?.registration || {};
  if (!reg.url) return '';
  return `<a class="btn" href="${esc(reg.url)}" target="_blank" rel="noopener noreferrer">${esc(reg.cta || 'REGISTER FOR NAVNIRMAN 2.0')} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`;
}
