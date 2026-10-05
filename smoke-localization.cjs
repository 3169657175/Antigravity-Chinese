const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const asar = require('@electron/asar');
const { buildPreload } = require('./patch-workbench/compatibility');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/niu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const legacy = asar.extractFile('patch-workbench/legacy-payload.asar', 'dist/preload.js').toString('utf8');
const output = process.env.LOCALIZATION_PATCH_ASAR
  ? asar.extractFile(process.env.LOCALIZATION_PATCH_ASAR, 'dist/preload.js').toString('utf8')
  : buildPreload("electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);", legacy);
const prefix = output.slice(output.indexOf('globalThis.__agyI18nCatalog'), output.indexOf("electron_1.contextBridge.exposeInMainWorld('mcpLogger'"));
const dictionaryStart = output.indexOf('  const dictionary = {');
const dictionaryEnd = output.indexOf('  const codeClassPattern', dictionaryStart);
const supplementalStart = output.indexOf('(function AGYSupplementalTranslations()');
const supplementalEnd = output.indexOf('(function AGYTranslationAuditQualityLayer()', supplementalStart);
assert.doesNotMatch(output, /AGYActivityFeedback|__agyProgress|agy-activity-feedback/);
const script = prefix + '(function(){' + output.slice(dictionaryStart, dictionaryEnd)
  + '\nglobalThis.__agyI18n.configure({dictionary,phrases:substringReplacements,dynamic:translateLegacyDynamic});})();\n'
  + output.slice(supplementalStart, supplementalEnd) + '\nglobalThis.__agyI18n.start();';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 1250, height: 1000 } });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>body{background:#f6f7f8;font:16px 'Microsoft YaHei',sans-serif;color:#25342e;padding:24px}section{background:white;border:1px solid #dee8e2;border-radius:14px;padding:24px;max-width:900px;margin:auto}h2{font-size:20px;margin-top:24px}.row{padding:16px;border:1px solid #e0eae5;border-radius:10px;margin:12px 0;line-height:1.8}code{background:#edf6f1;padding:2px 8px;border-radius:4px}small{color:#657870}input{padding:8px}</style>
      <section role="dialog" aria-label="Settings"><h1>General</h1><h2>Global Permissions</h2>
      <div class="row"><strong>Security Preset</strong><div data-testid="modified">Modified in <span>12</span> projects</div></div>
      <div class="row"><strong>Plan Review Policy</strong><p data-testid="plan-instruction">Type <code>/</code> and select <code>plan</code> to have the agent generate a plan.</p></div>
      <div class="row"><strong>Browser Subagent</strong><p data-testid="browser">Configure the browser subagent. It requires <a>Google Chrome</a> to be installed. The browser subagent can be invoked by typing <code>/browser</code> in the conversation input box.</p></div>
      <div class="row"><strong>App version</strong><p>2.19.1</p></div>
      <div class="row"><strong>Automatically Check for Updates</strong><p data-testid="updates">Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.</p></div>
      <input data-testid="input" value="Plan Review Policy" placeholder="Search" title="Global Permissions"><button title="Plan Review Policy">Open</button>
      </section><div class="prose" data-testid="prose">Plan Review Policy proof of concept</div>
      <div data-testid="project-name">General</div><div data-testid="conversation-title">Global Permissions</div>
      <pre>Global Permissions</pre><div contenteditable="true">Plan Review Policy</div>
      <div id="large"></div><div id="dynamic"></div>`);
    await page.evaluate(() => { for (let i=0; i<3000; i++) { const node=document.createElement('p'); node.textContent='Unknown static label '+i; document.querySelector('#large').append(node); } });
    await page.addScriptTag({ content: script });
    await page.waitForFunction(() => document.querySelector('[data-testid="modified"]').textContent === '已在 12 个项目中修改');
    assert.equal(await page.getByTestId('plan-instruction').textContent(), '输入 / 并选择 plan ，让智能体生成计划。');
    assert.match(await page.getByTestId('browser').textContent(), /^配置浏览器子智能体。请先安装 Google Chrome 浏览器 后再使用。/);
    assert.ok(!(await page.getByTestId('browser').textContent()).includes('to be installed'));
    assert.ok(!(await page.getByTestId('updates').textContent()).includes('Automatically'));
    assert.equal(await page.getByTestId('prose').textContent(), 'Plan Review Policy proof of concept');
    assert.equal(await page.getByTestId('project-name').textContent(), 'General');
    assert.equal(await page.getByTestId('conversation-title').textContent(), 'Global Permissions');
    assert.equal(await page.getByTestId('input').inputValue(), 'Plan Review Policy');
    assert.equal(await page.getByTestId('input').getAttribute('placeholder'), '搜索');
    assert.equal(await page.getByTestId('input').getAttribute('title'), '全局权限');
    assert.equal(await page.locator('pre').textContent(), 'Global Permissions');
    const before = await page.evaluate(() => ({...__agyI18n.stats}));
    await page.evaluate(() => {
      document.getElementById('dynamic').innerHTML='<span id="count">Modified in 275 projects</span><button id="new-button" title="Plan Review Policy">Review</button>';
      const host=document.createElement('div'); host.id='shadow-host';
      host.attachShadow({mode:'open'}).innerHTML='<span>Global Permissions</span><code>Plan Review Policy</code>';
      document.getElementById('dynamic').append(host);
    });
    await page.waitForFunction(() => document.getElementById('count').textContent === '已在 275 个项目中修改'
      && document.querySelector('#shadow-host').shadowRoot.querySelector('span').textContent === '全局权限');
    await page.evaluate(() => { document.querySelector('#new-button').setAttribute('title','App version'); document.querySelector('#count').firstChild.nodeValue='Modified in 99 projects'; });
    await page.waitForFunction(() => document.querySelector('#count').textContent === '已在 99 个项目中修改' && document.querySelector('#new-button').title === '应用版本');
    const after = await page.evaluate(() => ({...__agyI18n.stats}));
    assert.equal(after.fullScans, before.fullScans);
    assert.ok(after.visited - before.visited < 30, `Incremental update visited ${after.visited-before.visited} nodes`);
    await page.evaluate(() => { document.querySelector('#dynamic').insertAdjacentHTML('beforeend','<span id="new-label">Future Settings Text</span>'); __agyI18n.mergeDictionary({'Future Settings Text':'未来设置文案'}); });
    await page.waitForFunction(() => document.querySelector('#new-label').textContent === '未来设置文案');
    await page.evaluate(() => { document.querySelector('#new-label').setAttribute('title','Future Settings Text'); });
    await page.waitForFunction(() => document.querySelector('#new-label').title === '未来设置文案');
    await page.evaluate(() => __agyI18n.mergeDictionary({'Future Settings Text':'更新后的设置文案'}));
    await page.waitForFunction(() => document.querySelector('#new-label').textContent === '更新后的设置文案' && document.querySelector('#new-label').title === '更新后的设置文案');
    await page.evaluate(() => {
      document.querySelector('#dynamic').insertAdjacentHTML('beforeend','<div id="live-thinking">Thinking...</div><div id="live-tools">Browsed 2 tasks, ran 3 commands</div><div class="prose" id="thought-original">The browser is open. Analyzing the mobile import process.</div>');
    });
    await page.waitForFunction(() => document.querySelector('#live-tools').textContent === '浏览了 2 个任务，执行了 3 条命令');
    assert.equal(await page.locator('#live-thinking').textContent(), '正在思考…');
    assert.equal(await page.locator('#thought-original').textContent(), 'The browser is open. Analyzing the mobile import process.');
    assert.equal(await page.locator('#agy-activity-feedback').count(), 0);
    assert.deepEqual(errors, []);
    const stage=path.join(__dirname,'.codex-stage','localization'); fs.mkdirSync(stage,{recursive:true});
    await page.screenshot({path:path.join(stage,'settings-after.png')});
    await page.evaluate(() => {
      const section=document.createElement('section');section.id='marketplace-fixture';
      section.innerHTML=`<nav><button id="marketplace-tab">Marketplace</button><button id="installed-tab">Installed</button></nav>
        <input id="customization-search" placeholder="Search customizations..." value="My personal plugin">
        <div id="marketplace-description">Connect to Google Workspace, including Docs, Sheets, Slides, Drive, and Calendar.</div>
        <div id="sheet-description">Read, write, and format spreadsheets.</div>
        <div id="builtin-description">Build, package, run, and debug UI extensions for Antigravity: interactive web panels that render in the side pane, served by a Node.js sidecar using the built-in Sidecar SDK.</div>
        <button id="see-more">See <span>47</span> more</button><span id="context-tokens">2,840 / 20,000 tokens (14.2%)</span>
        <div role="tooltip"><div class="prose" id="model-tooltip">Sonnet 6.2 is now available on paid Pro and Ultra plans. Third-party model access will no longer be available on your current plan starting on January 12, 2027.</div><code id="tooltip-code">Marketplace</code></div>
        <div role="alert"><div class="markdown" id="model-notice">Make sure you are using Gemini 4.3 Flash! We will be turning down Gemini 4.1 Flash and Gemini 4.2 Flash shortly.</div></div>
        <div data-message-author-role="assistant"><div role="tooltip" class="prose" id="protected-author">Marketplace</div></div>
        <div class="prose" id="protected-builtin">Build, package, run, and debug UI extensions for Antigravity: interactive web panels that render in the side pane, served by a Node.js sidecar using the built-in Sidecar SDK.</div>
        <div id="model-id">Gemini 4.3 Flash</div><code id="skill-id">ui-extension</code>`;
      document.body.prepend(section);
    });
    await page.waitForFunction(() => document.querySelector('#marketplace-tab').textContent === '功能市场' && document.querySelector('#model-tooltip').textContent.includes('2027 年 1 月 12 日'));
    assert.equal(await page.locator('#installed-tab').textContent(),'已安装');
    assert.equal(await page.locator('#customization-search').getAttribute('placeholder'),'搜索自定义功能…');
    assert.equal(await page.locator('#customization-search').inputValue(),'My personal plugin');
    assert.equal(await page.locator('#sheet-description').textContent(),'读取、写入和格式化电子表格。');
    assert.match(await page.locator('#builtin-description').textContent(),/^构建、打包、运行和调试/);
    assert.equal(await page.locator('#see-more').textContent(),'再显示 47 项');
    assert.equal(await page.locator('#context-tokens').textContent(),'2,840 / 20,000 词元（14.2%）');
    assert.match(await page.locator('#model-notice').textContent(),/^请确保正在使用 Gemini 4.3 Flash/);
    assert.equal(await page.locator('#tooltip-code').textContent(),'Marketplace');
    assert.equal(await page.locator('#protected-author').textContent(),'Marketplace');
    assert.match(await page.locator('#protected-builtin').textContent(),/^Build, package, run/);
    assert.equal(await page.locator('#model-id').textContent(),'Gemini 4.3 Flash');
    assert.equal(await page.locator('#skill-id').textContent(),'ui-extension');
    assert.deepEqual(errors, []);
    await page.screenshot({path:path.join(stage,'marketplace-after.png')});
    fs.writeFileSync(path.join(stage,'browser-report.json'),JSON.stringify({ok:true,before,after,incrementalVisited:after.visited-before.visited,errors},null,2));
    console.log(JSON.stringify({ok:true,incrementalVisited:after.visited-before.visited,errors}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
