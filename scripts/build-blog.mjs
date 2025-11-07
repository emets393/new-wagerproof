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
    /* Inline fallback styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { font-size: 2rem; margin-top: 2rem; }
    h3 { font-size: 1.5rem; margin-top: 1.5rem; }
    img { max-width: 100%; height: auto; }
    pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
    a { color: #4f9777; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div id="root">
    <article id="post-content">
      <header>
        <h1>${escapeHtml(title)}</h1>
        ${authorName ? `<p class="author">By ${escapeHtml(authorName)}</p>` : ''}
        <p class="date">Published: ${new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>
      <div class="content">
        ${contentHtml}
      </div>
    </article>
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
  const contentHtml = toContentHtml(post);
  const authorName = post.authors && post.authors.length > 0 ? post.authors[0].name : 'WagerProof Team';
  const tags = post.tags || [];
  
  // Generate HTML
  const html = renderPostHtml({
    title,
    description,
    canonicalUrl,
    ogImage,
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

