import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import puppeteer from '/root/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const f=JSON.parse(await fs.readFile('output/admin-ui-fixtures.json','utf8'));assert.equal(f.testOnly,true);
const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const page=await browser.newPage();await page.setViewport({width:390,height:844});page.setDefaultTimeout(5000);
try{
await page.setCookie(...f.normal.cookie.split('; ').map(raw=>{const i=raw.indexOf('=');return{name:raw.slice(0,i),value:raw.slice(i+1),url:f.origin,httpOnly:true};}));
await page.goto(f.origin+'/game/cultivator');
await page.waitForFunction(()=>document.body.innerText.includes('青岚御雷真诀'));
let text=await page.$eval('body',x=>x.innerText);
assert.ok(!/满配|战力模板|按当前玩家造物规则|词缀数值取规则上限/.test(text));assert.ok(text.includes('青岚护元法衣'));
await page.screenshot({path:'output/power-template-naming-build/player-names.png',fullPage:true});
console.log('PASS player character names and descriptions');
const item=await page.evaluateHandle(()=>[...document.querySelectorAll('button,a,[role="button"]')].find(x=>x.textContent.trim()==='青岚惊雷剑'));
if(item.asElement()){await item.asElement().click();await page.waitForFunction(()=>document.body.innerText.includes('打造者'));text=await page.$eval('body',x=>x.innerText);assert.ok(text.includes('佚名'));assert.ok(!/满配|战力模板/.test(text));console.log('PASS artifact creator presentation');}
else throw new Error('Artifact detail opener not found');
}catch(e){console.log('URL',page.url());console.log((await page.$eval('body',x=>x.innerText)).slice(0,2400));throw e;}finally{await browser.close();}
