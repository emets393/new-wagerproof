import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '../dist');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function warning(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function verifyBlogBuild() {
  console.log('🔍 Verifying blog build output...\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // 1. Check if blog index exists
  const blogIndexPath = path.join(distDir, 'blog', 'index.html');
  const blogIndexExists = await fileExists(blogIndexPath);
  
  if (blogIndexExists) {
    success('Blog index exists at dist/blog/index.html');
    
    // Check blog index content
    const blogIndexContent = await readFile(blogIndexPath);
    if (blogIndexContent) {
      // Check for SSG marker
      if (blogIndexContent.includes('<meta name="ssg-generated" content="true"')) {
        success('Blog index has SSG marker');
      } else {
        error('Blog index missing SSG marker');
        hasErrors = true;
      }
      
      // Check for content
      if (blogIndexContent.includes('<div class="blog-posts">')) {
        success('Blog index has content structure');
      } else {
        error('Blog index missing content structure');
        hasErrors = true;
      }
      
      // Check for JSON-LD
      if (blogIndexContent.includes('application/ld+json')) {
        success('Blog index has JSON-LD structured data');
      } else {
        warning('Blog index missing JSON-LD structured data');
        hasWarnings = true;
      }
    }
  } else {
    error('Blog index not found at dist/blog/index.html');
    hasErrors = true;
  }
  
  // 2. Check for blog posts
  const blogDir = path.join(distDir, 'blog');
  let blogPosts = [];
  
  try {
    const entries = await fs.readdir(blogDir, { withFileTypes: true });
    blogPosts = entries
      .filter(entry => entry.isDirectory() && entry.name !== 'node_modules')
      .map(entry => entry.name);
  } catch (err) {
    // Blog directory might not exist if no posts
  }
  
  if (blogPosts.length > 0) {
    success(`Found ${blogPosts.length} blog post director${blogPosts.length === 1 ? 'y' : 'ies'}`);
    
    // Verify a sample post (first one)
    const samplePost = blogPosts[0];
    const samplePostPath = path.join(blogDir, samplePost, 'index.html');
    const samplePostExists = await fileExists(samplePostPath);
    
    if (samplePostExists) {
      success(`Sample post exists: ${samplePost}`);
      
      const postContent = await readFile(samplePostPath);
      if (postContent) {
        // Check for SSG marker
        if (postContent.includes('<meta name="ssg-generated" content="true"')) {
          success('Blog post has SSG marker');
        } else {
          error('Blog post missing SSG marker');
          hasErrors = true;
        }
        
        // Check for content - look for article tag with id="post-content" (may have additional attributes)
        if (postContent.includes('id="post-content"') && postContent.includes('<article')) {
          success('Blog post has content structure');
        } else {
          error('Blog post missing content structure');
          hasErrors = true;
        }
        
        // Check for JSON-LD
        if (postContent.includes('application/ld+json') && postContent.includes('BlogPosting')) {
          success('Blog post has BlogPosting JSON-LD');
        } else {
          warning('Blog post missing or incorrect JSON-LD');
          hasWarnings = true;
        }
        
        // Check for canonical URL
        if (postContent.includes('<link rel="canonical"')) {
          success('Blog post has canonical URL');
        } else {
          error('Blog post missing canonical URL');
          hasErrors = true;
        }
        
        // Check for CSS bundle
        if (postContent.includes('<link rel="stylesheet"')) {
          success('Blog post has CSS bundle reference');
        } else {
          warning('Blog post missing CSS bundle reference');
          hasWarnings = true;
        }
      }
    } else {
      error(`Sample post index.html not found: ${samplePost}`);
      hasErrors = true;
    }
  } else {
    warning('No blog post directories found (this is OK if Ghost has no posts yet)');
    hasWarnings = true;
  }
  
  // 3. Check for sitemap
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  const sitemapExists = await fileExists(sitemapPath);
  
  if (sitemapExists) {
    success('Sitemap exists at dist/sitemap.xml');
    
    const sitemapContent = await readFile(sitemapPath);
    if (sitemapContent) {
      // Check sitemap includes blog
      if (sitemapContent.includes('/blog')) {
        success('Sitemap includes blog URLs');
      } else {
        warning('Sitemap might be missing blog URLs');
        hasWarnings = true;
      }
      
      // Check sitemap format
      if (sitemapContent.includes('<?xml') && sitemapContent.includes('<urlset')) {
        success('Sitemap has valid XML format');
      } else {
        error('Sitemap has invalid XML format');
        hasErrors = true;
      }
    }
  } else {
    error('Sitemap not found at dist/sitemap.xml');
    hasErrors = true;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.log(`${colors.red}❌ Verification failed with errors${colors.reset}`);
    console.log('Please review the errors above and rebuild.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`${colors.yellow}⚠️  Verification passed with warnings${colors.reset}`);
    console.log('Build is functional but could be improved.');
  } else {
    console.log(`${colors.green}✅ All checks passed!${colors.reset}`);
    console.log('Blog build is ready for deployment.');
  }
  console.log('='.repeat(50) + '\n');
}

verifyBlogBuild().catch((error) => {
  console.error('❌ Verification error:', error);
  process.exit(1);
});

