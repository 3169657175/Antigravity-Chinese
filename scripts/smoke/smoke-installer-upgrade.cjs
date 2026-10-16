// Runs the real electron-builder NSIS installer with a separate app identity,
// registry keys, executable name, and payload. Never installs over the live Hub.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn, spawnSync, execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const version = require(path.join(root, 'package.json')).version;
const work = path.join(root, '.codex-stage', `installer-upgrade-${Date.now()}`);
const guid = crypto.randomUUID();
const fixtureName = `agy-hub-upgrade-fixture-${guid}`;
const project = path.join(work, 'project');
const installKey = `HKCU\\Software\\${guid}`;
const uninstallKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${guid}`;
const exeName = 'AGY Hub Upgrade Fixture.exe';
const payload = path.join(work, 'payload');
const installDir = path.join(work, '安装 test');
const otherDir = path.join(work, 'other');
const report = { guid, work, cases: [] };
const children = [];
const log = path.join(work, 'builder.log');
fs.mkdirSync(payload, { recursive: true });
fs.mkdirSync(path.join(payload, 'resources'), { recursive: true });
fs.mkdirSync(project, { recursive: true });
fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
  name: fixtureName, version, description: 'Isolated NSIS upgrade regression test', author: 'AGY Hub',
  devDependencies: { electron: require(path.join(root, 'node_modules/electron/package.json')).version }
}));
fs.mkdirSync(otherDir, { recursive: true });

function run(file, args, options = {}) {
  return execFileSync(file, args, { cwd: root, windowsHide: true, encoding: 'utf8', ...options });
}
function regAdd(key, name, value) {
  run('reg.exe', ['add', key, '/v', name, '/t', 'REG_SZ', '/d', value, '/f', '/reg:64']);
}
function regQuery(key, name) {
  return spawnSync('reg.exe', ['query', key, '/v', name, '/reg:64'], { windowsHide: true, encoding: 'utf8' });
}
function cleanupRegistry() {
  for (const key of [installKey, uninstallKey]) {
    spawnSync('reg.exe', ['delete', key, '/f', '/reg:64'], { windowsHide: true });
  }
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function until(predicate, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for fixture process');
    await wait(100);
  }
}
async function install() {
  const started = Date.now();
  const child = spawn(path.join(work, 'out', 'fixture-setup.exe'), ['/S', `/D=${installDir}`], {
    windowsHide: true, windowsVerbatimArguments: true, stdio: 'ignore'
  });
  children.push(child);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // Only terminate this fixture installer, never a production application.
      child.kill();
      reject(new Error('Fixture installer timed out (possible retry dialog)'));
    }, 45000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`Fixture installer exit code ${code}`));
    });
  });
  assert.equal(fs.readFileSync(path.join(installDir, 'release.txt'), 'utf8'), 'new release');
  assert.ok(regQuery(uninstallKey, 'DisplayVersion').stdout.includes(version));
  assert.equal(fs.existsSync(path.join(installDir, 'old-uninstaller-ran.txt')), false,
    'In-place installation invoked the failing old uninstaller');
  return Date.now() - started;
}
function seed(version) {
  cleanupRegistry();
  fs.mkdirSync(installDir, { recursive: true });
  for (const name of ['quit.signal', 'graceful.txt', 'running.txt', 'ignore-graceful', 'old-uninstaller-ran.txt']) {
    fs.rmSync(path.join(installDir, name), { force: true });
  }
  fs.writeFileSync(path.join(installDir, 'release.txt'), 'old release');
  fs.copyFileSync(path.join(payload, exeName), path.join(installDir, exeName));
  fs.copyFileSync(path.join(work, 'bad-uninstaller.exe'), path.join(installDir, 'bad-uninstaller.exe'));
  fs.writeFileSync(path.join(installDir, 'keep-user-data.txt'), 'keep me');
  regAdd(installKey, 'InstallLocation', installDir);
  regAdd(uninstallKey, 'DisplayVersion', version);
  regAdd(uninstallKey, 'UninstallString', `"${path.join(installDir, 'bad-uninstaller.exe')}"`);
}
async function startFixture(directory) {
  fs.copyFileSync(path.join(payload, exeName), path.join(directory, exeName));
  const child = spawn(path.join(directory, exeName), [], { windowsHide: true, stdio: 'ignore' });
  children.push(child);
  await until(() => fs.existsSync(path.join(directory, 'running.txt')));
  return child;
}
async function main() {
  const source = path.join(work, 'Fixture.cs');
  fs.writeFileSync(source, `using System; using System.IO; using System.Threading;
class Fixture { static int Main(string[] args) {
  string dir = AppDomain.CurrentDomain.BaseDirectory;
  if (Path.GetFileName(Environment.GetCommandLineArgs()[0]) == "bad-uninstaller.exe") {
    // electron-builder copies the executable to its temporary plugin directory.
    foreach (string arg in args) if (arg.StartsWith("_?=")) dir = arg.Substring(3);
    File.WriteAllText(Path.Combine(dir, "old-uninstaller-ran.txt"), "failed"); return 19;
  }
  if (Array.IndexOf(args, "--quit-for-update") >= 0) {
    File.WriteAllText(Path.Combine(dir, "graceful.txt"), "requested");
    if (!File.Exists(Path.Combine(dir, "ignore-graceful"))) File.WriteAllText(Path.Combine(dir, "quit.signal"), "quit");
    return 0;
  }
  File.WriteAllText(Path.Combine(dir, "running.txt"), "running");
  while (!File.Exists(Path.Combine(dir, "quit.signal"))) Thread.Sleep(50);
  return 0;
} }`);
  const compiler = path.join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  run(compiler, ['/nologo', '/target:winexe', `/out:${path.join(payload, exeName)}`, source]);
  fs.copyFileSync(path.join(payload, exeName), path.join(work, 'bad-uninstaller.exe'));
  fs.writeFileSync(path.join(payload, 'release.txt'), 'new release');
  const config = {
    extends: null, appId: `com.agy.installer-fixture.${guid}`, productName: 'AGY Hub Upgrade Fixture',
    directories: { output: path.join(work, 'out') },
    win: { target: ['nsis'], signAndEditExecutable: false },
    nsis: {
      guid, artifactName: 'fixture-setup.exe', oneClick: false, perMachine: false,
      allowToChangeInstallationDirectory: true, runAfterFinish: false,
      createDesktopShortcut: false, createStartMenuShortcut: false,
      include: path.join(root, 'build/installer.nsh')
    }
  };
  const configFile = path.join(work, 'builder.json');
  fs.writeFileSync(configFile, JSON.stringify(config));
  const fd = fs.openSync(log, 'w');
  try {
    run(process.execPath, [path.join(root, 'node_modules/electron-builder/cli.js'),
      '--projectDir', project, '--prepackaged', payload, '--win', 'nsis', '--publish', 'never', '--config', configFile],
    { stdio: ['ignore', fd, fd], timeout: 180000 });
  } finally { fs.closeSync(fd); }

  cleanupRegistry();
  report.cases.push({ name: 'clean install', ms: await install() });
  for (const oldVersion of ['1.3.8', version, '9.9.9']) {
    seed(oldVersion);
    report.cases.push({ name: `in-place ${oldVersion} (failing old uninstaller)`, ms: await install() });
    assert.equal(fs.readFileSync(path.join(installDir, 'keep-user-data.txt'), 'utf8'), 'keep me');
  }
  for (const force of [false, true]) {
    seed('1.3.8');
    if (force) fs.writeFileSync(path.join(installDir, 'ignore-graceful'), 'ignore');
    const app = await startFixture(installDir);
    const other = await startFixture(otherDir);
    const ms = await install();
    await until(() => app.exitCode !== null || app.signalCode !== null);
    assert.equal(fs.existsSync(path.join(installDir, 'graceful.txt')), true);
    assert.equal(other.exitCode, null, 'Installer closed another installation with the same executable name');
    assert.equal(other.signalCode, null);
    fs.writeFileSync(path.join(otherDir, 'quit.signal'), 'quit');
    await until(() => other.exitCode !== null);
    for (const name of ['running.txt', 'quit.signal']) fs.rmSync(path.join(otherDir, name), { force: true });
    report.cases.push({ name: force ? 'force-close fallback + other directory preserved' : 'graceful auto-close + other directory preserved', ms });
  }
  report.ok = true;
}
main().catch(error => { report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
  cleanupRegistry();
  report.registryCleaned = regQuery(installKey, 'InstallLocation').status !== 0 && regQuery(uninstallKey, 'DisplayVersion').status !== 0;
  const cacheDir = path.join(process.env.LOCALAPPDATA, `${fixtureName}-updater`);
  const cachedInstaller = path.join(cacheDir, 'installer.exe');
  if (fs.existsSync(cachedInstaller)) fs.unlinkSync(cachedInstaller);
  if (fs.existsSync(cacheDir) && fs.readdirSync(cacheDir).length === 0) fs.rmdirSync(cacheDir);
  report.cacheCleaned = !fs.existsSync(cacheDir);
  fs.writeFileSync(path.join(work, 'report.json'), JSON.stringify(report, null, 2));
  if (report.ok) fs.copyFileSync(path.join(work, 'report.json'), path.join(root, '.codex-stage/installer-upgrade-report.json'));
  console.log(JSON.stringify(report, null, 2));
});
