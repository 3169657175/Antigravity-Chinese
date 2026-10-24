const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/niu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    // Use a small desktop window: this is where the 1.4.3 overflow regression happened.
    const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    const preload = fs.readFileSync(path.join(__dirname, 'smoke-preload.js'), 'utf8').replace("const { contextBridge } = require('electron');", "const contextBridge = { exposeInMainWorld: (name, api) => window[name] = api };");
    await page.addInitScript(preload + `
      localStorage.setItem('agy-hub:onboarding-prompt:v3', 'completed');
      const users = Array.from({length:58}, (_,i) => ({username:i===0?'owner':i===1?'unsafe<user>':'member'+String(i).padStart(2,'0'),role:i===0?'admin':'user',status:i===2?'disabled':'active',created_at:Date.now()-i*86400000,last_login_at:i%3?Date.now()-i*3600000:null,feedback_count:i%4,reply_count:i%5,admin_note:''}));
      window.agyHubAPI.getAuthSession = async () => ({success:true,data:{username:'owner',role:'admin',token:'mock-only'}});
      window.agyHubAPI.communityRequest = async (url,options={}) => {
        const parsed=new URL(url,'https://example.test');
        if (parsed.pathname==='/api/auth/users') {
          const username=parsed.searchParams.get('username');
          if(options.method==='POST') { const u=users.find(x=>x.username===options.body.username); if(options.body.action==='disable')u.status='disabled'; if(options.body.action==='enable')u.status='active'; return {ok:true,status:200,data:{success:true}}; }
          return {ok:true,status:200,data:username?{user:users.find(u=>u.username===username),feedbacks:[{id:1,content:'这里是反馈内容 <script>unsafe</script>',created_at:Date.now()}],replies:[{id:9,feedback_id:1,content:'这里是回复内容',created_at:Date.now()-1000}],events:[{actor:'owner',action:'note',created_at:Date.now()}]}:users};
        }
        if(parsed.pathname==='/api/announcement') return {ok:true,status:200,data:[{id:1,content:'旧公告'.repeat(60),created_at:1700000000000},{id:2,content:'新版发布公告：完善用户管理和反馈排序。',created_at:1800000000000}]};
        return {ok:true,status:200,data:{success:true}};
      };
      window.agyHubAPI.fetchFeedbacks = async () => ({success:true,data:[{id:1,username:'member',content:'旧的高赞反馈',created_at:1700000000000,likes_count:30,replies:[{id:9,username:'owner',content:'已回复',created_at:1700000000001}]},{id:2,username:'member',content:'刚刚发布的问题',created_at:1800000000000,likes_count:0,replies:[]}]});
    `);
    await page.goto('file://' + path.resolve('index.html').replace(/\\/g, '/'));
    await page.addStyleTag({ content: '*,*::before,*::after { animation:none!important; transition:none!important; }' });
    try {
      await page.locator('[data-target="tab-admin-users"]').waitFor({state:'visible',timeout:8000});
    } catch (error) {
      const diagnostics = await page.evaluate(async () => ({
        currentUser: typeof currentUser === 'undefined' ? null : currentUser,
        session: await window.agyHubAPI.getAuthSession(),
        display: document.querySelector('[data-target="tab-admin-users"]')?.style.display,
        lifecycleReady: Boolean(window.AgyPageLifecycle)
      }));
      throw new Error(`Admin navigation did not restore the saved session: ${JSON.stringify({ diagnostics, errors })}`, { cause: error });
    }
    await page.keyboard.press('Escape');
    await page.locator('[data-target="tab-codex-gateway"]').click();
    const gatewayTools = await page.locator('.gateway-header-tools .gateway-diagnostic-button').evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return {top:rect.top,left:rect.left,width:rect.width};
    }));
    assert.equal(gatewayTools.length, 3, 'gateway header must keep all three utility buttons');
    assert.ok(Math.max(...gatewayTools.map(item => item.top)) - Math.min(...gatewayTools.map(item => item.top)) < 2, 'gateway utility buttons must share one horizontal row');
    assert.ok(gatewayTools[0].left < gatewayTools[1].left && gatewayTools[1].left < gatewayTools[2].left, 'gateway utility buttons must keep their visual order');
    await page.locator('[data-target="tab-admin-users"]').click();
    await page.locator('.community-table tbody tr').first().waitFor();
    assert.equal(await page.locator('.community-table tbody tr').count(),15);
    assert.equal(await page.locator('#text-admin-users-count').textContent(),'58');
    const footer = await page.evaluate(() => {
      const guide = document.querySelector('#btn-open-guide').getBoundingClientRect();
      const version = document.querySelector('#app-version-badge').getBoundingClientRect();
      return { separate: version.top >= guide.bottom, version: document.querySelector('#app-version-badge').textContent.trim() };
    });
    assert.equal(footer.separate, true, 'version must occupy a distinct row below guide');
    assert.equal(footer.version, 'v1.4.3');
    await page.screenshot({path:path.join(__dirname, '..', '..', 'assets', 'screenshots', 'community-users-preview.png')});
    await page.locator('#admin-user-next').click(); assert.match(await page.locator('#admin-user-pagination').textContent(),/第 2/);
    await page.locator('#admin-user-search').fill('member02'); assert.equal(await page.locator('.community-table tbody tr').count(),1);
    await page.keyboard.press('Escape');
    await page.locator('[data-manage="member02"]').click();
    await page.locator('#admin-user-properties').getByText('已禁用',{exact:true}).waitFor();
    assert.equal(await page.locator('#admin-user-properties .community-property').count(), 6, 'admin detail should be grouped into six readable tiles');
    const profileGrid = await page.locator('#admin-user-properties').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.ok(profileGrid >= 2, 'admin details should use a responsive multi-column grid');
    assert.equal(await page.locator('#admin-toggle-status').textContent(),'恢复账号');
    assert.equal(await page.locator('#input-detail-new-pass').getAttribute('type'),'password');
    assert.equal(await page.locator('#admin-detail-user-feedbacks script').count(),0);
    await page.screenshot({path:path.join(__dirname, '..', '..', 'assets', 'screenshots', 'community-detail-preview.png')});
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#admin-toggle-status').click();
    await page.locator('#admin-user-properties').getByText('正常',{exact:true}).waitFor();
    await page.locator('[data-target="tab-feedback"]').click();
    await page.locator('#feedback-flow-list .feedback-item').first().waitFor();
    assert.equal(await page.locator('#btn-open-feedback-modal').isVisible(), true, 'feedback FAB must be visible');
    assert.equal(await page.locator('#btn-open-announcement-modal').isVisible(), false);
    await page.locator('#btn-open-feedback-modal').click();
    assert.equal(await page.locator('#feedback-compose-modal').isVisible(), true, 'FAB opens compose modal');
    await page.locator('#btn-close-feedback-compose').click();
    assert.equal(await page.locator('#feedback-compose-modal').isVisible(), false);
    // Multiple replies exercise the inner scroller, fixed dock, delete deduping and IME-friendly single-row field.
    await page.evaluate(() => {
      const item = {
        id: 991, username: 'member', content: '反馈正文', created_at: Date.now(), likes_count: 0,
        replies: Array.from({length: 12}, (_,i) => ({
          id: 1001+i, username: 'owner', role: 'admin',
          content: '用于测试讨论列表滚动的长回复 '+String(i).repeat(30),
          created_at: Date.now()-i*1000, likes_count: 0
        }))
      };
      window.AgyCommunityState.setAll([item]);
      window.currentFeedbacksDesktop = window.AgyCommunityState.all();
      window.openFeedbackDetailDesktop(991);
    });
    await page.locator('#feedback-detail-modal').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#detail-modal-body .reply-item').count(), 12);
    const dockBefore = await page.evaluate(() => {
      const body = document.querySelector('#detail-modal-body');
      const dock = document.querySelector('#detail-modal-composer');
      return { bottom: dock.getBoundingClientRect().bottom, scrollable: body.scrollHeight > body.clientHeight, outside: !body.contains(dock), inputType: dock.querySelector('.reply-textarea')?.type, composerCount: dock.querySelectorAll('.reply-composer-row').length };
    });
    assert.equal(dockBefore.scrollable, true, 'discussion must scroll independently');
    assert.equal(dockBefore.outside, true, 'reply dock must not be nested in scroll region');
    assert.equal(dockBefore.inputType, 'text', 'composer must be single-line');
    assert.equal(dockBefore.composerCount, 1);
    await page.evaluate(() => { document.querySelector('#detail-modal-body').scrollTop = 600; });
    const dockAfter = await page.locator('#detail-modal-composer').evaluate(el => el.getBoundingClientRect().bottom);
    assert.ok(Math.abs(dockAfter-dockBefore.bottom)<1, 'reply dock must remain fixed while discussion scrolls');
    await page.locator('#detail-modal-composer .reply-textarea').fill('输入草稿不应该随着点赞刷新丢失');
    await page.evaluate(() => renderFeedbackDetailFromState(991));
    assert.match(await page.locator('#detail-modal-composer .reply-textarea').inputValue(), /输入草稿/);
    let deleteCalls = 0;
    await page.evaluate(() => {
      window.__deleteReplyCalls = 0;
      const original = window.agyHubAPI.communityRequest;
      window.agyHubAPI.communityRequest = (url, options) => {
        if (url.includes('/api/reply') && options?.method === 'DELETE') {
          window.__deleteReplyCalls++;
          return new Promise(resolve => setTimeout(() => resolve({ok:true,status:200,data:{success:true}}), 120));
        }
        return original(url, options);
      };
    });
    await page.evaluate(() => { void deleteReplyDesktop(1001,991); void deleteReplyDesktop(1001,991); });
    await page.waitForTimeout(210);
    deleteCalls = await page.evaluate(() => window.__deleteReplyCalls);
    assert.equal(deleteCalls, 1, 'double delete should only issue one request');
    assert.equal(await page.locator('.agy-confirm-overlay').count(), 0, 'reply deletion must not summon a global confirmation');
    assert.equal(await page.locator('#detail-modal-body .reply-item').count(), 11);
    const confirmationState = await page.evaluate(async () => {
      const first = window.AgyUiFeedback.confirm('第一次');
      const second = window.AgyUiFeedback.confirm('第二次');
      const count = document.querySelectorAll('.agy-confirm-overlay').length;
      const dialog = document.querySelector('.agy-confirm-dialog');
      const position = getComputedStyle(dialog.parentElement).position;
      dialog.querySelector('[data-confirm="cancel"]').click();
      const results = await Promise.all([first,second]);
      return {count,position,results,after:document.querySelectorAll('.agy-confirm-overlay').length};
    });
    assert.deepEqual(confirmationState,{count:1,position:'fixed',results:[false,false],after:0});
    await page.evaluate(() => {
      const item = {id:992,username:'member',content:'回复状态回归',created_at:Date.now(),likes_count:0,replies:[]};
      window.AgyCommunityState.setAll([item]);
      window.currentFeedbacksDesktop = window.AgyCommunityState.all();
      window.__communityRequestBeforeReply = window.agyHubAPI.communityRequest;
      window.agyHubAPI.communityRequest = async (url, options = {}) => url.includes('/api/reply') && options.method === 'POST'
        ? {ok:true,status:200,data:{success:true}}
        : {ok:true,status:200,data:{success:true}};
      window.agyHubAPI.fetchFeedbacks = async () => ({success:true,data:[{...item,replies:[{id:2201,username:'owner',role:'admin',content:'已经成功的回复',created_at:Date.now(),likes_count:0}]}]});
      window.openFeedbackDetailDesktop(992);
    });
    await page.locator('#modal-reply-text-992').fill('已经成功的回复');
    await page.locator('[data-feedback-detail-action="submit-reply"][data-feedback-id="992"]').click();
    await page.waitForFunction(() => document.querySelector('[data-reply-row="2201"]')?.textContent.includes('已经成功的回复'));
    assert.doesNotMatch(await page.locator('[data-reply-row="2201"] .community-time').textContent(), /发送中/);
    assert.equal(await page.locator('#operation-toast-host').getByText('回复已发送', {exact:true}).count(), 0, 'successful replies should not create a redundant toast');
    await page.evaluate(async () => {
      const item = window.AgyCommunityState.all()[0];
      window.agyHubAPI.fetchFeedbacks = async () => ({success:true,stale:true,warning:'正在后台同步最新讨论',data:[item]});
      await loadFeedbacks(false);
    });
    assert.equal(await page.locator('#operation-toast-host').getByText('离线只读', {exact:true}).count(), 0, 'cached feedback should not create a redundant offline toast');
    await page.evaluate(async () => {
      window.agyHubAPI.communityRequest = window.__communityRequestBeforeReply;
      delete window.__communityRequestBeforeReply;
      window.agyHubAPI.fetchFeedbacks = async () => ({success:true,data:[{id:1,username:'member',content:'旧的高赞反馈',created_at:1700000000000,likes_count:30,replies:[{id:9,username:'owner',content:'已回复',created_at:1700000000001}]},{id:2,username:'member',content:'刚刚发布的问题',created_at:1800000000000,likes_count:0,replies:[]}]});
      document.getElementById('feedback-sort').value = 'newest';
      await loadFeedbacks(false, {silent:true});
    });
    await page.screenshot({path:path.join(__dirname,'..','..','assets','screenshots','community-replies-preview.png')});
    await page.locator('#detail-modal-close-btn').click();
    await page.locator('#feedback-detail-modal').waitFor({state:'hidden',timeout:2500});
    assert.equal(await page.locator('#feedback-flow-list .feedback-item').first().getAttribute('data-id'),'2');
    await page.locator('#feedback-sort').selectOption('popular');
    await page.waitForFunction(()=>document.querySelector('#feedback-flow-list .feedback-item')?.dataset.id==='1');
    await page.locator('#feedback-sort').selectOption('unanswered');
    await page.waitForFunction(()=>document.querySelectorAll('#feedback-flow-list .feedback-item').length===1);
    await page.evaluate(async () => {
      window.agyHubAPI.fetchFeedbacks = async () => ({success:true,data:Array.from({length:15},(_,i)=>({id:300+i,username:'test'+i,content:'回归测试长反馈内容 '.repeat(16),created_at:1800000000000+i*1000,likes_count:i,replies:[]}))});
      document.getElementById('feedback-sort').value='newest';
      await loadFeedbacks(false);
    });
    const feedbackBefore = await page.evaluate(() => ({
      top:document.querySelector('#btn-open-feedback-modal').getBoundingClientRect().top,
      scrollable:document.querySelector('.main-content').scrollHeight > document.querySelector('.main-content').clientHeight,
      pages:document.querySelector('#feedback-page-info').textContent
    }));
    assert.equal(feedbackBefore.scrollable,true,'feedback list must scroll in small desktop windows');
    assert.match(feedbackBefore.pages,/\d+ \/ \d+/);
    await page.evaluate(() => { document.querySelector('.main-content').scrollTop=800; });
    const feedbackAfter = await page.locator('#btn-open-feedback-modal').evaluate(el=>el.getBoundingClientRect().top);
    assert.ok(Math.abs(feedbackBefore.top-feedbackAfter)<1,'feedback FAB must not move with the mouse wheel');
    await page.locator('#feedback-page-next').click();
    assert.match(await page.locator('#feedback-page-info').textContent(), /第 2/);
    await page.locator('[data-target="tab-admin-announcement"]').click();
    assert.equal(await page.locator('#btn-open-feedback-modal').isVisible(),false);
    assert.equal(await page.locator('#btn-open-announcement-modal').isVisible(),true);
    await page.locator('#btn-open-announcement-modal').click();
    assert.equal(await page.locator('#announcement-compose-modal').isVisible(),true);
    await page.locator('#btn-close-announcement-compose').click();
    await page.locator('.btn-edit-ann').first().waitFor();
    assert.equal(await page.locator('.btn-edit-ann').first().getAttribute('data-id'),'2');
    await page.locator('#admin-ann-sort').selectOption('oldest');
    await page.waitForFunction(()=>document.querySelector('.btn-edit-ann')?.dataset.id==='1');
    await page.evaluate(async () => {
      const original=window.agyHubAPI.communityRequest;
      window.agyHubAPI.communityRequest=async (url,options)=>url.includes('/api/announcement')
        ? {ok:true,status:200,data:Array.from({length:15},(_,i)=>({id:i+11,content:'系统公告长文本 '.repeat(22),created_at:1800000000000+i*1000}))}
        : original(url,options);
      await loadAnnouncementHistory(false);
    });
    const announcementBefore=await page.evaluate(()=>({
      top:document.querySelector('#btn-open-announcement-modal').getBoundingClientRect().top,
      scrollable:document.querySelector('.main-content').scrollHeight>document.querySelector('.main-content').clientHeight
    }));
    assert.equal(announcementBefore.scrollable,true,'announcement history must scroll');
    await page.evaluate(()=>document.querySelector('.main-content').scrollTop=700);
    const announcementAfter=await page.locator('#btn-open-announcement-modal').evaluate(el=>el.getBoundingClientRect().top);
    assert.ok(Math.abs(announcementBefore.top-announcementAfter)<1,'announcement FAB must remain fixed while scrolling');
    await page.locator('#admin-ann-page-next').click();
    assert.match(await page.locator('#admin-ann-page-info').textContent(),/第 2/);
    await page.evaluate(()=>document.body.classList.add('light-theme'));
    const light=await page.evaluate(()=>({
      fg:getComputedStyle(document.querySelector('.pane-header h2')).color,
      versionBorder:getComputedStyle(document.querySelector('#app-version-badge')).borderTopStyle,
      fab:getComputedStyle(document.querySelector('#btn-open-announcement-modal')).position
    }));
    assert.equal(light.fg,'rgb(15, 23, 42)');
    assert.equal(light.versionBorder,'none');
    assert.equal(light.fab,'fixed');
    await page.screenshot({path:path.join(__dirname, '..', '..', 'assets', 'screenshots', 'community-announcements-preview.png')});
    assert.equal(await page.locator('#announcement-modal').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,users:58,rowsPerPage:15,checks:['search','pagination','details','escaping','status action','password masking','feedback ordering','unanswered filter','announcement ordering','feedback FAB fixed and modal','announcement FAB fixed and modal','gateway tools horizontal','reply success reconciled','feedback informational toasts suppressed','small viewport scroll','light theme contrast','independent sidebar version'],errors}));
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exit(1); });
