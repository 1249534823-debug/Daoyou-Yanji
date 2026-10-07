import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from '/root/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const fixtures=JSON.parse(await fs.readFile('output/admin-ui-fixtures.json','utf8'));assert.equal(fixtures.testOnly,true);
const origin=fixtures.origin, out='output/mail-contribution';
const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const page=await browser.newPage();page.setDefaultTimeout(25000);
const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/admin/broadcast/game-mail'))requests.push(JSON.parse(r.postData()));});
async function click(text){const h=await page.evaluateHandle(t=>[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&e.textContent.trim()===t),text);assert.ok(h.asElement(),text);await h.asElement().evaluate(e=>e.scrollIntoView({block:'center'}));await h.asElement().click();}
async function field(label,value,select=false){const h=await page.evaluateHandle(t=>[...document.querySelectorAll('label')].find(e=>e.textContent.trim().startsWith(t))?.querySelector('input,textarea,select'),label);assert.ok(h.asElement(),label);if(select){await h.asElement().select(value);return;}await h.asElement().click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await h.asElement().type(value);}
async function text(t){await page.waitForFunction(t=>document.body.innerText.includes(t),{},t);}
async function noOverflow(){const r=await page.evaluate(()=>({w:innerWidth,d:document.documentElement.scrollWidth,m:[document.querySelector('.admin-main')?.clientWidth,document.querySelector('.admin-main')?.scrollWidth]}));assert.ok(r.d<=r.w+1,JSON.stringify(r));assert.ok(r.m[1]<=r.m[0]+1,JSON.stringify(r));}
async function ready(){await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='预览发送人数'&&!e.disabled));}
async function preview(){const wait=page.waitForResponse(r=>r.url().endsWith('/api/admin/broadcast/game-mail')&&r.request().method()==='POST');await click('预览发送人数');const r=await wait;assert.equal(r.status(),200);const result=await r.json();await ready();return result;}
try{
await page.setCookie(...fixtures.admin.cookie.split('; ').map(raw=>{const i=raw.indexOf('=');return{name:raw.slice(0,i),value:raw.slice(i+1),url:origin,httpOnly:true};}));
await page.setViewport({width:390,height:844});await page.goto(origin+'/admin/broadcast/game-mail',{waitUntil:'domcontentloaded'});await text('搜索玩家名称');assert.ok(!(await page.$eval('body',e=>e.innerText)).includes('目标角色 ID'));
await field('搜索玩家名称','隔离');await click('确认发送给所选玩家');await text('请先搜索并选择收件玩家');assert.equal(requests.length,0);console.log('PASS unselected name cannot send');
await click('搜索玩家');await page.waitForSelector('[aria-label="玩家搜索结果"] button');const target=await page.evaluateHandle(suffix=>[...document.querySelectorAll('[aria-label=\"玩家搜索结果\"] button')].find(e=>e.textContent.includes(suffix)),fixtures.normal.cultivatorId.slice(-6));assert.ok(target.asElement());await target.asElement().click();await text('已选玩家');
await field('邮件标题','宗门贡献验收（隔离）');await field('邮件内容','仅用于隔离环境验证，不发送线上玩家。');await click('添加宗门贡献');await field('数量','75');await text('宗门贡献 x75');
const single=await preview();assert.equal(single.totalRecipients,1);assert.equal(requests.at(-1).filters.targetCultivatorId,fixtures.normal.cultivatorId);assert.deepEqual(requests.at(-1).rewardSelections,[{type:'sect_contribution',quantity:75}]);assert.equal(requests.at(-1).dryRun,true);console.log('PASS selected player preview includes contribution');
await noOverflow();await page.screenshot({path:out+'/mail-mobile.png',fullPage:true});console.log('PASS mobile layout');
await field('数量','0');const count=requests.length;await click('预览发送人数');await text('奖励数量须为');assert.equal(requests.length,count);await field('数量','75');console.log('PASS invalid quantity blocked');
await field('发送范围','group',true);await preview();assert.equal(requests.at(-1).filters.targetCultivatorId,undefined);console.log('PASS explicit group mode omits individual target');
await field('发送范围','single',true);await page.waitForFunction(()=>Boolean(document.querySelector('input[placeholder=\"输入玩家名称，例如：叶无垢\"]')));await field('搜索玩家名称','查无此道友x9732');await click('搜索玩家');await text('没有找到该名称');const before=requests.length;await click('确认发送给所选玩家');await text('请先搜索并选择收件玩家');assert.equal(requests.length,before);console.log('PASS editing name clears selected target');
await page.setViewport({width:1440,height:900});await noOverflow();await page.screenshot({path:out+'/mail-desktop.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS desktop layout and browser errors');
await fs.writeFile(out+'/browser-verification.json',JSON.stringify({passed:true,checks:7,onlyDryRunRequests:requests.every(x=>x.dryRun)}));
}catch(e){console.log('INPUTS',await page.$$eval('input',els=>els.map(e=>({value:e.value,disabled:e.disabled}))));console.log('PAGE',page.url(),(await page.$eval('body',x=>x.innerText)).slice(0,1700));throw e;}finally{await browser.close();}
