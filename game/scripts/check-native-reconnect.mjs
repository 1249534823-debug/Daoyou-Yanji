import puppeteer from '/root/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const data=JSON.parse(await fs.readFile('output/native-realm-verification.json','utf8'));
const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try {
 const context=await browser.createBrowserContext();
 await context.setCookie(...data.player.cookie.split('; ').map(v=>{const i=v.indexOf('=');return {name:v.slice(0,i),value:v.slice(i+1),domain:'localhost',path:'/'};}));
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>{
  window.__wsEvents=[];
  const Native=window.WebSocket;
  window.WebSocket=class extends Native {
   constructor(...args){super(...args);this.addEventListener('open',()=>window.__wsEvents.push({type:'open'}));this.addEventListener('message',e=>{try{window.__wsEvents.push({type:JSON.parse(e.data).type});}catch{}});this.addEventListener('close',e=>window.__wsEvents.push({type:'close',code:e.code}));}
  };
 });
 await page.setViewport({width:390,height:844});
 await page.goto('http://localhost:38099/game/retreat',{waitUntil:'networkidle2',timeout:45000});
 await page.waitForFunction(()=>document.body.innerText.includes('突破'),{timeout:20000});
 await page.screenshot({path:'output/native-retreat-390.png',fullPage:true});
 const count=()=>page.evaluate(()=>window.__wsEvents.filter(e=>e.type==='ready').length);
 await page.waitForFunction(()=>window.__wsEvents.some(e=>e.type==='ready'),{timeout:15000});
 const before=await count();
 await page.setOfflineMode(true);
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 await page.setOfflineMode(false);
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(n=>window.__wsEvents.filter(e=>e.type==='ready').length>n,{timeout:20000},before);
 await page.waitForFunction(()=>window.__wsEvents.some(e=>e.type==='ping'),{timeout:30000});
 const events=await page.evaluate(()=>window.__wsEvents);
 assert.equal(errors.length,0,errors.join('\n'));
 await fs.writeFile('output/native-reconnect-verification.json',JSON.stringify({passed:true,events,errors},null,2));
 console.log('PASS actual WebSocket ready, reconnect ready, heartbeat; retreat page rendered');
} catch(e){console.error(e);process.exitCode=1;} finally{await browser.close();}

