const { app, BrowserWindow } = require('electron');
const path = require('path');
async function run() {
  await app.whenReady();
  const win = new BrowserWindow({ show:false, skipTaskbar:true, x:-32000, y:-32000, width:1100, height:840, webPreferences:{ preload:path.join(__dirname,'smoke-preload.js'), contextIsolation:true, backgroundThrottling:false } });
  let errors=[];
  win.webContents.on('console-message',(_event,level,message)=>{ if(level>=3 && /replyActions|ReferenceError|renderDetailModalContentDesktop/.test(message)) errors.push(message); });
  await win.loadFile(path.join(__dirname,'index.html'));
  await new Promise(r=>setTimeout(r,700));
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const item={id:21,username:'first-user',content:'feedback details with one reply',created_at:new Date().toISOString(),likes_count:0,replies:[{id:77,username:'second-user',content:'comment text that must be displayed',created_at:new Date().toISOString(),likes_count:1}]};
    communityState.setAll([item]); syncCommunityStateToWindow();
    await loadFeedbacks(true,{silent:true});
    const button=document.getElementById('main-comment-count-21');
    if(!button) throw new Error('comment count button was not rendered');
    const modal=document.getElementById('feedback-detail-modal');
    const log=[];
    for(let i=0;i<3;i++){
      button.click();
      await new Promise(r=>setTimeout(r,25));
      log.push({attempt:i+1,display:modal.style.display,active:modal.classList.contains('active'),replyVisible:document.getElementById('detail-modal-body').textContent.includes('comment text that must be displayed')});
      document.getElementById('detail-modal-close-btn').click();
      await new Promise(r=>setTimeout(r,330));
    }
    return log;
  })()`);
  console.log('COMMENT_UI_SMOKE',JSON.stringify({result,errors}));
  if(result.some(v=>v.display!=='flex'||!v.active||!v.replyVisible) || errors.length) process.exitCode=1;
  win.destroy(); app.quit();
}
run().catch(e=>{console.error('COMMENT_UI_SMOKE_FAILED',e.stack);process.exitCode=1;app.quit();});