import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes = ['/', '/home', '/privacy-policy', '/terms-and-conditions'];

async function prerender() {
  console.log('🚀 Starting prerendering process...\n');

  // Create a preview server for the built files
  const server = await createServer({
    server: { port: 4173 },
    root: path.resolve(__dirname, '../dist'),
    mode: 'production',
  });
  
  await server.listen();
  console.log('✅ Preview server started on http://localhost:4173\n');

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
        
        // Set a reasonable timeout
        page.setDefaultTimeout(30000);
        
        // Navigate to the route
        const url = `http://localhost:4173${route}`;
        await page.goto(url, {
          waitUntil: 'networkidle0',
        });

        // Wait a bit more for any animations or lazy loading
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get the rendered HTML
        const html = await page.content();

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
        console.log(`   ⏭️  Continuing with next route...\n`);
        if (page) {
          await page.close().catch(() => {});
        }
        // Continue to next route instead of failing entire build
        continue;
      }
    }

    console.log('✅ Prerendering complete (with some routes skipped)!\n');
  } catch (error) {
    console.error('❌ Error during prerendering:', error);
    // Don't throw - let build succeed even if prerendering fails
    console.log('⚠️  Build will continue despite prerendering errors\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

prerender().catch((error) => {
  console.error('Fatal error:', error);
  console.log('⚠️  Prerendering failed but build will continue\n');
  // Don't exit with error code - allow build to succeed
  process.exit(0);
});

