import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from '/root/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const root = '/data/projects/daoyou/output/admin-panels-candidate';
const fixtures = JSON.parse(
  await fs.readFile(`${root}/output/admin-ui-fixtures.json`, 'utf8'),
);
assert.equal(fixtures.testOnly, true);
assert.equal(fixtures.origin, 'http://localhost:38209');
const origin = fixtures.origin;
const out = `${root}/output/admin-panels-verification`;
await fs.mkdir(out, { recursive: true });
const version = JSON.parse(
  await fs.readFile(`${root}/client/version.json`, 'utf8'),
);
const browser = await puppeteer.launch({
  executablePath:
    '/root/.cache/puppeteer/chrome/linux-152.0.7977.75/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage();
page.setDefaultTimeout(18000);
const checks = [];
const errors = [];
const only = process.env.ADMIN_BROWSER_ONLY
  ? new RegExp(process.env.ADMIN_BROWSER_ONLY)
  : null;
let activeRequests = 0;
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/api/admin/')) activeRequests++;
});
for (const event of ['requestfinished', 'requestfailed'])
  page.on(event, (request) => {
    if (request.url().includes('/api/admin/'))
      activeRequests = Math.max(0, activeRequests - 1);
  });
async function check(name, run) {
  if (only && !only.test(name)) return;
  const started = Date.now();
  try {
    await run();
    checks.push({ name, status: 'pass', durationMs: Date.now() - started });
    console.log('PASS', name);
  } catch (error) {
    checks.push({
      name,
      status: 'fail',
      error: String(error),
      durationMs: Date.now() - started,
    });
    console.log('FAIL', name, String(error));
    await page
      .screenshot({ path: `${out}/failure-${checks.length}.png` })
      .catch(() => {});
  }
}
async function cookies(actor) {
  await page.deleteCookie(...(await page.cookies()));
  await page.setCookie(
    ...actor.cookie
      .split('; ')
      .filter(Boolean)
      .map((raw) => {
        const i = raw.indexOf('=');
        return {
          name: raw.slice(0, i),
          value: raw.slice(i + 1),
          url: origin,
          httpOnly: true,
          sameSite: 'Lax',
        };
      }),
  );
}
async function settle() {
  let stable = 0;
  for (let i = 0; i < 75; i++) {
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (activeRequests === 0) {
      if (++stable >= 3) return;
    } else stable = 0;
  }
  throw new Error('Admin requests did not settle');
}
async function go(path) {
  const current = new URL(page.url());
  if (
    current.origin === origin &&
    current.pathname.startsWith('/admin') &&
    current.pathname !== path &&
    !(await page.$('dialog[open]'))
  ) {
    if (path.endsWith('/new')) {
      await page.click(`.admin-main a[href="${path}"]`);
    } else {
      const mobile = page.viewport().width < 1024;
      if (mobile) {
        await click('打开后台菜单');
        await page.waitForSelector('.admin-menu-drawer[open]');
      }
      const scope = mobile ? '.admin-menu-drawer' : '.admin-sidebar';
      const link = await page.$(`${scope} a[href="${path}"]`);
      assert.ok(link, `Navigation ${path}`);
      const parent = await link.evaluateHandle((el) =>
        el.closest('.admin-nav-group')?.querySelector('button'),
      );
      if (
        parent.asElement() &&
        (await parent
          .asElement()
          .evaluate((el) => el.getAttribute('aria-expanded') !== 'true'))
      )
        await parent.asElement().click();
      await link.click();
    }
    await page.waitForFunction(
      (value) => location.pathname === value,
      {},
      path,
    );
  } else await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.admin-main');
  await settle();
}
async function click(label, selector = 'button, a, summary') {
  for (const handle of await page.$$(selector)) {
    if (
      await handle.evaluate(
        (el, text) =>
          el.getClientRects().length > 0 &&
          (el.getAttribute('aria-label') || el.textContent.trim()) === text,
        label,
      )
    ) {
      await handle.click();
      return;
    }
  }
  throw new Error(`Visible control missing: ${label}`);
}
async function fill(label, value, scope = '') {
  const handle = await page.evaluateHandle(
    (text, scope) => {
      const root = scope ? document.querySelector(scope) : document;
      const label = [...root.querySelectorAll('label')].find(
        (el) =>
          el.getClientRects().length && el.textContent.trim().startsWith(text),
      );
      return (
        label?.querySelector('input,textarea') ||
        (label?.htmlFor ? document.getElementById(label.htmlFor) : null)
      );
    },
    label,
    scope,
  );
  const element = handle.asElement();
  assert.ok(element, `Field ${label}`);
  await element.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await element.type(value);
}
async function select(label, value, scope = '') {
  const handle = await page.evaluateHandle(
    (text, scope) =>
      [
        ...(scope ? document.querySelector(scope) : document).querySelectorAll(
          'label',
        ),
      ]
        .find(
          (el) =>
            el.getClientRects().length &&
            el.textContent.trim().startsWith(text),
        )
        ?.querySelector('select'),
    label,
    scope,
  );
  const element = handle.asElement();
  assert.ok(element, `Select ${label}`);
  await element.select(value);
}
async function hasText(text) {
  await page.waitForFunction(
    (text) => document.body.innerText.includes(text),
    {},
    text,
  );
}
async function noOverflow() {
  const value = await page.evaluate(() => {
    const main = document.querySelector('.admin-main');
    const dialog = document.querySelector('dialog[open]');
    return {
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      main: main ? [main.clientWidth, main.scrollWidth] : null,
      dialog: dialog ? [dialog.clientWidth, dialog.scrollWidth] : null,
    };
  });
  assert.ok(value.document <= value.viewport + 1, JSON.stringify(value));
  if (value.main)
    assert.ok(value.main[1] <= value.main[0] + 1, JSON.stringify(value));
  if (value.dialog)
    assert.ok(value.dialog[1] <= value.dialog[0] + 1, JSON.stringify(value));
}
async function openTool(tool) {
  await click('打开生成工具');
  await page.click(`[data-item-tool="${tool}"]`);
  await page.waitForSelector('.item-library-drawer[open]');
  await settle();
}
async function closeDrawer() {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
}
async function openDisclosure(title) {
  const handle = await page.evaluateHandle(
    (text) =>
      [...document.querySelectorAll('summary')].find(
        (el) =>
          el.querySelector('.admin-disclosure-title')?.textContent === text,
      ),
    title,
  );
  const element = handle.asElement();
  assert.ok(element, `Disclosure ${title}`);
  await element.click();
}
const pages = [
  ['/admin', 'overview'],
  ['/admin/accounts', 'accounts'],
  ['/admin/online-users', 'online'],
  ['/admin/feedback', 'feedback'],
  ['/admin/announcement', 'announcement'],
  ['/admin/community-group', 'community'],
  ['/admin/templates', 'templates'],
  ['/admin/templates/new', 'template-new'],
  ['/admin/broadcast/email', 'email'],
  ['/admin/broadcast/game-mail', 'game-mail'],
  ['/admin/redeem-codes', 'codes'],
  ['/admin/redeem-codes/new', 'code-new'],
  ['/admin/item-library', 'items'],
  ['/admin/reputation-shop', 'reputation'],
  ['/admin/sect-shop', 'sect'],
  ['/admin/secret-realms', 'secret'],
  ['/admin/tower-enemy-sets', 'tower'],
  ['/admin/sponsorship', 'sponsorship'],
  ['/admin/llm-metrics', 'llm'],
  ['/admin/battle-simulator', 'battle'],
];
try {
  await check('Anonymous administrator route remains protected', async () => {
    await page.goto(origin + '/admin/item-library', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() => location.pathname === '/login');
  });
  await cookies(fixtures.normal);
  await check('Ordinary account cannot open administration', async () => {
    await page.goto(origin + '/admin/item-library', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() => !location.pathname.startsWith('/admin'));
    assert.equal(await page.$('.admin-shell'), null);
  });
  await cookies(fixtures.admin);
  for (const [width, height] of [
    [390, 844],
    [430, 932],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewport({ width, height });
    for (const [path, slug] of pages)
      await check(`Layout ${slug} ${width}x${height}`, async () => {
        await go(path);
        await noOverflow();
        assert.ok(await page.$('.admin-workspace'));
        if (!['overview', 'accounts'].includes(slug))
          assert.ok(
            await page.$('.admin-feature-card'),
            `Missing feature sections: ${slug}`,
          );
        assert.equal(await page.$('dialog[open]'), null);
        if (slug === 'items') {
          assert.ok(await page.$('.item-library-row'));
          assert.equal(
            await page.$eval('.item-library-results', (el) =>
              el.getAttribute('aria-busy'),
            ),
            'false',
          );
          const top = await page.$eval(
            '.item-library-results-heading',
            (el) => el.getBoundingClientRect().top,
          );
          assert.ok(
            top < height - 80,
            `List requires excessive scrolling: ${top}`,
          );
          assert.equal(
            await page.$('input[placeholder="留空则按时间生成"]'),
            null,
          );
        }
        if (slug === 'sponsorship')
          assert.equal(
            await page.$$eval(
              '.sponsorship-settings > details[open]',
              (els) => els.length,
            ),
            0,
          );
        await page.screenshot({ path: `${out}/${slug}-${width}.png` });
      });
  }
  await page.setViewport({ width: 390, height: 844 });
  await check('Mobile menu groups navigate and reset scrolling', async () => {
    await go('/admin/item-library');
    await click('打开后台菜单');
    await page.waitForSelector('.admin-menu-drawer[open]');
    await noOverflow();
    await click('玩家管理', '.admin-menu-drawer button');
    await click('用户反馈', '.admin-menu-drawer a');
    await page.waitForFunction(() => location.pathname === '/admin/feedback');
    await settle();
    assert.equal(await page.$('dialog[open]'), null);
    assert.equal(await page.$eval('.admin-main', (el) => el.scrollTop), 0);
  });
  await check(
    'Feedback opens separately and preserves unsent draft',
    async () => {
      await go('/admin/feedback');
      await page.click('.admin-feedback-link');
      await page.waitForSelector('dialog[open]');
      await hasText('反馈详情与处理');
      await fill('管理员留言', '测试草稿，不发送');
      await noOverflow();
      await page.screenshot({ path: `${out}/feedback-open-390.png` });
      await closeDrawer();
      await page.click('.admin-feedback-link');
      await page.waitForSelector('dialog[open]');
      assert.equal(
        await page.$eval('dialog[open] textarea', (el) => el.value),
        '测试草稿，不发送',
      );
      await closeDrawer();
    },
  );
  await check('Item search, empty state, pagination and reset', async () => {
    await go('/admin/item-library');
    await click('下一页');
    await settle();
    assert.ok(await page.$('.item-library-row'));
    await click('上一页');
    await settle();
    await fill('搜索', 'no-such-panel-test-item');
    await settle();
    assert.equal(await page.$('.item-library-row'), null);
    await fill('搜索', '');
    await settle();
    assert.ok(await page.$('.item-library-row'));
  });
  await check(
    'Material drawer separates form, validates and writes once',
    async () => {
      await go('/admin/item-library');
      await openTool('materials');
      await noOverflow();
      await fill('数量', '0', 'dialog[open]');
      await click('生成入库');
      await hasText('生成数量必须为正整数');
      await fill('数量', '2', 'dialog[open]');
      let writes = 0;
      const listener = (r) => {
        if (r.url().includes('/materials/generate') && r.method() === 'POST')
          writes++;
      };
      page.on('request', listener);
      await page.$$eval('dialog[open] button', (els) => {
        const b = els.find((el) => el.textContent.trim() === '生成入库');
        b.click();
        b.click();
      });
      await hasText('已生成 2 个材料');
      await settle();
      page.off('request', listener);
      assert.equal(writes, 1);
      await page.screenshot({ path: `${out}/materials-success-390.png` });
      await closeDrawer();
    },
  );
  await check(
    'Item editor warns on unsaved close and keeps fields',
    async () => {
      await go('/admin/item-library');
      await page.click('.item-library-row');
      await page.waitForSelector('.item-library-drawer[open]');
      await fill('名称', '界面验收未保存材料', 'dialog[open]');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.item-library-confirmation');
      await click('继续编辑');
      assert.equal(
        await page.evaluate(
          () =>
            [...document.querySelectorAll('dialog[open] label')]
              .find((el) => el.textContent.trim().startsWith('名称'))
              .querySelector('input').value,
        ),
        '界面验收未保存材料',
      );
      await noOverflow();
      await page.screenshot({ path: `${out}/item-editor-390.png` });
      await page.keyboard.press('Escape');
      await click('放弃修改并关闭');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    },
  );
  await check(
    'Item edit persists and archive requires confirmation',
    async () => {
      await go('/admin/item-library');
      await page.click('.item-library-row');
      await page.waitForSelector('.item-library-drawer[open]');
      const name = `界面保存验收${Date.now()}`;
      await fill('名称', name, 'dialog[open]');
      await click('保存修改');
      await hasText('道具已保存');
      await settle();
      await closeDrawer();
      await fill('搜索', name);
      await settle();
      assert.ok(await page.$('.item-library-row'));
      await page.click('.item-library-row');
      await page.waitForSelector('.item-library-drawer[open]');
      await click('归档道具');
      await page.waitForSelector('.item-library-confirmation');
      await click('取消归档');
      await click('归档道具');
      await click('确认归档');
      await hasText('道具已归档');
      await settle();
      await closeDrawer();
      assert.equal(await page.$('.item-library-row'), null);
    },
  );
  await check(
    'Daily generation settings save and discard independently',
    async () => {
      await go('/admin/item-library');
      await openTool('daily');
      await fill('每日数量', '4', 'dialog[open]');
      await click('保存配置');
      await hasText('每日生成配置已保存');
      await settle();
      await closeDrawer();
      await openTool('daily');
      assert.equal(
        await page.$eval('dialog[open] input[type=number]', (el) => el.value),
        '4',
      );
      await fill('每日数量', '6', 'dialog[open]');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.item-library-confirmation');
      await click('放弃修改并关闭');
      await openTool('daily');
      assert.equal(
        await page.$eval('dialog[open] input[type=number]', (el) => el.value),
        '4',
      );
      await closeDrawer();
    },
  );
  await check(
    'Spirit seed tool creates one seed through real API',
    async () => {
      await go('/admin/item-library');
      await openTool('seeds');
      await fill('数量（最多 50）', '1', 'dialog[open]');
      await click('生成灵种入库');
      await hasText('已生成 1 枚灵种');
      await settle();
      await closeDrawer();
    },
  );
  await check(
    'Material failure stays in drawer and preserves inputs',
    async () => {
      await go('/admin/item-library');
      await openTool('materials');
      await fill('数量', '3', 'dialog[open]');
      await page.setRequestInterception(true);
      const intercept = (request) => {
        if (
          request.url().endsWith('/materials/generate') &&
          request.method() === 'POST'
        )
          request.respond({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: '验收模拟：服务暂时不可用' }),
          });
        else request.continue();
      };
      page.on('request', intercept);
      try {
        await click('生成入库');
        await hasText('验收模拟：服务暂时不可用');
        assert.equal(
          await page.$eval('dialog[open] input[type=number]', (el) => el.value),
          '3',
        );
      } finally {
        page.off('request', intercept);
        await page.setRequestInterception(false);
      }
      await closeDrawer();
    },
  );
  await check('Offline notice retains draft and recovers', async () => {
    await go('/admin/announcement');
    await fill('公告内容', '网络恢复前保留这份公告草稿');
    await page.setOfflineMode(true);
    await page.waitForSelector('.admin-offline-notice');
    assert.equal(
      await page.$eval('textarea', (el) => el.value),
      '网络恢复前保留这份公告草稿',
    );
    await page.setOfflineMode(false);
    await page.waitForFunction(
      () => !document.querySelector('.admin-offline-notice'),
    );
  });
  await check(
    'Shop editor and item picker retain draft after folding',
    async () => {
      await go('/admin/reputation-shop');
      assert.equal(
        await page.$eval('#shop-product-editor', (el) => el.hidden),
        true,
      );
      await click('新增商品');
      await page.waitForFunction(
        () => !document.querySelector('#shop-product-editor').hidden,
      );
      await noOverflow();
      const trigger = await page.$('#shop-product-editor button');
      assert.ok(trigger);
      await click('选择', '#shop-product-editor button');
      await page.waitForSelector('.admin-catalog-drawer[open]');
      await noOverflow();
      await page.screenshot({ path: `${out}/catalog-picker-390.png` });
      await closeDrawer();
      await fill('声望', '123');
      await click('收起编辑');
      assert.equal(
        await page.$eval('#shop-product-editor', (el) => el.hidden),
        true,
      );
      await click('继续新增');
      await noOverflow();
    },
  );
  await check(
    'Mail advanced fields fold without losing variables',
    async () => {
      await go('/admin/broadcast/email');
      await openDisclosure('模板变量');
      await fill('模板变量（JSON）', '{"name":"测试道友"}');
      await openDisclosure('模板变量');
      await openDisclosure('模板变量');
      assert.equal(
        await page.$eval('details[open] textarea', (el) => el.value),
        '{"name":"测试道友"}',
      );
      await noOverflow();
    },
  );
  await check(
    'Tower generation and battle sample filters default closed',
    async () => {
      await go('/admin/tower-enemy-sets');
      assert.equal(
        await page.$$eval('.admin-disclosure[open]', (els) => els.length),
        0,
      );
      await openDisclosure('手动生成敌人');
      await noOverflow();
      await page.screenshot({ path: `${out}/tower-open-390.png` });
      await go('/admin/battle-simulator');
      await click('Monte Carlo');
      assert.equal(
        await page.$$eval('.admin-disclosure[open]', (els) => els.length),
        0,
      );
      await openDisclosure('样本筛选');
      await noOverflow();
    },
  );
  await check(
    'No JavaScript exceptions while traversing admin pages',
    async () => {
      assert.deepEqual(errors, []);
    },
  );
} finally {
  await page.setOfflineMode(false).catch(() => {});
  await browser.close();
  const passed = checks.filter((c) => c.status === 'pass').length;
  const report = {
    testedAt: new Date().toISOString(),
    buildId: version.buildId,
    passed,
    failed: checks.length - passed,
    errors,
    checks,
  };
  await fs.writeFile(
    `${out}/${only ? 'browser-targeted-report' : 'browser-report'}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log('BROWSER_DONE', passed, 'passed', report.failed, 'failed');
  process.exitCode = report.failed ? 1 : 0;
}
