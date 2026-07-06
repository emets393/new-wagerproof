import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:8080/games';
const shot = process.argv[3] || '/tmp/probe.png';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text().slice(0, 500)}`));
page.on('pageerror', (err) => logs.push(`[PAGEERROR] ${String(err).slice(0, 1000)}`));
page.on('requestfailed', (req) => logs.push(`[REQFAIL] ${req.url().slice(0, 200)} ${req.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch((e) => logs.push(`[GOTO] ${e.message}`));
await new Promise((r) => setTimeout(r, 4000));

const rootLen = await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? -1);
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
await page.screenshot({ path: shot });

console.log('URL:', page.url());
console.log('ROOT innerHTML length:', rootLen);
console.log('BODY text:', JSON.stringify(bodyText));
console.log('--- console/log events (errors & warnings first) ---');
const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[PAGEERROR]') || l.startsWith('[REQFAIL]') || l.startsWith('[GOTO]'));
for (const l of errs.slice(0, 30)) console.log(l);
console.log('--- other (last 15) ---');
for (const l of logs.filter((l) => !errs.includes(l)).slice(-15)) console.log(l);

await browser.close();
