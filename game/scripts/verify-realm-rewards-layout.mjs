import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from '/root/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const fixtures=JSON.parse(await fs.readFile('output/admin-ui-fixtures.json','utf8')); assert.equal(fixtures.testOnly,true);
const origin=fixtures.origin,out='output/realm-rewards';
const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const page=await browser.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function click(label,scope=''){const h=await page.evaluateHandle(({label,scope})=>[...(scope?document.querySelector(scope):document).querySelectorAll('button')].find(e=>e.getClientRects().length&&e.textContent.trim()===label),{label,scope});assert.ok(h.asElement(),label);await h.asElement().evaluate(e=>e.scrollIntoView({block:'center'}));await h.asElement().click();}
async function text(value){await page.waitForFunction(v=>document.body.innerText.includes(v),{},value);}
async function overflow(){const v=await page.evaluate(()=>({w:innerWidth,h:innerHeight,d:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({w:e.clientWidth,s:e.scrollWidth,l:e.getBoundingClientRect().left,r:e.getBoundingClientRect().right,t:e.getBoundingClientRect().top,b:e.getBoundingClientRect().bottom}))}));assert.ok(v.d<=v.w+1,JSON.stringify(v));for(const d of v.dialogs)assert.ok(d.s<=d.w+1&&d.l>=-1&&d.r<=v.w+1&&d.t>=-1&&d.b<=v.h+1,JSON.stringify(v));}
async function login(role){await page.deleteCookie(...await page.cookies(origin));await page.setCookie(...fixtures[role].cookie.split('; ').map(raw=>{const i=raw.indexOf('=');return{name:raw.slice(0,i),value:raw.slice(i+1),url:origin,httpOnly:true};}));}
const views=[{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1440,height:900}];
try {
 await login('admin');await page.goto(origin+'/admin/secret-realms',{waitUntil:'domcontentloaded'});await text('配置通关奖励');
 for(const v of views){await page.setViewport(v);await page.$eval('.admin-main',e=>e.scrollTo(0,0));await overflow();await page.screenshot({path:out+'/admin-'+v.width+'.png'});await click('配置通关奖励');await page.waitForSelector('dialog[open] input');await overflow();await page.screenshot({path:out+'/editor-'+v.width+'.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));console.log('PASS admin viewport',v.width);}
 await login('normal');await page.goto(origin+'/game/secret-realms/tianling',{waitUntil:'domcontentloaded'});await text('通关可得');await page.waitForFunction(()=>!document.body.innerText.includes('正在同步秘境'));
 for(const v of views){await page.setViewport(v);await overflow();await page.screenshot({path:out+'/player-'+v.width+'.png'});console.log('PASS player viewport',v.width);}
 assert.ok(!(await page.$eval('body',e=>e.innerText)).includes('秘境信息暂未同步'));
 await page.goto(origin+'/game/dungeon',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.body.innerText.includes('正在加载'));
 assert.equal(await page.$$eval('button',es=>es.filter(e=>e.textContent.trim()==='进入天灵秘境').length),0);console.log('PASS no embedded realm on ordinary dungeon');
 await page.goto(origin+'/game',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.includes('展开')));const expand=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(e=>e.textContent.includes('展开')));await expand.asElement().click();await page.waitForSelector('a[href="/game/secret-realms/tianling"]');await text('造化');await text('蜃楼幻境');await page.screenshot({path:out+'/navigation.png'});await page.click('a[href="/game/secret-realms/tianling"]');await text('通关可得');assert.ok(page.url().endsWith('/game/secret-realms/tianling'));console.log('PASS expanded creation navigation enters independent page');
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/browser-layout.json',JSON.stringify({passed:true,viewports:views,checks:'admin,editor,player,no embedded realm'}));
} catch(e){console.log('PAGE',page.url(),(await page.$eval('body',e=>e.innerText)).slice(-5000));throw e;} finally {await browser.close();}
