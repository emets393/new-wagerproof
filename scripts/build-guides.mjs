import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  SITE_URL,
  ROOT,
  absoluteUrl,
  escapeHtml,
  formatDate,
  loadEditorialSystem,
  slugify,
} from './lib/guides.mjs'

const DIST_DIR = path.join(ROOT, 'dist')
const CSS_SOURCE = path.join(ROOT, 'src', 'styles', 'guides.css')
const JS_SOURCE = path.join(ROOT, 'src', 'lib', 'guides.js')
const APP_STORE_URL = 'https://apps.apple.com/us/app/wagerproof-sports-research-ai/id6757089957'

const ANALYTICS = `
<!-- Rybbit Analytics -->
<script src="https://app.rybbit.io/api/script.js" data-site-id="e8e280617e67" defer></script>
<!-- Mixpanel Analytics -->
<script data-editorial-script="mixpanel">
(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);var j="set set_once union unset remove delete".split(" ");a.get_group=function(){function b(c){d[c]=function(){var call2_args=arguments;var call2=[c].concat(Array.prototype.slice.call(call2_args,0));a.push([e,call2])}}for(var d={},e=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<j.length;c++)b(j[c]);return d};b._i.push([e,f,c])};b.__SV=1.2;e=f.createElement("script");e.type="text/javascript";e.async=!0;e.src="//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";g=f.getElementsByTagName("script")[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);
mixpanel.init('1346df53bbd034722047aa8a96d5321e',{autocapture:true,record_sessions_percent:100});
</script>
<!-- Meta Pixel -->
<script data-editorial-script="meta-pixel">
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1731090704521232');fbq('track','PageView');
</script>`

const META_NOSCRIPT = `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1731090704521232&amp;ev=PageView&amp;noscript=1" alt="" /></noscript>`

const THEME_BOOTSTRAP = `<script data-editorial-script="theme">(function(){var t=localStorage.getItem('wagerproof-guides-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=t||(d?'dark':'light');})();</script>`

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`
}

function publisherSchema() {
  return {
    '@type': 'Organization',
    name: 'WagerProof',
    legalName: 'WagerProof, LLC',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/guides/brand/wagerproof-app-icon-v1.png`,
      width: 1024,
      height: 1024,
    },
  }
}

function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/guides/#chris-habib`,
    name: 'Chris Habib',
    jobTitle: 'Founder and product lead at WagerProof',
    description: 'Sports analytics product builder writing about sports research, probability, and responsible use of data.',
    url: `${SITE_URL}/guides/`,
    image: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/guides/authors/chris-habib-v1.webp`,
      width: 877,
      height: 875,
    },
    knowsAbout: [
      'Sports analytics product design',
      'Sports research workflows',
      'Probability and odds interpretation',
    ],
    worksFor: {
      '@type': 'Organization',
      name: 'Red Honey',
      url: 'https://redhoney.com',
    },
  }
}

function breadcrumbSchema(guide) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'WagerProof', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides/` },
      { '@type': 'ListItem', position: 3, name: guide.shortTitle, item: absoluteUrl(guide.canonicalPath) },
    ],
  }
}

function articleSchemas(guide) {
  const canonical = absoluteUrl(guide.canonicalPath)
  const article = {
    '@context': 'https://schema.org',
    '@type': guide.layout === 'release' ? 'BlogPosting' : 'Article',
    '@id': `${canonical}#article`,
    headline: guide.title,
    alternativeHeadline: guide.shortTitle,
    description: guide.description,
    image: [
      { '@type': 'ImageObject', url: absoluteUrl(guide.hero.src), width: 1672, height: 941 },
      { '@type': 'ImageObject', url: absoluteUrl(guide.hero.socialSrc), width: 1200, height: 630 },
    ],
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    inLanguage: 'en-US',
    articleSection: guide.category,
    author: { '@id': `${SITE_URL}/guides/#chris-habib` },
    publisher: publisherSchema(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  }
  const schemas = [article, personSchema(), breadcrumbSchema(guide)]
  if (guide.layout === 'feature') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: guide.title,
      numberOfItems: guide.apps.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: guide.apps.map((app) => ({
        '@type': 'ListItem',
        position: app.rank,
        name: app.name,
        url: app.officialUrl,
      })),
    })
  }
  if (guide.faqs?.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: guide.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    })
  }
  if (guide.howTo) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: guide.howTo.name,
      description: guide.howTo.description,
      step: guide.howTo.steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
      })),
    })
  }
  return schemas
}

function head({ title, description, canonicalPath, image, type = 'article', schemas = [], robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' }) {
  const canonical = absoluteUrl(canonicalPath)
  const socialImage = absoluteUrl(image)
  return `<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="${escapeHtml(robots)}" />
<meta name="author" content="Chris Habib" />
<meta name="theme-color" content="#0b1b11" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<link rel="alternate" type="application/rss+xml" title="WagerProof Guides" href="${SITE_URL}/guides/feed.xml" />
<link rel="icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/guides/brand/wagerproof-app-icon-v1.png" />
<link rel="stylesheet" href="/guides/guides-v1.css" />
<meta property="og:site_name" content="WagerProof" />
<meta property="og:locale" content="en_US" />
<meta property="og:type" content="${type}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(socialImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${escapeHtml(canonical)}" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(socialImage)}" />
${THEME_BOOTSTRAP}
${schemas.map(jsonLd).join('\n')}
${ANALYTICS}
<script src="/guides/guides-v1.js" defer data-editorial-script="guides"></script>
</head>`
}

function siteHeader() {
  return `<a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header">
  <div class="site-header__inner">
    <a class="wordmark" href="/" aria-label="WagerProof home">
      <img src="/guides/brand/wagerproof-app-icon-v1.png" width="36" height="36" alt="" />
      <span>Wager<span>Proof</span></span>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <a aria-current="page" href="/guides/">Guides</a>
      <a href="/mcp">Connector</a>
      <a href="/support">Support</a>
      <a class="nav-cta" href="${APP_STORE_URL}">Get the app</a>
    </nav>
    <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch color theme"><span aria-hidden="true">◐</span></button>
  </div>
</header>`
}

function siteFooter() {
  return `<footer class="site-footer">
  <div class="site-footer__top">
    <a class="wordmark wordmark--footer" href="/"><img src="/guides/brand/wagerproof-app-icon-v1.png" width="34" height="34" alt="" /><span>Wager<span>Proof</span></span></a>
    <nav aria-label="Footer"><a href="/guides/all/">All guides</a><a href="/mcp">AI connector</a><a href="/support">Support</a><a href="/privacy-policy">Privacy</a><a href="/terms-and-conditions">Terms</a></nav>
  </div>
  <div class="site-footer__legal">
    <p>WagerProof provides research and information. It does not accept wagers or guarantee outcomes. Must be of legal age in your jurisdiction.</p>
    <p>Need help in the U.S.? Call or text <a href="tel:18006973738">1-800-MY-RESET</a> or visit <a href="https://1800myreset.org/">1800myreset.org</a>.</p>
    <p>© ${new Date().getUTCFullYear()} WagerProof, LLC.</p>
  </div>
</footer>`
}

function documentShell({ headHtml, body, bodyClass = '' }) {
  return `<!doctype html>
<html lang="en" data-editorial-page>
${headHtml}
<body class="${escapeHtml(bodyClass)}">
${META_NOSCRIPT}
${siteHeader()}
${body}
${siteFooter()}
</body>
</html>`
}

function guideCard(guide, className = '') {
  return `<article class="guide-card ${escapeHtml(className)}" data-guide-row data-search="${escapeHtml(`${guide.title} ${guide.dek} ${guide.category}`.toLowerCase())}">
  <a class="guide-card__image" href="${escapeHtml(guide.canonicalPath)}" tabindex="-1" aria-hidden="true">
    <img src="${escapeHtml(guide.hero.src)}" width="1672" height="941" alt="" loading="lazy" decoding="async" />
  </a>
  <div class="guide-card__body">
    <p class="eyebrow">${escapeHtml(guide.category)} <span>·</span> ${escapeHtml(formatDate(guide.updatedAt))}</p>
    <h3><a href="${escapeHtml(guide.canonicalPath)}">${escapeHtml(guide.shortTitle)}</a></h3>
    <p>${escapeHtml(guide.dek)}</p>
  </div>
</article>`
}

function compactRow(guide) {
  return `<article class="guide-row" data-guide-row data-search="${escapeHtml(`${guide.title} ${guide.dek} ${guide.category}`.toLowerCase())}">
  <a class="guide-row__image" href="${escapeHtml(guide.canonicalPath)}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(guide.hero.src)}" width="1672" height="941" alt="" loading="lazy" decoding="async" /></a>
  <div><p class="eyebrow">${escapeHtml(guide.category)} <span>·</span> ${escapeHtml(`${guide.readingTimeMinutes} min`)}</p><h3><a href="${escapeHtml(guide.canonicalPath)}">${escapeHtml(guide.shortTitle)}</a></h3><p>${escapeHtml(guide.dek)}</p></div>
  <time datetime="${escapeHtml(guide.updatedAt)}">${escapeHtml(formatDate(guide.updatedAt))}</time>
</article>`
}

function hubSchemas(guides, canonicalPath, title, description) {
  const itemList = {
    '@type': 'ItemList',
    '@id': `${absoluteUrl(canonicalPath)}#guides`,
    numberOfItems: guides.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: guides.map((guide, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: guide.title,
      url: absoluteUrl(guide.canonicalPath),
    })),
  }
  return [{
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': absoluteUrl(canonicalPath),
        url: absoluteUrl(canonicalPath),
        name: title,
        description,
        inLanguage: 'en-US',
        publisher: publisherSchema(),
        mainEntity: { '@id': itemList['@id'] },
      },
      itemList,
    ],
  }]
}

function renderHub(guides) {
  const featured = guides.find((guide) => guide.featured) || guides[0]
  const title = 'WagerProof Sports Betting Research Guides'
  const description = 'Original guides about sports research apps, odds, line movement, player props, model methodology, tracking, releases, and responsible use.'
  const body = `<main id="main-content">
  <section class="guides-search-band">
    <div class="section-shell">
    <label class="guide-search"><span class="sr-only">Search guides</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.3-4.3m2.3-5.2A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" /></svg><input type="search" placeholder="Search probability, line movement, props…" data-guide-search /></label>
    </div>
  </section>
  <section class="section-shell guide-directory-home" aria-labelledby="find-title">
    <div class="guide-directory-home__heading"><h1 id="find-title">Our Guides</h1><a href="/guides/all/">View all <span aria-hidden="true">→</span></a></div>
    <div class="guide-row-list" data-guide-results>${guides.map(compactRow).join('')}</div>
    <p class="empty-state" hidden data-guide-empty>No guides match that search.</p>
  </section>
  <section class="section-shell guide-index-bars" aria-label="Explore WagerProof">
    <article><img class="guide-index-bars__icon" src="/guides/brand/wagerproof-cta-icon.png" width="1024" height="1024" alt="" loading="lazy" /><div><p class="eyebrow">WagerProof app</p><h2>Research without the busywork.</h2><p>Build AI agents, test historical Systems, compare lines, and inspect transparent win records in one place.</p></div><a class="button" href="${APP_STORE_URL}">Get the app</a></article>
    <article><div><p class="eyebrow">AI connector</p><h2>Bring the data to your AI.</h2><p>Use WagerProof MCPs with your preferred AI to explore the data and build your own research systems.</p></div><a class="button button--secondary" href="/mcp">View MCPs</a></article>
  </section>
</main>`
  return documentShell({
    headHtml: head({ title, description, canonicalPath: '/guides/', image: featured.hero.socialSrc, type: 'website', schemas: hubSchemas(guides, '/guides/', title, description) }),
    body,
    bodyClass: 'guides-hub',
  })
}

function renderAllGuides(guides) {
  const title = 'All WagerProof Guides'
  const description = 'Browse every maintained WagerProof guide by topic, including odds fundamentals, market research, methodology, player props, performance, releases, and responsible use.'
  const categories = [...new Set(guides.map((guide) => guide.category))]
  const body = `<main id="main-content" class="all-guides section-shell">
  <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/guides/">Guides</a><span aria-hidden="true">/</span><span>All guides</span></nav>
  <header class="directory-header"><p class="eyebrow">Complete editorial index</p><h1>All WagerProof Guides</h1><p>Ten maintained references, each with a human author, visible sources, deliberate imagery, and a scheduled review.</p></header>
  <label class="guide-search guide-search--directory"><span class="sr-only">Search all guides</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.3-4.3m2.3-5.2A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" /></svg><input type="search" placeholder="Search all guides…" data-guide-search /></label>
  <nav class="topic-nav" aria-label="Jump to topic">${categories.map((category) => `<a href="#${slugify(category)}">${escapeHtml(category)}</a>`).join('')}</nav>
  <div data-guide-results>${categories.map((category) => `<section class="directory-group" id="${slugify(category)}"><div class="directory-group__heading"><h2>${escapeHtml(category)}</h2><span>${guides.filter((guide) => guide.category === category).length}</span></div><div class="directory-grid">${guides.filter((guide) => guide.category === category).map((guide) => guideCard(guide)).join('')}</div></section>`).join('')}</div>
  <p class="empty-state" hidden data-guide-empty>No guides match that search.</p>
  </main>`
  return documentShell({
    headHtml: head({ title: `${title} | WagerProof`, description, canonicalPath: '/guides/all/', image: guides[0].hero.socialSrc, type: 'website', schemas: hubSchemas(guides, '/guides/all/', title, description) }),
    body,
    bodyClass: 'guides-directory',
  })
}

function tableOfContents(guide) {
  const extra = []
  if (guide.layout === 'feature') extra.push({ id: 'ranked-reviews', label: 'Ranked app reviews' })
  if (guide.layout === 'release') extra.push({ id: 'what-shipped', label: 'What shipped' }, { id: 'release-screens', label: 'Product screens' })
  if (guide.howTo) extra.push({ id: 'step-by-step', label: guide.howTo.name })
  if (guide.faqs?.length) extra.push({ id: 'frequently-asked-questions', label: 'Frequently asked questions' })
  if (guide.layout !== 'feature' && guide.showSourcesSection !== false) extra.push({ id: 'sources', label: 'Sources' })
  const headings = [...guide.headings, ...extra]
  return `<aside class="article-toc" aria-label="On this page"><p>On this page</p><ol>${headings.map((heading) => `<li><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.label)}</a></li>`).join('')}</ol></aside>`
}

function articleHeader(guide) {
  const status = guide.layout === 'release' ? `Released ${formatDate(guide.release.releaseDate)}` : `Reviewed ${formatDate(guide.reviewedAt)}`
  return `<header class="article-header section-shell">
  <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/guides/">Guides</a><span aria-hidden="true">/</span><span>${escapeHtml(guide.category)}</span></nav>
  <p class="eyebrow">${escapeHtml(guide.category)} <span>·</span> ${escapeHtml(status)}</p>
  <h1>${escapeHtml(guide.title)}</h1>
  <p class="article-dek">${escapeHtml(guide.dek)}</p>
  <div class="byline">
    <img src="/guides/authors/chris-habib-v1.webp" width="52" height="52" alt="Chris Habib" />
    <div><p>By <strong>Chris Habib</strong></p><p>Founder and product lead at WagerProof</p></div>
    <dl><div><dt>Updated</dt><dd><time datetime="${escapeHtml(guide.updatedAt)}">${escapeHtml(formatDate(guide.updatedAt))}</time></dd></div>${guide.lastTestedAt ? `<div><dt>Last tested</dt><dd><time datetime="${escapeHtml(guide.lastTestedAt)}">${escapeHtml(formatDate(guide.lastTestedAt))}</time></dd></div>` : ''}<div><dt>Read</dt><dd>${escapeHtml(`${guide.readingTimeMinutes} minutes`)}</dd></div></dl>
  </div>
  </header>
  <figure class="article-hero section-shell"><img src="${escapeHtml(guide.hero.src)}" width="1672" height="941" alt="${escapeHtml(guide.hero.alt)}" fetchpriority="high" decoding="async" /><figcaption>${escapeHtml(guide.hero.caption)} <span>Source: ${escapeHtml(guide.hero.source)}.</span></figcaption></figure>`
}

function disclosure(guide) {
  const label = guide.layout === 'feature' ? 'Our conflict of interest' : 'How to read this page'
  return `<aside class="disclosure" aria-label="Editorial disclosure"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 7.2v5.6c0 4.5 3.9 7.1 9.2 8.2 5.3-1.1 9.2-3.7 9.2-8.2V7.2L12 3Zm0 5.2v5.2m0 3.2h.01" /></svg><div><strong>${label}</strong><p>${escapeHtml(guide.disclosure)}</p></div></aside>`
}

function bottomLine(guide) {
  const title = guide.bottomLineTitle || (guide.slug === 'best-sports-betting-research-apps'
    ? 'WagerProof is our best overall pick.'
    : 'A useful result keeps its limits attached.')
  return `<section class="bottom-line" aria-labelledby="bottom-line-title"><p class="eyebrow">The bottom line</p><h2 id="bottom-line-title">${title}</h2><p>${escapeHtml(guide.verdict)}</p></section>`
}

function renderComparison(guide) {
  const reviewYear = guide.reviewedAt.slice(0, 4)
  const sourceMap = new Map(guide.sources.map((source) => [source.url, source]))
  const reviews = guide.apps.map((app) => {
    const appId = `app-${slugify(app.name)}`
    const highlights = app.review.highlights?.length
      ? `<section class="app-review__highlights" aria-labelledby="${appId}-highlights"><h4 id="${appId}-highlights">Where it shines</h4><ul>${app.review.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join('')}</ul></section>`
      : ''
    const sourceLinks = app.review.sourceUrls.map((url) => {
      const source = sourceMap.get(url)
      return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`
    }).join(', ')
    const sourceLabel = app.review.sourceUrls.length === 1 ? 'Official source' : 'Official sources'
    return `<article class="app-review" data-app-name="${escapeHtml(app.name)}"><header><span class="app-review__rank">${app.rank}</span><img src="${escapeHtml(app.icon)}" width="64" height="64" alt="${escapeHtml(`${app.name} app icon`)}" /><div><p>${escapeHtml(app.categoryLabel)}</p><h3 id="${appId}">${escapeHtml(app.name)}</h3></div></header><div class="app-review__copy">${app.review.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>${highlights}<div class="app-review__decision"><p><strong>Choose it for:</strong> ${escapeHtml(app.review.chooseItFor)}</p><p><strong>Think twice because:</strong> ${escapeHtml(app.review.thinkTwiceBecause)}</p></div><p class="app-review__meta"><strong>Platforms:</strong> ${escapeHtml(app.platforms)}<br /><strong>Price checked ${escapeHtml(formatDate(app.priceAsOf))}:</strong> ${escapeHtml(app.price)}</p><p class="app-review__sources"><strong>${sourceLabel}:</strong> ${sourceLinks}</p></article>`
  }).join('')
  return `<section class="comparison" aria-labelledby="comparison-title">
  <div class="section-heading section-heading--article"><div><p class="eyebrow">Snapshot date: August 26, 2026</p><h2 id="comparison-title">Picks at a glance</h2></div><p>U.S. public prices before tax. Verify checkout.</p></div>
  <div class="table-scroll" tabindex="0" aria-label="Sports research app comparison table"><table><thead><tr><th>Rank</th><th>App</th><th>Best for</th><th>Public price snapshot</th><th>Platforms</th></tr></thead><tbody>${guide.apps.map((app) => `<tr><td><span class="rank-pill">${app.rank}</span></td><td><span class="table-app"><img src="${escapeHtml(app.icon)}" width="42" height="42" alt="" />${escapeHtml(app.name)}</span></td><td>${escapeHtml(app.categoryLabel.replace(/^Best for /, ''))}</td><td>${escapeHtml(app.price)}</td><td>${escapeHtml(app.platforms)}</td></tr>`).join('')}</tbody></table></div>
  <div class="ranked-reviews" id="ranked-reviews"><div class="ranked-reviews__heading"><p class="eyebrow">Full reviews</p><h2>The ${guide.apps.length} best sports betting research apps in ${escapeHtml(reviewYear)}</h2><p>Official product sources are grouped at the end of each review.</p></div>${reviews}</div>
  </section>`
}

function renderRelease(guide) {
  return `<section class="release-panel" id="what-shipped" aria-labelledby="release-title"><div><p class="eyebrow">Version</p><strong>${escapeHtml(guide.release.version)}</strong></div><div><p class="eyebrow">Released</p><strong>${escapeHtml(formatDate(guide.release.releaseDate))}</strong></div><div><p class="eyebrow">Platforms</p><strong>${escapeHtml(guide.release.platforms.join(', '))}</strong></div></section>
  <section class="release-changes" aria-labelledby="release-title"><p class="eyebrow">Changelog</p><h2 id="release-title">What shipped</h2><ol>${guide.release.changes.map((change) => `<li>${escapeHtml(change)}</li>`).join('')}</ol></section>
  <section class="release-screens" id="release-screens" aria-labelledby="screens-title"><div class="section-heading section-heading--article"><div><p class="eyebrow">Real product interface</p><h2 id="screens-title">Screens from WagerProof</h2></div></div><div>${guide.release.screenshots.map((shot) => `<figure><img src="${escapeHtml(shot.src)}" width="${shot.width}" height="${shot.height}" alt="${escapeHtml(shot.alt)}" loading="lazy" decoding="async" /><figcaption>${escapeHtml(shot.caption)}</figcaption></figure>`).join('')}</div></section>`
}

function renderHowTo(guide) {
  if (!guide.howTo) return ''
  return `<section class="how-to" id="step-by-step" aria-labelledby="how-to-title"><p class="eyebrow">Repeatable method</p><h2 id="how-to-title">${escapeHtml(guide.howTo.name)}</h2><p>${escapeHtml(guide.howTo.description)}</p><ol>${guide.howTo.steps.map((step, index) => `<li><span>${index + 1}</span><div><h3>${escapeHtml(step.name)}</h3><p>${escapeHtml(step.text)}</p></div></li>`).join('')}</ol></section>`
}

function renderFaqs(guide) {
  if (!guide.faqs?.length) return ''
  return `<section class="article-section faqs" id="frequently-asked-questions" aria-labelledby="faq-title"><p class="eyebrow">Plain answers</p><h2 id="faq-title">Frequently asked questions</h2><div>${guide.faqs.map((faq) => `<details><summary>${escapeHtml(faq.question)}<span aria-hidden="true">+</span></summary><p data-faq-answer>${escapeHtml(faq.answer)}</p></details>`).join('')}</div></section>`
}

function renderSources(guide) {
  return `<section class="article-section sources" id="sources" aria-labelledby="sources-title"><p class="eyebrow">Evidence ledger</p><h2 id="sources-title">Sources</h2><p>Sources were opened on the listed date. Product features, prices, platform coverage, fees, and help information can change.</p><ol>${guide.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noopener noreferrer">${escapeHtml(source.title)}</a><span>${escapeHtml(source.publisher)} · Accessed ${escapeHtml(formatDate(source.accessedAt))}</span><p>${escapeHtml(source.usedFor)}</p></li>`).join('')}</ol></section>`
}

function authorCard() {
  return `<section class="author-card" aria-labelledby="author-title"><img src="/guides/authors/chris-habib-v1.webp" width="96" height="96" alt="Chris Habib" /><div><p class="eyebrow">About the author</p><h2 id="author-title">Chris Habib</h2><p>Chris builds WagerProof and writes practical guides about sports research, product methodology, and responsible use of betting data. He focuses on inspectable workflows rather than outcome promises.</p><p class="author-card__meta">Expertise: sports analytics product design, probability and odds interpretation, research workflows.</p></div></section>`
}

function articleCta(guide) {
  const responsible = guide.slug === 'responsible-sports-betting-research'
  const comparison = guide.slug === 'best-sports-betting-research-apps'
  const eyebrow = guide.cta?.eyebrow || (responsible ? 'Keep the boundary visible' : comparison ? 'Build your research desk' : 'Research inside WagerProof')
  const title = guide.cta?.title || (responsible ? 'If the process feels hard to stop, stop the process.' : comparison ? 'Put your agents, Systems, records, and AI in one place.' : 'Put the model, market, and record on the same screen.')
  const copy = guide.cta?.copy || (responsible ? 'Free, confidential U.S. support is available at any time. Limits and time-outs are valid research decisions.' : comparison ? 'Start with a free agent, inspect the public records, and see how WagerProof fits the way you already research.' : 'WagerProof organizes model probabilities, current lines, agents, trends, and graded records. It does not guarantee an outcome.')
  const buttonLabel = guide.cta?.buttonLabel || (responsible ? 'Visit MY-RESET' : comparison ? 'Try WagerProof' : 'View WagerProof')
  return `<section class="article-cta"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><a class="button" href="${responsible ? 'https://1800myreset.org/' : APP_STORE_URL}">${escapeHtml(buttonLabel)}</a></section>`
}

function readMore(guide, guideMap) {
  const related = guide.relatedSlugs.map((slug) => guideMap.get(slug))
  return `<section class="read-more section-shell" aria-labelledby="read-more-title"><div class="section-heading"><div><p class="eyebrow">Continue the thread</p><h2 id="read-more-title">Read more</h2></div></div><div class="read-more__grid">${related.map((item) => guideCard(item)).join('')}</div></section>`
}

function renderArticle(guide, guideMap) {
  const sourcesSection = guide.layout !== 'feature' && guide.showSourcesSection !== false ? renderSources(guide) : ''
  const bodyContent = `${bottomLine(guide)}${guide.contentHtml}${guide.layout === 'feature' ? renderComparison(guide) : ''}${guide.layout === 'release' ? renderRelease(guide) : ''}${renderHowTo(guide)}${renderFaqs(guide)}${sourcesSection}${authorCard()}${articleCta(guide)}<p class="corrections">Have a correction or a newer first-party source? <a href="mailto:support@wagerproof.bet?subject=${encodeURIComponent(`Guide correction: ${guide.shortTitle}`)}">Email the editorial team</a>.</p>`
  const body = `<main id="main-content" class="article-page">
  ${articleHeader(guide)}
  <div class="article-layout section-shell">${tableOfContents(guide)}<article class="article-body">${disclosure(guide)}${bodyContent}</article></div>
  ${readMore(guide, guideMap)}
  </main>`
  return documentShell({
    headHtml: head({
      title: `${guide.seoTitle} | WagerProof`,
      description: guide.description,
      canonicalPath: guide.canonicalPath,
      image: guide.hero.socialSrc,
      type: 'article',
      schemas: articleSchemas(guide),
    }),
    body,
    bodyClass: `guide-article layout-${guide.layout}`,
  })
}

function render404(featuredImage) {
  const title = 'Guide not found | WagerProof'
  const description = 'The WagerProof editorial page you requested does not exist or has been retired.'
  const body = `<main id="main-content" class="not-found section-shell"><p class="eyebrow">404 · Editorial route</p><h1>This guide is not here.</h1><p>The page may have been retired because it no longer had a useful, supportable answer. Unrelated old articles are not redirected to the Guides hub just to preserve a status code.</p><div><a class="button" href="/guides/">Go to Guides</a><a class="text-link" href="/guides/all/">Browse the complete index <span aria-hidden="true">→</span></a></div></main>`
  return documentShell({
    headHtml: head({ title, description, canonicalPath: '/404.html', image: featuredImage, type: 'website', schemas: [], robots: 'noindex,follow' }),
    body,
    bodyClass: 'editorial-404',
  })
}

async function writeRoute(route, html) {
  const output = path.join(DIST_DIR, route.replace(/^\//, ''), 'index.html')
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, html)
}

function redirectLines(migration) {
  const lines = []
  const seen = new Set()
  const add = (from, to, status) => {
    const key = `${from}\t${to}\t${status}`
    if (seen.has(key)) return
    seen.add(key)
    lines.push(`${from}  ${to}  ${status}`)
  }
  add('https://www.wagerproof.bet/*', 'https://wagerproof.bet/:splat', '301!')
  add('/blog', '/guides/', '301!')
  add('/blog/', '/guides/', '301!')
  add('/feed.xml', '/guides/feed.xml', '301!')
  add('/rss.xml', '/guides/feed.xml', '301!')
  for (const entry of migration.entries) {
    const source = entry.sourcePath.replace(/\/$/, '')
    const recommendation = entry.recommendation
    if (recommendation.disposition === 'move_301') {
      add(source, recommendation.targetPath, '301!')
      add(`${source}/`, recommendation.targetPath, '301!')
    } else if (recommendation.disposition === 'retire_404') {
      add(source, '/404.html', '404')
      add(`${source}/`, '/404.html', '404')
    }
  }
  add('/guides/*', '/404.html', '404')
  add('/blog/*', '/404.html', '404')
  add('/*', '/index.html', '200')
  return `${lines.join('\n')}\n`
}

async function main() {
  const { guides, guideMap, migration } = await loadEditorialSystem()
  await fs.mkdir(path.join(DIST_DIR, 'guides'), { recursive: true })
  await Promise.all([
    fs.copyFile(CSS_SOURCE, path.join(DIST_DIR, 'guides', 'guides-v1.css')),
    fs.copyFile(JS_SOURCE, path.join(DIST_DIR, 'guides', 'guides-v1.js')),
  ])
  await writeRoute('/guides/', renderHub(guides))
  await writeRoute('/guides/all/', renderAllGuides(guides))
  for (const guide of guides) await writeRoute(guide.canonicalPath, renderArticle(guide, guideMap))
  await fs.writeFile(path.join(DIST_DIR, '404.html'), render404(guides[0].hero.socialSrc))
  await fs.writeFile(path.join(DIST_DIR, '_redirects'), redirectLines(migration))
  console.log(`Generated ${guides.length} static editorial articles, 2 directories, a 404, and ${migration.entries.length} audited URL dispositions.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
