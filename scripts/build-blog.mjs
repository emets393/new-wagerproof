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

// Static navbar HTML - matches LandingNavBar.tsx initial render
function renderNavbarHtml() {
  return `
    <!-- Navigation Bar -->
    <nav class="ssg-navbar">
      <div class="ssg-navbar-container">
        <div class="ssg-navbar-content">
          <!-- Logo -->
          <a href="/" class="ssg-navbar-logo">
            <img src="/wagerproofGreenLight.png" alt="WagerProof Logo" class="ssg-logo-light" />
            <img src="/wagerproofGreenDark.png" alt="WagerProof Logo" class="ssg-logo-dark" />
            <span class="ssg-navbar-title">
              <span class="ssg-title-wager">Wager</span><span class="ssg-title-proof">Proof™</span>
            </span>
          </a>
          
          <!-- Nav Links -->
          <div class="ssg-navbar-links">
            <a href="https://twitter.com/wagerproofai" target="_blank" rel="noopener noreferrer" class="ssg-social-link">
              <svg class="ssg-social-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://instagram.com/wagerproof" target="_blank" rel="noopener noreferrer" class="ssg-social-link">
              <svg class="ssg-social-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a href="/blog" class="ssg-nav-link">Blog</a>
            <a href="/press-kit" class="ssg-nav-link">Press Kit</a>
            <a href="/wagerbot-chat" class="ssg-cta-button">Get Started</a>
          </div>
        </div>
      </div>
    </nav>
  `;
}

// Static CTA HTML for blog posts
function renderCtaHtml() {
  return `
    <!-- WagerProof CTA -->
    <section class="ssg-blog-cta">
      <div class="ssg-blog-cta-content">
        <h2 class="ssg-blog-cta-title">Ready to bet smarter?</h2>
        <p class="ssg-blog-cta-text">
          WagerProof uses real data and advanced analytics to help you make informed betting decisions. 
          Get access to professional-grade predictions for NFL, College Football, and more.
        </p>
        <a href="/wagerbot-chat" class="ssg-blog-cta-button">
          Get Started Free
          <svg class="ssg-cta-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </section>
  `;
}

// Static footer HTML with links
function renderFooterHtml() {
  return `
    <!-- Footer -->
    <footer class="ssg-footer">
      <div class="ssg-footer-container">
        <div class="ssg-footer-grid">
          <!-- Brand -->
          <div class="ssg-footer-brand">
            <a href="/" class="ssg-footer-logo">
              <span class="ssg-title-wager">Wager</span><span class="ssg-title-proof">Proof™</span>
            </a>
            <p class="ssg-footer-description">
              Data-driven sports betting analytics powered by real data. Professional-grade predictions for NFL, College Football, NBA, and more.
            </p>
            <div class="ssg-footer-social">
              <a href="https://twitter.com/wagerproofai" target="_blank" rel="noopener noreferrer">
                <svg class="ssg-social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/wagerproof.official/" target="_blank" rel="noopener noreferrer">
                <svg class="ssg-social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@wagerproof" target="_blank" rel="noopener noreferrer">
                <svg class="ssg-social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
            <!-- App Store Badges -->
            <div class="ssg-footer-badges">
              <a href="https://play.google.com/store/apps/details?id=com.wagerproof.mobile" target="_blank" rel="noopener noreferrer">
                <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" class="ssg-app-badge" />
              </a>
              <a href="https://apps.apple.com/us/app/wagerproof-sports-picks-ai/id6757089957" target="_blank" rel="noopener noreferrer">
                <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" class="ssg-app-badge" />
              </a>
            </div>
          </div>

          <!-- Features -->
          <div class="ssg-footer-links">
            <h3>Features</h3>
            <ul>
              <li><a href="/">Game Predictions</a></li>
              <li><a href="/nfl">NFL Predictions</a></li>
              <li><a href="/college-football">College Football</a></li>
              <li><a href="/blog">Blog</a></li>
            </ul>
          </div>

          <!-- Resources -->
          <div class="ssg-footer-links">
            <h3>Resources</h3>
            <ul>
              <li><a href="/press-kit">Press Kit</a></li>
              <li><a href="/mobile-app">Mobile App</a></li>
            </ul>
          </div>

          <!-- Legal -->
          <div class="ssg-footer-links">
            <h3>Legal</h3>
            <ul>
              <li><a href="/privacy-policy">Privacy Policy</a></li>
              <li><a href="/terms-and-conditions">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div class="ssg-footer-bottom">
          <p>© ${new Date().getFullYear()} WagerProof. All rights reserved.</p>
          <p class="ssg-footer-disclaimer">Please gamble responsibly. WagerProof provides analytics and information for educational purposes only.</p>
        </div>
      </div>
    </footer>
  `;
}

// CSS for navbar, CTA, footer, and grid layout
function getSharedStyles() {
  return `
    /* Navbar Styles */
    .ssg-navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
      background-color: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    .ssg-navbar-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    .ssg-navbar-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 64px;
    }
    .ssg-navbar-logo {
      display: flex;
      align-items: center;
      text-decoration: none;
      gap: 0.5rem;
    }
    .ssg-navbar-logo img {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      object-fit: contain;
    }
    .ssg-logo-dark { display: none; }
    .ssg-navbar-title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -1px;
    }
    .ssg-title-wager {
      color: #000;
    }
    .ssg-title-proof {
      background: linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ssg-navbar-links {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .ssg-social-link {
      padding: 0.5rem;
      color: #374151;
      transition: color 0.2s;
    }
    .ssg-social-link:hover {
      color: #4f9777;
    }
    .ssg-social-icon {
      width: 1.25rem;
      height: 1.25rem;
    }
    .ssg-nav-link {
      padding: 0.5rem 1rem;
      color: #374151;
      text-decoration: none;
      font-weight: 500;
      border-radius: 0.5rem;
      transition: all 0.2s;
    }
    .ssg-nav-link:hover {
      color: #4f9777;
      background-color: rgba(79, 151, 119, 0.1);
    }
    .ssg-cta-button {
      padding: 0.5rem 1.25rem;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      text-decoration: none;
      font-weight: 600;
      border-radius: 9999px;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
    }
    .ssg-cta-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
    }
    
    /* Blog CTA Styles */
    .ssg-blog-cta {
      margin-top: 3rem;
      padding: 3rem 2rem;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%);
      border-radius: 1rem;
      text-align: center;
    }
    .ssg-blog-cta-content {
      max-width: 600px;
      margin: 0 auto;
    }
    .ssg-blog-cta-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: #166534;
      margin-bottom: 1rem;
    }
    .ssg-blog-cta-text {
      color: #15803d;
      font-size: 1.125rem;
      line-height: 1.75;
      margin-bottom: 1.5rem;
    }
    .ssg-blog-cta-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 2rem;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.125rem;
      border-radius: 9999px;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
    }
    .ssg-blog-cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
    }
    .ssg-cta-arrow {
      width: 1.25rem;
      height: 1.25rem;
    }
    
    /* Footer Styles */
    .ssg-footer {
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      margin-top: 4rem;
      padding: 3rem 0;
    }
    .ssg-footer-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    .ssg-footer-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 2rem;
    }
    .ssg-footer-brand {
      max-width: 400px;
    }
    .ssg-footer-logo {
      font-size: 1.5rem;
      font-weight: 700;
      text-decoration: none;
      display: inline-block;
      margin-bottom: 1rem;
    }
    .ssg-footer-description {
      color: #6b7280;
      font-size: 0.875rem;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .ssg-footer-social {
      display: flex;
      gap: 1rem;
    }
    .ssg-footer-social a {
      color: #9ca3af;
      transition: color 0.2s;
    }
    .ssg-footer-social a:hover {
      color: #4f9777;
    }
    .ssg-footer-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1rem;
      align-items: center;
    }
    .ssg-app-badge {
      height: 40px;
      width: auto;
    }
    .ssg-app-badge-disabled {
      opacity: 0.5;
    }
    .ssg-app-badge-coming-soon {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .ssg-app-badge-coming-soon span {
      font-size: 0.75rem;
      color: #6b7280;
    }
    .ssg-footer-links h3 {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #111827;
      margin-bottom: 1rem;
    }
    .ssg-footer-links ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .ssg-footer-links li {
      margin-bottom: 0.5rem;
    }
    .ssg-footer-links a {
      color: #6b7280;
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;
    }
    .ssg-footer-links a:hover {
      color: #4f9777;
    }
    .ssg-footer-bottom {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    .ssg-footer-bottom p {
      color: #9ca3af;
      font-size: 0.875rem;
      margin: 0.25rem 0;
    }
    .ssg-footer-disclaimer {
      font-size: 0.75rem !important;
      color: #d1d5db !important;
    }
    
    /* Grid Layout for Blog Index */
    .ssg-blog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .ssg-blog-card {
      background: white;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
    }
    .ssg-blog-card:hover {
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    .ssg-blog-card-image {
      aspect-ratio: 16 / 9;
      width: 100%;
      overflow: hidden;
    }
    .ssg-blog-card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .ssg-blog-card:hover .ssg-blog-card-image img {
      transform: scale(1.05);
    }
    .ssg-blog-card-content {
      padding: 1.25rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .ssg-blog-card-tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      background-color: rgba(79, 151, 119, 0.1);
      color: #4f9777;
      border-radius: 9999px;
      margin-bottom: 0.75rem;
      width: fit-content;
    }
    .ssg-blog-card-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 0.75rem 0;
      line-height: 1.3;
    }
    .ssg-blog-card-title a {
      color: inherit;
      text-decoration: none;
      transition: color 0.2s;
    }
    .ssg-blog-card-title a:hover {
      color: #4f9777;
    }
    .ssg-blog-card-excerpt {
      color: #6b7280;
      font-size: 0.875rem;
      line-height: 1.6;
      margin-bottom: 1rem;
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ssg-blog-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: #9ca3af;
      padding-top: 0.75rem;
      border-top: 1px solid #f3f4f6;
    }
    .ssg-blog-card-author {
      font-weight: 500;
    }
    
    /* Content wrapper with padding for fixed navbar */
    .ssg-content-wrapper {
      padding-top: 80px;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .ssg-navbar-links .ssg-social-link,
      .ssg-navbar-links .ssg-nav-link {
        display: none;
      }
      .ssg-footer-grid {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
      .ssg-blog-grid {
        grid-template-columns: 1fr;
      }
      .ssg-blog-cta {
        padding: 2rem 1rem;
      }
      .ssg-blog-cta-title {
        font-size: 1.5rem;
      }
    }
    
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .ssg-navbar {
        background-color: rgba(17, 24, 39, 0.9);
        border-bottom-color: rgba(255, 255, 255, 0.05);
      }
      .ssg-logo-light { display: none; }
      .ssg-logo-dark { display: block; }
      .ssg-title-wager {
        color: #fff;
      }
      .ssg-social-link,
      .ssg-nav-link {
        color: #e5e7eb;
      }
      .ssg-social-link:hover,
      .ssg-nav-link:hover {
        color: #4ade80;
      }
      .ssg-nav-link:hover {
        background-color: rgba(74, 222, 128, 0.1);
      }
      .ssg-blog-cta {
        background: linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%);
      }
      .ssg-blog-cta-title {
        color: #86efac;
      }
      .ssg-blog-cta-text {
        color: #bbf7d0;
      }
      .ssg-footer {
        background-color: #111827;
        border-top-color: #1f2937;
      }
      .ssg-footer-links h3 {
        color: #f3f4f6;
      }
      .ssg-footer-links a,
      .ssg-footer-description {
        color: #9ca3af;
      }
      .ssg-footer-links a:hover {
        color: #4ade80;
      }
      .ssg-footer-bottom {
        border-top-color: #1f2937;
      }
      .ssg-blog-card {
        background: #1f2937;
        border-color: #374151;
      }
      .ssg-blog-card-title {
        color: #f9fafb;
      }
      .ssg-blog-card-excerpt {
        color: #9ca3af;
      }
      .ssg-blog-card-meta {
        border-top-color: #374151;
        color: #6b7280;
      }
    }
  `;
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
    /* Base styles */
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
    /* Prose styles */
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
    /* Article footer */
    .article-footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid hsl(0, 0%, 90%);
    }
    /* Dark mode */
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
      .article-footer {
        border-top-color: hsl(0, 0%, 20%);
      }
    }
    
    ${getSharedStyles()}
  </style>
</head>
<body>
  <div id="root">
    ${renderNavbarHtml()}
    
    <div class="ssg-content-wrapper">
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

        <!-- CTA -->
        ${renderCtaHtml()}

        <!-- Article Footer -->
        <div class="article-footer">
          <a href="/blog" class="back-link">
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </a>
        </div>
      </article>
      
      ${renderFooterHtml()}
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
  
  // Generate post list HTML as grid cards
  const postListHtml = posts.length > 0 ? posts.map(post => {
    const postUrl = `/blog/${post.slug}`;
    const excerpt = post.excerpt || post.plaintext?.substring(0, 150) || '';
    const image = post.feature_image || post.og_image;
    const authorName = post.authors && post.authors.length > 0 ? post.authors[0].name : 'WagerProof Team';
    const primaryTag = post.tags && post.tags.length > 0 ? post.tags[0].name : null;
    
    return `
      <article class="ssg-blog-card">
        ${image ? `
        <a href="${postUrl}" class="ssg-blog-card-image">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(post.title)}" loading="lazy" />
        </a>
        ` : ''}
        <div class="ssg-blog-card-content">
          ${primaryTag ? `<span class="ssg-blog-card-tag">${escapeHtml(primaryTag)}</span>` : ''}
          <h2 class="ssg-blog-card-title">
            <a href="${postUrl}">${escapeHtml(post.title)}</a>
          </h2>
          <p class="ssg-blog-card-excerpt">${escapeHtml(excerpt)}</p>
          <div class="ssg-blog-card-meta">
            <span class="ssg-blog-card-author">By ${escapeHtml(authorName)}</span>
            <time>${new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
          </div>
        </div>
      </article>
    `;
  }).join('\n') : '<p class="no-posts">No blog posts available yet. Check back soon!</p>';
  
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
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #111827;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
    }
    .blog-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .blog-header {
      text-align: center;
      margin-bottom: 3rem;
    }
    .blog-header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 0.5rem;
    }
    .blog-header p {
      font-size: 1.125rem;
      color: #6b7280;
      max-width: 600px;
      margin: 0 auto;
    }
    .no-posts {
      text-align: center;
      padding: 4rem 2rem;
      color: #6b7280;
      font-size: 1.125rem;
    }
    
    /* Dark mode for body */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #0a0a0a;
        color: #f9fafb;
      }
      .blog-header h1 {
        color: #f9fafb;
      }
      .blog-header p {
        color: #9ca3af;
      }
      .no-posts {
        color: #9ca3af;
      }
    }
    
    ${getSharedStyles()}
  </style>
</head>
<body>
  <div id="root">
    ${renderNavbarHtml()}
    
    <div class="ssg-content-wrapper">
      <main class="blog-container">
        <header class="blog-header">
          <h1>WagerProof Blog</h1>
          <p>Expert insights on sports betting analytics, strategies, and data-driven predictions</p>
        </header>
        
        <div class="ssg-blog-grid">
          ${postListHtml}
        </div>
      </main>
      
      ${renderFooterHtml()}
    </div>
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
