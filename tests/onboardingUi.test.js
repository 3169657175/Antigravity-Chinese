const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

const root = PROJECT_ROOT;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'renderer.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(root, 'src/onboardingController.js'), 'utf8');
const controller = require('../src/onboardingController');
const packageJson = require('../package.json');

test('首次询问、完整导览、反代分支和聚光定位都拥有独立界面元素', () => {
  for (const id of [
    'btn-open-guide', 'guide-overlay', 'guide-dialog', 'guide-spotlight',
    'btn-guide-start', 'btn-guide-skip', 'btn-guide-prev', 'btn-guide-next',
    'guide-decision-actions', 'btn-guide-proxy-skip', 'btn-guide-proxy-start'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<script src="src\/onboardingController\.js"><\/script>[\s\S]*<script src="renderer\.js"><\/script>/);
  assert.match(renderer, /AgyOnboardingController\?\.init\(\)/);
  assert.ok(packageJson.build.files.includes('src/**/*.js'));
  assert.doesNotMatch(html, /id="btn-reopen-guide"/);
});

test('首次询问才显示开始按钮，左下角重新打开时直接进入第 1 步', () => {
  assert.match(controllerSource, /startButton\.hidden = false/);
  assert.match(controllerSource, /function startGuide\(\)[\s\S]*startButton\.hidden = true/);
  assert.match(controllerSource, /openButton\.addEventListener\('click', startGuide\)/);
  assert.match(css, /\.guide-footer \[hidden\] \{ display: none !important; \}/);
});

test('引导覆盖账户、Token、按需反代、主题、MCP 与 Skill，并可跳过反代', () => {
  assert.ok(controller.steps.length >= 13);
  for (const targetTab of ['tab-patch', 'tab-local-accounts', 'tab-codex-gateway', 'tab-themes', 'tab-mcp', 'tab-skill-market', 'tab-skills']) {
    assert.ok(controller.steps.some(step => step.targetTab === targetTab), targetTab);
  }
  assert.ok(controller.steps.some(step => (
    step.id === 'account' && step.openSelectors?.includes('#btn-la-tab-accounts')
  )), '本地账号引导必须明确回到账号管理二级标签');
  assert.ok(controller.steps.some(step => step.id === 'local-token' && step.targetSelector === '#btn-la-tab-token'));
  assert.ok(controller.steps.some(step => step.id === 'provider-auth' && step.targetSelector === '#codex-provider-auth-mode'));
  assert.ok(controller.steps.some(step => step.decision === 'proxy'));
  assert.ok(controller.steps.filter(step => step.requiresProxy).length >= 5);
  assert.match(controllerSource, /function chooseProxy\(wantsProxy\)/);
  assert.match(controllerSource, /const targetId = wantsProxy \? 'gateway-start' : 'theme'/);
});

test('向导会避开目标按钮，以不透明浮层和聚光高亮呈现，并支持 Esc 和方向键', () => {
  assert.match(controllerSource, /function positionDialog\(\)/);
  assert.match(controllerSource, /placement: 'right'/);
  assert.match(controllerSource, /placement: 'left'/);
  assert.match(controllerSource, /placement: 'bottom'/);
  assert.match(controllerSource, /event\.key === 'Escape'/);
  assert.match(controllerSource, /event\.key === 'ArrowLeft'/);
  assert.match(css, /\.guide-spotlight \{/);
  assert.match(css, /box-shadow: 0 0 0 9999px rgba\(4,8,14,\.62\)/);
  assert.match(css, /\.guide-overlay\.is-wizard-mode \.guide-dialog \{ position: fixed/);
});

test('切换步骤会先绘制新文案，再无感完成页面定位，不保留平滑滚动或固定等待', () => {
  assert.match(controllerSource, /function isElementFullyVisible\(element\)/);
  assert.match(controllerSource, /const revision = \+\+navigationRevision/);
  assert.match(controllerSource, /requestAnimationFrame\(\(\) => \{\s*navigationTimer = setTimeout/s);
  assert.match(controllerSource, /highlighted\.scrollIntoView\(\{ behavior: 'auto', block: 'nearest', inline: 'nearest' \}\)/);
  assert.doesNotMatch(controllerSource, /behavior: 'smooth'/);
  assert.doesNotMatch(controllerSource, /schedulePosition\(260\)/);
});
