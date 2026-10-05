const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const asar = require('@electron/asar');
const {buildNativeLocalization} = require('./patch-workbench/compatibility');

test('native dialogs and menus translate display fields while preserving behavior and paths', async () => {
  const legacy = asar.extractFile('patch-workbench/legacy-payload.asar','dist/preload.js').toString();
  const source = buildNativeLocalization(legacy);
  const calls = [], answer = Promise.resolve({response:1});
  const dialog = {
    showMessageBox(...args) {calls.push({method:'showMessageBox',receiver:this,args});return answer;},
    showOpenDialog(...args) {calls.push({method:'showOpenDialog',receiver:this,args});return answer;},
    showErrorBox(...args) {calls.push({method:'showErrorBox',receiver:this,args});}
  };
  const Menu = {buildFromTemplate(template) {calls.push({method:'menu',template});return template;}};
  const handlers = new Map();
  const ipcMain = {handle(name, callback) { assert.ok(!handlers.has(name)); handlers.set(name, callback); }};
  const context = vm.createContext({URL,process:{env:{}},require(name) {
    if (name==='electron') return {dialog,Menu,ipcMain};
    if (name==='fs') return {readFileSync(){throw Error('Optional catalog absent');},existsSync(){return false;}};
    return require(name);
  }});
  vm.runInContext(source,context);
  context.dialog=dialog;context.Menu=Menu;
  const result = vm.runInContext(`globalThis.input={title:'Confirm Quit',message:'Are you sure you want to quit?',buttons:['Cancel','Quit'],defaultId:0,cancelId:0,detail:'There may be agents or background tasks running.'};dialog.showMessageBox(input);`,context);
  assert.equal(result,answer);assert.equal(calls[0].receiver,dialog);
  assert.equal(calls[0].args[0].title,'确认退出');
  assert.equal(calls[0].args[0].message,'您确定要退出吗？');
  assert.deepEqual(Array.from(calls[0].args[0].buttons),['取消','退出']);
  assert.equal(calls[0].args[0].defaultId,0);assert.equal(calls[0].args[0].cancelId,0);
  assert.equal(context.input.title,'Confirm Quit');assert.notEqual(calls[0].args[0],context.input);
  vm.runInContext(`globalThis.window={opaque:true};dialog.showOpenDialog(window,{title:'Open workspaces',defaultPath:'C:/My Workspace/General',properties:['openDirectory']});`,context);
  assert.equal(calls[1].args[0],context.window);
  assert.equal(calls[1].args[1].title,'打开工作区');
  assert.equal(calls[1].args[1].defaultPath,'C:/My Workspace/General');
  vm.runInContext(`globalThis.clicked=()=>42;globalThis.template=[{label:'File',id:'File',submenu:[{label:'New Window',accelerator:'Ctrl+N',click:clicked}]}];Menu.buildFromTemplate(template);`,context);
  assert.equal(calls[2].template[0].label,'文件');assert.equal(calls[2].template[0].id,'File');
  assert.equal(calls[2].template[0].submenu[0].click,context.clicked);
  assert.equal(calls[2].template[0].submenu[0].accelerator,'Ctrl+N');
  assert.equal(context.template[0].label,'File');
  const wrapped = dialog.showMessageBox;
  vm.runInContext(source,context);assert.equal(dialog.showMessageBox,wrapped);
  const catalogHandler = handlers.get('agy:i18n:catalog');
  assert.equal(catalogHandler({senderFrame:{url:'https://127.0.0.1:12345/'} }).messages.marketplace,'功能市场');
  assert.equal(Object.keys(catalogHandler({senderFrame:{url:'https://example.com/'} })).length,0);
  assert.equal(Object.keys(catalogHandler({senderFrame:{url:'file:///C:/private.txt'} })).length,0);
});
