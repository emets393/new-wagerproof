import puppeteer from 'puppeteer';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDirectory = path.resolve(__dirname, '../dist');
const host = '127.0.0.1';
const port = 4173;

const routes = ['/', '/home', '/mcp', '/privacy-policy', '/terms-and-conditions'];

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

function startStaticServer(shellHtml) {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}:${port}`).pathname);
      const relativePath = pathname.replace(/^\/+/, '');
      const candidate = path.resolve(distDirectory, relativePath);
      const insideDist = candidate === distDirectory || candidate.startsWith(`${distDirectory}${path.sep}`);
      const extension = path.extname(pathname).toLowerCase();

      if (insideDist && extension && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const bytes = fs.readFileSync(candidate);
        response.writeHead(200, {
          'Content-Type': mimeTypes.get(extension) || 'application/octet-stream',
          'Content-Length': bytes.length,
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(bytes);
        return;
      }

      if (extension) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(shellHtml),
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(shellHtml);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`Prerender server error: ${error.message}`);
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function assertProductionHtml(html, route) {
  const forbidden = ['/@vite/client', 'mixpanel-2-latest.min.js\"></script>', 'connect.facebook.net/en_US/fbevents.js\"></script>'];
  for (const value of forbidden) {
    if (html.includes(value)) throw new Error(`${route}: prerender output contains injected runtime script ${value}`);
  }
  const expectedOnce = [
    ['mixpanel.init(', 'Mixpanel initialization'],
    ["fbq('init'", 'Meta Pixel initialization'],
    ['e8e280617e67', 'Rybbit site ID'],
  ];
  for (const [needle, label] of expectedOnce) {
    const count = countOccurrences(html, needle);
    if (count !== 1) throw new Error(`${route}: expected one ${label}, found ${count}`);
  }
}

async function prerender() {
  console.log('🚀 Starting prerendering process...\n');

  // Keep the original built shell in memory so writing one rendered route cannot
  // contaminate the next route. A plain static server also avoids Vite dev-client
  // injection, which must never be serialized into production HTML.
  const shellHtml = fs.readFileSync(path.join(distDirectory, 'index.html'), 'utf8');
  const server = await startStaticServer(shellHtml);
  console.log('✅ Preview server started on http://127.0.0.1:4173\n');

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const route of routes) {
      console.log(`📄 Prerendering: ${route}`);
      
      let page;
      try {
        page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const url = request.url();
          if (url.startsWith('http://127.0.0.1:4173') || url.startsWith('data:') || url.startsWith('blob:')) {
            request.continue();
          } else {
            request.abort();
          }
        });

        // Set a reasonable timeout
        page.setDefaultTimeout(30000);
        
        // Navigate to the route
        const url = `http://${host}:${port}${route}`;
        await page.goto(url, {
          waitUntil: 'networkidle0',
        });

        // Wait a bit more for any animations or lazy loading
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Analytics loaders append their remote runtime tags while executing.
        // Keep the authored loader exactly once, but do not serialize those
        // transient DOM nodes back into the production document.
        await page.evaluate(() => {
          const runtimeSources = [
            '/@vite/client',
            '//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js',
            'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js',
            'https://connect.facebook.net/en_US/fbevents.js',
          ];
          for (const script of document.querySelectorAll('script[src]')) {
            if (runtimeSources.includes(script.getAttribute('src'))) script.remove();
          }
        });

        // Get and validate the rendered HTML
        const html = await page.content();
        assertProductionHtml(html, route);

        // Determine the output path
        let outputPath;
        if (route === '/') {
          outputPath = path.resolve(__dirname, '../dist/index.html');
        } else if (route === '/home') {
          // Skip /home as it's same as /
          await page.close();
          console.log(`   ✓ Skipped (duplicate of /)\n`);
          continue;
        } else {
          const dir = path.resolve(__dirname, `../dist${route}`);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          outputPath = path.join(dir, 'index.html');
        }

        // Write the HTML to file
        fs.writeFileSync(outputPath, html);
        console.log(`   ✓ Saved to: ${outputPath}\n`);

        await page.close();
      } catch (routeError) {
        console.error(`   ❌ Failed to prerender ${route}:`, routeError.message);
        if (page) {
          await page.close().catch(() => {});
        }
        throw routeError;
      }
    }

    console.log('✅ Prerendering complete!\n');
  } catch (error) {
    console.error('❌ Error during prerendering:', error);
    throw error;
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

prerender().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
