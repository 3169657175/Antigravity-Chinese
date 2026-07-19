const fs = require('fs');
const path = require('path');

function readJson(name, fallback) {
  const file = path.join(__dirname, '..', 'locales', name);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error('[AGY v2] Failed to load locale file:', name, error);
    return fallback;
  }
}

const dictionary = readJson('dict.json', {});
const substringReplacements = readJson('substring.json', []);
const coreWords = {
  file: '文件', edit: '编辑', view: '视图', help: '帮助', settings: '设置', history: '历史', task: '任务', tasks: '任务',
  agent: '智能体', agents: '智能体', workspace: '工作区', workspaces: '工作区', terminal: '终端', output: '输出', error: '错误',
  success: '成功', running: '运行中', pending: '等待中', completed: '已完成', update: '更新', download: '下载', install: '安装'
};
const combinedDict = Object.assign({}, coreWords, dictionary);

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { dictionary, coreWords, combinedDict, substringReplacements, escapeRegExp };
