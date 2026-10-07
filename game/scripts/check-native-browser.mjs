import puppeteer from '/root/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const data = JSON.parse(await fs.readFile('output/native-realm-verification.json', 'utf8'));
const browser = await puppeteer.launch({ executablePath: '/root/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const results = [];
try {
  for (const role of ['player', 'admin']) {
    const context = await browser.createBrowserContext();
    await context.setCookie(...data[role].cookie.split('; ').map(v => { const i = v.indexOf('='); return { name: v.slice(0,i), value: v.slice(i+1), domain: 'localhost', path: '/' }; }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [width,height] of [[390,844],[430,932],[768,1024],[1440,900]]) {
      await page.setViewport({width,height});
      await page.goto(`http://localhost:38099/${role === 'admin' ? 'admin/secret-realms' : 'game/dungeon'}`, {waitUntil:'networkidle2',timeout:45000});
      if (await page.evaluate(() => document.body.innerText.includes('诸宗候君'))) {
        const joined = await page.evaluate(async () => { const response = await fetch('/api/sects/lingxiao/join', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID(), 'Content-Type': 'application/json' }, body: '{}' }); return { status: response.status, body: await response.text() }; });
        assert.equal(joined.status, 200, joined.body);
        await page.goto(`http://localhost:38099/${role === 'admin' ? 'admin/secret-realms' : 'game/dungeon'}`, {waitUntil:'networkidle2',timeout:45000});
      }
      await page.waitForFunction(() => document.body.innerText.includes('天灵秘境'), {timeout:20000}).catch(async e=>{console.log('PAGE_TEXT', await page.evaluate(()=>document.body.innerText.slice(0,2000)));throw e;});
      const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1);
      await page.screenshot({path:`output/native-${role}-${width}.png`,fullPage:true});
      assert.equal(overflow,false,`${role} ${width} horizontal overflow`);
      assert.equal(errors.length,0,errors.join('\n'));
      results.push({role,width,height,overflow:false,url:page.url()});
    }
    if (role === 'player') {
      await page.setOfflineMode(true);
      await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
      await page.setOfflineMode(false);
      await page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await page.waitForFunction(()=>document.body.innerText.includes('天灵秘境'));
      results.push({scenario:'offline-online',passed:true});
    }
    await context.close();
  }
  await fs.writeFile('output/native-browser-verification.json',JSON.stringify(results,null,2));
  console.log('BROWSER_COMPLETE',results.length);
} finally {await browser.close();}
