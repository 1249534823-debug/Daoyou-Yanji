import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from '/root/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const fixtures=JSON.parse(await fs.readFile('output/admin-ui-fixtures.json','utf8')); assert.equal(fixtures.testOnly,true);
const origin=fixtures.origin,out='output/spirit-ledger';
const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const page=await browser.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function click(label,scope=''){const h=await page.evaluateHandle(({label,scope})=>[...(scope?document.querySelector(scope):document).querySelectorAll('button')].find(e=>e.getClientRects().length&&e.textContent.trim()===label),{label,scope});assert.ok(h.asElement(),label);await h.asElement().evaluate(e=>e.scrollIntoView({block:'center'}));await h.asElement().click();}
async function text(value){await page.waitForFunction(v=>document.body.innerText.includes(v),{},value);}
async function search(name){await page.$eval('#stone-name',(e,name)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,name);e.dispatchEvent(new Event('input',{bubbles:true}));},name);const promise=page.waitForResponse(r=>r.url().includes('/api/admin/spirit-stones/daily?')&&r.status()===200);await click('查询统计');const r=await promise;await ready();return (await r.json()).data;}
async function ready(){await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='查询统计'&&!e.disabled));}
async function overflow(){const result=await page.evaluate(()=>({w:innerWidth,h:innerHeight,d:document.documentElement.scrollWidth,m:[document.querySelector('.admin-main')?.clientWidth,document.querySelector('.admin-main')?.scrollWidth],dialog:[...document.querySelectorAll('dialog[open]')].map(e=>({w:e.clientWidth,s:e.scrollWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}))}));assert.ok(result.d<=result.w+1,JSON.stringify(result));assert.ok(result.m[1]<=result.m[0]+1,JSON.stringify(result));for(const d of result.dialog)assert.ok(d.s<=d.w+1&&d.left>=-1&&d.right<=result.w+1&&d.top>=-1&&d.bottom<=result.h+1,JSON.stringify(result));}
try{
await page.setCookie(...fixtures.admin.cookie.split('; ').map(raw=>{const i=raw.indexOf('=');return{name:raw.slice(0,i),value:raw.slice(i+1),url:origin,httpOnly:true};}));
await page.setViewport({width:390,height:844});await page.goto(origin+'/admin/spirit-stones',{waitUntil:'domcontentloaded'});await ready();
const data=await search('隔离');assert.ok(data.players.length>0);const active=data.players.find(p=>p.transactionCount>0);assert.ok(active,'seeded active player');
const selected=await search(active.name);assert.ok(selected.players.some(p=>p.cultivatorId===active.cultivatorId));console.log('PASS name filter and real daily response');
for(const viewport of [{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1440,height:900}]){
 await page.setViewport(viewport);await page.$eval('.admin-main',e=>e.scrollTo(0,0));await overflow();
 await page.screenshot({path:out+'/statistics-'+viewport.width+'.png',fullPage:false});
 const button=await page.evaluateHandle(id=>[...document.querySelectorAll('.stone-table tbody tr')].find(e=>e.textContent.includes(id.slice(-6)))?.querySelector('button'),active.cultivatorId);assert.ok(button.asElement());await button.asElement().evaluate(e=>e.scrollIntoView({block:'center'}));await button.asElement().click();
 await page.waitForSelector('dialog[open] .stone-entry-list li');await overflow();
 await page.screenshot({path:out+'/ledger-'+viewport.width+'.png',fullPage:false});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));console.log('PASS responsive drawer '+viewport.width+'x'+viewport.height);
}
await search('不存在的玩家灵石验收z9');await text('没有找到匹配的玩家');console.log('PASS empty name search');
await page.$eval('#stone-date',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'2000-01-01');e.dispatchEvent(new Event('input',{bubbles:true}));});await search('');await text('无法还原历史收支');console.log('PASS pre-tracking coverage notice');
await click('今天');await ready();await page.setOfflineMode(true);await click('刷新');await text('重新加载');assert.equal(await page.$$eval('.stone-summary strong',e=>e.map(n=>n.textContent).join(',')),'—,—,—');await page.setOfflineMode(false);await click('重新加载');await ready();await text('记录开始于');console.log('PASS real browser offline/recovery, no false zeros');
assert.deepEqual(errors,[]);await fs.writeFile(out+'/browser-verification.json',JSON.stringify({passed:true,viewports:['390x844','430x932','768x1024','1440x900'],checks:8,source:'isolated real API; browser offline mode for network failure'}));
}catch(e){console.log('PAGE',page.url(),(await page.$eval('body',e=>e.innerText)).slice(-3000));throw e;}finally{await browser.close();}
