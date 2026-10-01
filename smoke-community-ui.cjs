const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/niu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    const preload = fs.readFileSync('smoke-preload.js', 'utf8').replace("const { contextBridge } = require('electron');", "const contextBridge = { exposeInMainWorld: (name, api) => window[name] = api };");
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
    await page.locator('[data-target="tab-admin-users"]').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.locator('[data-target="tab-admin-users"]').click();
    await page.locator('.community-table tbody tr').first().waitFor();
    assert.equal(await page.locator('.community-table tbody tr').count(),15);
    assert.equal(await page.locator('#text-admin-users-count').textContent(),'58');
    await page.screenshot({path:'community-users-preview.png'});
    await page.locator('#admin-user-next').click(); assert.match(await page.locator('#admin-user-pagination').textContent(),/第 2/);
    await page.locator('#admin-user-search').fill('member02'); assert.equal(await page.locator('.community-table tbody tr').count(),1);
    await page.keyboard.press('Escape');
    await page.locator('[data-manage="member02"]').click();
    await page.locator('#admin-user-properties').getByText('已禁用',{exact:true}).waitFor();
    assert.equal(await page.locator('#admin-toggle-status').textContent(),'恢复账号');
    assert.equal(await page.locator('#input-detail-new-pass').getAttribute('type'),'password');
    assert.equal(await page.locator('#admin-detail-user-feedbacks script').count(),0);
    await page.screenshot({path:'community-detail-preview.png'});
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#admin-toggle-status').click();
    await page.locator('#admin-user-properties').getByText('正常',{exact:true}).waitFor();
    await page.locator('[data-target="tab-feedback"]').click();
    await page.locator('#feedback-flow-list .feedback-item').first().waitFor();
    assert.equal(await page.locator('#feedback-flow-list .feedback-item').first().getAttribute('data-id'),'2');
    await page.locator('#feedback-sort').selectOption('popular');
    await page.waitForFunction(()=>document.querySelector('#feedback-flow-list .feedback-item')?.dataset.id==='1');
    await page.locator('#feedback-sort').selectOption('unanswered');
    await page.waitForFunction(()=>document.querySelectorAll('#feedback-flow-list .feedback-item').length===1);
    await page.locator('[data-target="tab-admin-announcement"]').click();
    await page.locator('.btn-edit-ann').first().waitFor();
    assert.equal(await page.locator('.btn-edit-ann').first().getAttribute('data-id'),'2');
    await page.locator('#admin-ann-sort').selectOption('oldest');
    await page.waitForFunction(()=>document.querySelector('.btn-edit-ann')?.dataset.id==='1');
    await page.screenshot({path:'community-announcements-preview.png'});
    assert.equal(await page.locator('#announcement-modal').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,users:58,rowsPerPage:15,checks:['search','pagination','details','escaping','status action','password masking','feedback ordering','unanswered filter','announcement ordering','no forced announcement modal'],errors}));
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exit(1); });
