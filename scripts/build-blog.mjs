import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables
const SITE_URL = process.env.SITE_URL || 'https://wagerproof.bet';
const GHOST_URL = process.env.GHOST_URL || '';
const GHOST_CONTENT_KEY = process.env.GHOST_CONTENT_KEY || '';

// Helper to join URLs properly
function urlJoin(...parts) {
  return parts
    .map((part, index) => {
      if (index === 0) {
        return part.trim().replace(/[\/]*$/g, '');
      } else {
        return part.trim().replace(/(^[\/]*|[\/]*$)/g, '');
      }
    })
    .filter(x => x.length)
    .join('/');
}

// Fetch all published posts from Ghost
async function fetchAllPosts() {
  if (!GHOST_URL || !GHOST_CONTENT_KEY) {
    console.log('⚠️  Ghost credentials not configured. Skipping blog build.');
    return [];
  }

  try {
    const url = new URL('/ghost/api/content/posts/', GHOST_URL);
    url.searchParams.set('key', GHOST_CONTENT_KEY);
    url.searchParams.set('limit', 'all');
    url.searchParams.set('include', 'authors,tags');
    url.searchParams.set('formats', 'html,plaintext');
    
    console.log(`📡 Fetching posts from Ghost: ${GHOST_URL}`);
    
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' }
    });
    
    if (!res.ok) {
      throw new Error(`Ghost API returned ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    const posts = data.posts || [];
    
    console.log(`✅ Fetched ${posts.length} posts from Ghost\n`);
    return posts;
  } catch (error) {
    console.error('❌ Error fetching Ghost posts:', error.message);
    console.log('⚠️  Continuing without blog posts...\n');
    return [];
  }
}

// Sanitize and process HTML content
function toContentHtml(post) {
  let content = post.html || '';
  
  // If no HTML but we have plaintext, convert markdown to HTML
  if (!content && post.plaintext) {
    content = marked.parse(post.plaintext);
  }
  
  // Sanitize HTML to prevent XSS
  const sanitized = sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'iframe']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen'],
      a: ['href', 'name', 'target', 'rel'],
      '*': ['class', 'id']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
  
  return sanitized;
}

// Escape HTML for safe insertion in HTML attributes
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Render full HTML for a blog post with complete SEO
function renderPostHtml({ 
  title, 
  description, 
  canonicalUrl, 
  ogImage, 
  featureImage,
  contentHtml, 
  publishedAt, 
  updatedAt, 
  cssBundlePath,
  authorName,
  tags = []
}) {
  const defaultImage = `${SITE_URL}/wagerproof-landing.png`;
  const image = ogImage || defaultImage;
  const fullTitle = title.includes('WagerProof') ? title : `${title} | WagerProof`;
  const publishedIso = new Date(publishedAt).toISOString();
  const modifiedIso = updatedAt ? new Date(updatedAt).toISOString() : publishedIso;
  
  // Create JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description,
    image: Array.isArray(ogImage) ? ogImage : (ogImage ? [ogImage] : [defaultImage]),
    datePublished: publishedIso,
    dateModified: modifiedIso,
    author: {
      '@type': 'Person',
      name: authorName || 'WagerProof Team'
    },
    publisher: {
      '@type': 'Organization',
      name: 'WagerProof',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/wagerproofGreenLight.png`
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    }
  };
  
  // Escape JSON-LD for safe insertion in script tag
  const jsonLdString = JSON.stringify(jsonLd, null, 0)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  
  const tagsMetaTags = tags.map(tag => 
    `    <meta property="article:tag" content="${escapeHtml(tag.name)}" />`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="ssg-generated" content="true" />
  
  <!-- Basic Meta -->
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonicalUrl}" />
  
  <!-- Robots -->
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(fullTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:site_name" content="WagerProof" />
  <meta property="og:locale" content="en_US" />
  
  <!-- Article Meta -->
  <meta property="article:published_time" content="${publishedIso}" />
  <meta property="article:modified_time" content="${modifiedIso}" />
  <meta property="article:author" content="${escapeHtml(authorName || 'WagerProof Team')}" />
${tagsMetaTags}
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${canonicalUrl}" />
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:site" content="@wagerproof" />
  
  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${jsonLdString}</script>
  
  <!-- Styles -->
  ${cssBundlePath ? `<link rel="stylesheet" href="${cssBundlePath}" />` : ''}
  <style>
    /* Enhanced styles matching React component - maintains SEO while looking great */
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: hsl(0, 0%, 9%);
      background-color: hsl(0, 0%, 100%);
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 896px;
      margin: 0 auto;
      padding: 3rem 1rem;
    }
    /* Header styles */
    header {
      margin-bottom: 2rem;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      background-color: hsl(142, 76%, 36%, 0.1);
      color: hsl(142, 76%, 36%);
      border-radius: 9999px;
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 1rem;
      color: hsl(0, 0%, 9%);
    }
    @media (min-width: 768px) {
      h1 {
        font-size: 3rem;
      }
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
      font-size: 0.875rem;
      color: hsl(0, 0%, 45%);
      margin-top: 1rem;
    }
    .meta span {
      font-weight: 500;
    }
    /* Prose styles - matches Tailwind typography plugin */
    .prose {
      color: hsl(0, 0%, 9%);
      max-width: 100%;
      font-size: 1.125rem;
      line-height: 1.75;
    }
    .prose p {
      margin-top: 1.25em;
      margin-bottom: 1.25em;
    }
    .prose h2 {
      font-size: 1.875rem;
      font-weight: 700;
      margin-top: 2em;
      margin-bottom: 1em;
      line-height: 1.3;
      color: hsl(0, 0%, 9%);
    }
    .prose h3 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.75em;
      line-height: 1.4;
      color: hsl(0, 0%, 9%);
    }
    .prose h4 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.25em;
      margin-bottom: 0.5em;
      color: hsl(0, 0%, 9%);
    }
    .prose a {
      color: hsl(142, 76%, 36%);
      text-decoration: none;
      font-weight: 500;
    }
    .prose a:hover {
      text-decoration: underline;
    }
    .prose strong {
      font-weight: 600;
      color: hsl(0, 0%, 9%);
    }
    .prose ul, .prose ol {
      margin-top: 1.25em;
      margin-bottom: 1.25em;
      padding-left: 1.625em;
    }
    .prose li {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
    }
    .prose blockquote {
      font-weight: 500;
      font-style: italic;
      color: hsl(0, 0%, 40%);
      border-left: 0.25rem solid hsl(0, 0%, 80%);
      quotes: "\\201C""\\201D""\\2018""\\2019";
      margin-top: 1.6em;
      margin-bottom: 1.6em;
      padding-left: 1em;
    }
    .prose img {
      margin-top: 2em;
      margin-bottom: 2em;
      border-radius: 0.5rem;
      max-width: 100%;
      height: auto;
    }
    .prose code {
      background-color: hsl(0, 0%, 96%);
      color: hsl(0, 0%, 9%);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
      font-weight: 400;
    }
    .prose pre {
      background-color: hsl(0, 0%, 96%);
      color: hsl(0, 0%, 9%);
      overflow-x: auto;
      font-weight: 400;
      font-size: 0.875em;
      line-height: 1.7142857;
      margin-top: 1.7142857em;
      margin-bottom: 1.7142857em;
      border-radius: 0.375rem;
      padding: 0.8571429em 1.1428571em;
    }
    .prose pre code {
      background-color: transparent;
      border-width: 0;
      border-radius: 0;
      padding: 0;
      font-weight: inherit;
      color: inherit;
      font-size: inherit;
      font-family: inherit;
      line-height: inherit;
    }
    .prose hr {
      border-color: hsl(0, 0%, 90%);
      border-top-width: 1px;
      margin-top: 3em;
      margin-bottom: 3em;
    }
    /* Back link */
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: hsl(0, 0%, 45%);
      text-decoration: none;
      margin-bottom: 2rem;
      transition: color 0.2s;
    }
    .back-link:hover {
      color: hsl(142, 76%, 36%);
    }
    /* Featured image */
    .featured-image {
      aspect-ratio: 16 / 9;
      width: 100%;
      overflow: hidden;
      border-radius: 0.5rem;
      margin-bottom: 2rem;
    }
    .featured-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* Footer */
    footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid hsl(0, 0%, 90%);
    }
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: hsl(0, 0%, 3.9%);
        color: hsl(0, 0%, 98%);
      }
      h1, .prose h2, .prose h3, .prose h4, .prose strong {
        color: hsl(0, 0%, 98%);
      }
      .prose {
        color: hsl(0, 0%, 98%);
      }
      .prose code {
        background-color: hsl(0, 0%, 15%);
        color: hsl(0, 0%, 98%);
      }
      .prose pre {
        background-color: hsl(0, 0%, 15%);
        color: hsl(0, 0%, 98%);
      }
      .prose blockquote {
        color: hsl(0, 0%, 70%);
        border-left-color: hsl(0, 0%, 30%);
      }
      .meta {
        color: hsl(0, 0%, 65%);
      }
      .back-link {
        color: hsl(0, 0%, 65%);
      }
      footer {
        border-top-color: hsl(0, 0%, 20%);
      }
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="min-h-screen" style="background-color: hsl(var(--background, 0 0% 100%));">
      <article class="container">
        <!-- Back to Blog -->
        <a href="/blog" class="back-link">
          <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Blog
        </a>

        ${featureImage ? `
        <!-- Featured Image -->
        <div class="featured-image">
          <img src="${escapeHtml(featureImage)}" alt="${escapeHtml(title)}" />
        </div>
        ` : ''}

        <!-- Header -->
        <header>
          ${tags.length > 0 ? `
          <div class="tags">
            ${tags.map(tag => `<span class="tag">${escapeHtml(tag.name)}</span>`).join('')}
          </div>
          ` : ''}
          
          <h1>${escapeHtml(title)}</h1>
          
          <div class="meta">
            ${authorName ? `<span>By ${escapeHtml(authorName)}</span><span>•</span>` : ''}
            <time>${new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
          </div>
        </header>

        <!-- Content -->
        <article id="post-content" class="prose">
          ${contentHtml}
        </article>

        <!-- Footer -->
        <footer>
          <a href="/blog" class="back-link">
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </a>
        </footer>
      </article>
    </div>
  </div>
  <!-- React will hydrate this content -->
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
}

// Write individual blog post HTML
async function writePostHtml(post, distDir, cssBundlePath) {
  const slug = post.slug;
  const postDir = path.join(distDir, 'blog', slug);
  
  // Create directory
  await fs.mkdir(postDir, { recursive: true });
  
  // Prepare data
  const title = post.title;
  const description = post.meta_description || post.excerpt || post.plaintext?.substring(0, 160) || '';
  const canonicalUrl = urlJoin(SITE_URL, 'blog', slug);
  const ogImage = post.og_image || post.feature_image || null;
  const featureImage = post.feature_image || null; // Separate featured image for display
  const contentHtml = toContentHtml(post);
  const authorName = post.authors && post.authors.length > 0 ? post.authors[0].name : 'WagerProof Team';
  const tags = post.tags || [];
  
  // Generate HTML
  const html = renderPostHtml({
    title,
    description,
    canonicalUrl,
    ogImage,
    featureImage, // Pass featured image separately for display
    contentHtml,
    publishedAt: post.published_at,
    updatedAt: post.updated_at,
    cssBundlePath,
    authorName,
    tags
  });
  
  // Write to file
  const outputPath = path.join(postDir, 'index.html');
  await fs.writeFile(outputPath, html, 'utf-8');
  
  console.log(`   ✓ ${slug} → ${outputPath}`);
}

// Generate blog index page
async function writeBlogIndex(posts, distDir, cssBundlePath) {
  const blogDir = path.join(distDir, 'blog');
  await fs.mkdir(blogDir, { recursive: true });
  
  const canonicalUrl = urlJoin(SITE_URL, 'blog');
  
  // Generate post list HTML
  const postListHtml = posts.map(post => {
    const postUrl = urlJoin(SITE_URL, 'blog', post.slug);
    const excerpt = post.excerpt || post.plaintext?.substring(0, 200) || '';
    const image = post.feature_image || post.og_image || `${SITE_URL}/wagerproof-landing.png`;
    const authorName = post.authors && post.authors.length > 0 ? post.authors[0].name : 'WagerProof Team';
    
    return `
      <article class="blog-post-preview">
        ${post.feature_image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(post.title)}" loading="lazy" />` : ''}
        <h2><a href="${postUrl}">${escapeHtml(post.title)}</a></h2>
        <p class="meta">
          By ${escapeHtml(authorName)} • 
          ${new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p>${escapeHtml(excerpt)}</p>
        <a href="${postUrl}" class="read-more">Read more →</a>
      </article>
    `;
  }).join('\n');
  
  // JSON-LD for blog collection
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'WagerProof Blog',
    description: 'Latest sports betting insights, analytics, and strategies from WagerProof',
    url: canonicalUrl,
    publisher: {
      '@type': 'Organization',
      name: 'WagerProof',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/wagerproofGreenLight.png`
      }
    }
  };
  
  const jsonLdString = JSON.stringify(jsonLd, null, 0)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="ssg-generated" content="true" />
  
  <title>Blog | WagerProof</title>
  <meta name="description" content="Latest sports betting insights, analytics, and strategies from WagerProof" />
  <link rel="canonical" href="${canonicalUrl}" />
  
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="Blog | WagerProof" />
  <meta property="og:description" content="Latest sports betting insights, analytics, and strategies from WagerProof" />
  <meta property="og:image" content="${SITE_URL}/wagerproof-landing.png" />
  <meta property="og:site_name" content="WagerProof" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Blog | WagerProof" />
  <meta name="twitter:description" content="Latest sports betting insights, analytics, and strategies from WagerProof" />
  <meta name="twitter:image" content="${SITE_URL}/wagerproof-landing.png" />
  
  <script type="application/ld+json">${jsonLdString}</script>
  
  ${cssBundlePath ? `<link rel="stylesheet" href="${cssBundlePath}" />` : ''}
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { font-size: 2.5rem; margin-bottom: 2rem; text-align: center; }
    .blog-post-preview {
      border-bottom: 1px solid #e0e0e0;
      padding: 2rem 0;
    }
    .blog-post-preview img {
      max-width: 100%;
      height: auto;
      margin-bottom: 1rem;
      border-radius: 8px;
    }
    .blog-post-preview h2 {
      font-size: 1.8rem;
      margin: 1rem 0;
    }
    .blog-post-preview a {
      color: #4f9777;
      text-decoration: none;
    }
    .blog-post-preview a:hover {
      text-decoration: underline;
    }
    .meta {
      color: #666;
      font-size: 0.9rem;
    }
    .read-more {
      display: inline-block;
      margin-top: 1rem;
      color: #4f9777;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div id="root">
    <main>
      <h1>WagerProof Blog</h1>
      <div class="blog-posts">
        ${postListHtml || '<p>No blog posts available yet.</p>'}
      </div>
    </main>
  </div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  
  const outputPath = path.join(blogDir, 'index.html');
  await fs.writeFile(outputPath, html, 'utf-8');
  
  console.log(`   ✓ Blog index → ${outputPath}`);
}

// Generate sitemap.xml
async function writeSitemap(posts, distDir) {
  const now = new Date().toISOString().split('T')[0];
  
  // Static pages
  const staticPages = [
    { loc: SITE_URL, lastmod: now, changefreq: 'weekly', priority: '1.0' },
    { loc: urlJoin(SITE_URL, 'home'), lastmod: now, changefreq: 'weekly', priority: '1.0' },
    { loc: urlJoin(SITE_URL, 'blog'), lastmod: now, changefreq: 'daily', priority: '0.9' },
    { loc: urlJoin(SITE_URL, 'privacy-policy'), lastmod: now, changefreq: 'monthly', priority: '0.5' },
    { loc: urlJoin(SITE_URL, 'terms-and-conditions'), lastmod: now, changefreq: 'monthly', priority: '0.5' },
  ];
  
  // Blog posts
  const blogUrls = posts.map(post => ({
    loc: urlJoin(SITE_URL, 'blog', post.slug),
    lastmod: new Date(post.updated_at || post.published_at).toISOString().split('T')[0],
    changefreq: 'monthly',
    priority: '0.8'
  }));
  
  const allUrls = [...staticPages, ...blogUrls];
  
  // Generate XML
  const urlsXml = allUrls.map(page => `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n');
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  
  const outputPath = path.join(distDir, 'sitemap.xml');
  await fs.writeFile(outputPath, sitemap, 'utf-8');
  
  console.log(`   ✓ Sitemap → ${outputPath}`);
}

// Find Vite CSS bundle
async function findViteCssBundle(distDir) {
  try {
    const assetsDir = path.join(distDir, 'assets');
    const files = await fs.readdir(assetsDir);
    const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
    return cssFile ? `/assets/${cssFile}` : null;
  } catch (error) {
    console.warn('⚠️  Could not find CSS bundle:', error.message);
    return null;
  }
}

// Main function
async function main() {
  console.log('🏗️  Starting blog build process...\n');
  
  const distDir = path.resolve(__dirname, '../dist');
  
  // Verify dist directory exists
  try {
    await fs.access(distDir);
  } catch (error) {
    console.error('❌ dist/ directory not found. Run vite build first.');
    process.exit(1);
  }
  
  // Find CSS bundle
  const cssBundlePath = await findViteCssBundle(distDir);
  console.log(cssBundlePath ? `✅ Found CSS bundle: ${cssBundlePath}\n` : '⚠️  No CSS bundle found\n');
  
  // Fetch posts from Ghost
  const posts = await fetchAllPosts();
  
  if (posts.length === 0) {
    console.log('⚠️  No blog posts to generate. Generating empty blog index...\n');
  }
  
  // Generate blog posts
  console.log('📝 Generating blog post pages...');
  for (const post of posts) {
    await writePostHtml(post, distDir, cssBundlePath);
  }
  
  // Generate blog index
  console.log('\n📄 Generating blog index page...');
  await writeBlogIndex(posts, distDir, cssBundlePath);
  
  // Generate sitemap
  console.log('\n🗺️  Generating sitemap...');
  await writeSitemap(posts, distDir);
  
  console.log('\n✅ Blog build complete!\n');
  console.log(`   Generated ${posts.length} blog post(s)`);
  console.log(`   Blog index: ${path.join(distDir, 'blog', 'index.html')}`);
  console.log(`   Sitemap: ${path.join(distDir, 'sitemap.xml')}`);
  console.log('');
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

