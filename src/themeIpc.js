const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const AGY_THEME_CATALOG = [
  { id: 'doraemon', name: '哆啦A梦', file: '哆啦A梦.png', accent: '#3ba5fc', overlay: 0.18, position: 'center center', description: '蓝天白云与哆啦A梦，明快清爽。' },
  { id: 'shinchan', name: '蜡笔小新', file: '蜡笔小新.jpg', accent: '#fbd160', overlay: 0.16, position: 'center center', description: '樱花、蓝天、公园与小新小白，明快而不杂乱。' },
  { id: 'line-dog', name: '线条小狗', file: '线条小狗.png', accent: '#52c49c', overlay: 0.14, position: 'center center', description: '晴空草地与野餐小狗，温暖安静。' },
  { id: 'one-piece', name: '海贼王', file: '海贼王.png', accent: '#fca240', overlay: 0.20, position: 'center center', description: '草帽团共望日落海面，完整群像与克制暖色。' },
  { id: 'fox-spirit', name: '狐妖小红娘', file: '狐妖小红娘.png', accent: '#f06c8b', overlay: 0.18, position: 'center center', description: '苏苏坐在樱花草地，主体靠右且留白充足。' }
];

function getAgyThemePaths() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const configDir = path.join(appData, 'Antigravity');
  return {
    configDir,
    assetsDir: path.join(configDir, 'agy-themes'),
    customAssetsDir: path.join(configDir, 'agy-themes', 'custom'),
    configFile: path.join(configDir, 'agy-theme.json'),
    libraryFile: path.join(configDir, 'agy-theme-library.json')
  };
}

function readAgyThemeLibrary() {
  const paths = getAgyThemePaths();
  try {
    const value = JSON.parse(fs.readFileSync(paths.libraryFile, 'utf8'));
    return {
      version: 1,
      overrides: value && typeof value.overrides === 'object' ? value.overrides : {},
      customs: Array.isArray(value && value.customs) ? value.customs : []
    };
  } catch (_) {
    return { version: 1, overrides: {}, customs: [] };
  }
}

function writeAgyThemeLibrary(library) {
  const paths = getAgyThemePaths();
  fs.mkdirSync(paths.configDir, { recursive: true });
  const temporary = `${paths.libraryFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({
    version: 1,
    overrides: library.overrides || {},
    customs: Array.isArray(library.customs) ? library.customs : []
  }, null, 2), 'utf8');
  fs.renameSync(temporary, paths.libraryFile);
  return library;
}

function getImageMime(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function imageToDataUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  return `data:${getImageMime(filePath)};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function validateThemeImage(filePath) {
  if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
    throw new Error('请选择有效的主题图片');
  }
  const extension = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
    throw new Error('仅支持 JPG、PNG 或 WebP 图片');
  }
  const size = fs.statSync(filePath).size;
  if (size <= 0 || size > 40 * 1024 * 1024) {
    throw new Error('图片大小必须在 40MB 以内');
  }
  return extension;
}

function resolveThemeLibraryItems() {
  const paths = getAgyThemePaths();
  const library = readAgyThemeLibrary();
  const builtins = AGY_THEME_CATALOG.map(theme => {
    const override = library.overrides[theme.id];
    const overridePath = override && override.imageFile
      ? path.join(paths.customAssetsDir, override.imageFile)
      : '';
    const installedPath = path.join(paths.assetsDir, theme.file);
    const imagePath = overridePath && fs.existsSync(overridePath)
      ? overridePath
      : fs.existsSync(installedPath)
        ? installedPath
        : findBundledThemeFile(theme.file);
    return {
      ...theme,
      kind: 'builtin',
      paletteId: theme.id,
      imagePath,
      isCustomized: Boolean(overridePath && fs.existsSync(overridePath)),
      previewDataUrl: imageToDataUrl(imagePath)
    };
  });
  const customs = library.customs.map(item => {
    const palette = AGY_THEME_CATALOG.find(theme => theme.id === item.paletteId) || AGY_THEME_CATALOG[0];
    const imagePath = item.imageFile ? path.join(paths.customAssetsDir, item.imageFile) : '';
    return {
      id: item.id,
      name: item.name,
      kind: 'custom',
      paletteId: palette.id,
      paletteName: palette.name,
      accent: palette.accent,
      overlay: palette.overlay,
      position: palette.position,
      description: `自定义壁纸 · ${palette.name}色调`,
      imagePath,
      previewDataUrl: imageToDataUrl(imagePath),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }).filter(item => item.previewDataUrl);
  return { library, themes: [...builtins, ...customs] };
}

function findBundledThemeFile(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  const candidates = [
    path.join(__dirname, '..', 'assets', 'themes', fileName),
    path.join(process.resourcesPath || '', 'assets', 'themes', fileName),
    path.join(os.homedir(), 'Desktop', 'antigravity换皮', fileName),
    path.join(os.homedir(), 'Desktop', 'antigravity换皮', 'themes', fileName)
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function installAgyThemeAssets() {
  const paths = getAgyThemePaths();
  fs.mkdirSync(paths.assetsDir, { recursive: true });
  const allowed = new Set(AGY_THEME_CATALOG.map(theme => theme.file));
  for (const entry of fs.readdirSync(paths.assetsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(extension) && !allowed.has(entry.name)) {
      fs.unlinkSync(path.join(paths.assetsDir, entry.name));
    }
  }
  for (const theme of AGY_THEME_CATALOG) {
    const source = findBundledThemeFile(theme.file);
    if (!source) continue;
    const destination = path.join(paths.assetsDir, theme.file);
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    const destinationHash = fs.existsSync(destination)
      ? crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex')
      : '';
    if (sourceHash !== destinationHash) {
      fs.copyFileSync(source, destination);
    }
  }
  return paths;
}

function readAgyThemeConfig() {
  const paths = getAgyThemePaths();
  try {
    return JSON.parse(fs.readFileSync(paths.configFile, 'utf8'));
  } catch (_) {
    return { version: 1, enabled: false, id: 'native' };
  }
}

function writeAgyThemeConfig(config) {
  const paths = getAgyThemePaths();
  fs.mkdirSync(paths.configDir, { recursive: true });
  const temporary = `${paths.configFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(temporary, paths.configFile);
  return config;
}

function activateResolvedTheme(theme) {
  if (!theme || !theme.imagePath || !fs.existsSync(theme.imagePath)) {
    throw new Error('主题图片不存在，请重新选择图片');
  }
  const isCustom = theme.kind === 'custom';
  return writeAgyThemeConfig({
    version: 1,
    enabled: true,
    id: isCustom ? theme.paletteId : theme.id,
    sourceThemeId: isCustom ? theme.id : undefined,
    isCustom,
    name: theme.name,
    imagePath: theme.imagePath,
    accent: theme.accent,
    overlay: theme.overlay,
    backgroundPosition: theme.position,
    updatedAt: new Date().toISOString()
  });
}

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SKILL_CATALOG_BASE = 'https://raw.githubusercontent.com/sickn33/agentic-awesome-skills/refs/heads/main';


function registerThemeIpc(options) {
  const { ipcMain, dialog, getMainWindow } = options;

ipcMain.handle('list-themes', async () => {
    try {
      installAgyThemeAssets();
      const { themes } = resolveThemeLibraryItems();
      return {
        success: true,
        themes,
        palettes: AGY_THEME_CATALOG.map(({ id, name, accent }) => ({ id, name, accent })),
        active: readAgyThemeConfig()
      };
    } catch (error) {
      return { success: false, error: error.message, themes: [], active: { enabled: false, id: 'native' } };
    }
  });
  
  ipcMain.handle('get-active-theme', async () => ({ success: true, active: readAgyThemeConfig() }));
  
  ipcMain.handle('pick-theme-image', async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        title: '选择 Antigravity 主题图片',
        properties: ['openFile'],
        filters: [{ name: '主题图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
      });
      if (result.canceled || !result.filePaths[0]) return { success: true, canceled: true };
      const filePath = result.filePaths[0];
      validateThemeImage(filePath);
      return {
        success: true,
        canceled: false,
        filePath,
        fileName: path.basename(filePath),
        previewDataUrl: imageToDataUrl(filePath)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('save-theme-design', async (_event, payload = {}) => {
    try {
      installAgyThemeAssets();
      const paths = getAgyThemePaths();
      fs.mkdirSync(paths.customAssetsDir, { recursive: true });
      const library = readAgyThemeLibrary();
      const now = new Date().toISOString();
      const selectedImagePath = typeof payload.imagePath === 'string' ? payload.imagePath : '';
      let savedThemeId = String(payload.themeId || '');
  
      if (payload.create) {
        const palette = AGY_THEME_CATALOG.find(theme => theme.id === payload.paletteId);
        if (!palette) throw new Error('请选择一种主题色调');
        const extension = validateThemeImage(selectedImagePath);
        const name = String(payload.name || '').trim().slice(0, 30) || '我的自定义皮肤';
        savedThemeId = `custom-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
        const imageFile = `${savedThemeId}${extension}`;
        fs.copyFileSync(selectedImagePath, path.join(paths.customAssetsDir, imageFile));
        library.customs.push({
          id: savedThemeId,
          name,
          paletteId: palette.id,
          imageFile,
          createdAt: now,
          updatedAt: now
        });
      } else {
        const builtin = AGY_THEME_CATALOG.find(theme => theme.id === savedThemeId);
        const custom = library.customs.find(theme => theme.id === savedThemeId);
        if (!builtin && !custom) throw new Error('找不到需要编辑的皮肤');
  
        if (selectedImagePath) {
          const extension = validateThemeImage(selectedImagePath);
          const previousFile = builtin
            ? library.overrides[builtin.id] && library.overrides[builtin.id].imageFile
            : custom.imageFile;
          const imageFile = `${builtin ? `builtin-${builtin.id}` : custom.id}-${Date.now().toString(36)}${extension}`;
          fs.copyFileSync(selectedImagePath, path.join(paths.customAssetsDir, imageFile));
          if (previousFile) {
            const previousPath = path.join(paths.customAssetsDir, previousFile);
            if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
          }
          if (builtin) library.overrides[builtin.id] = { imageFile, updatedAt: now };
          else custom.imageFile = imageFile;
        }
  
        if (custom) {
          const palette = AGY_THEME_CATALOG.find(theme => theme.id === payload.paletteId);
          if (!palette) throw new Error('请选择一种主题色调');
          custom.name = String(payload.name || custom.name).trim().slice(0, 30) || custom.name;
          custom.paletteId = palette.id;
          custom.updatedAt = now;
        }
      }
  
      writeAgyThemeLibrary(library);
      const { themes } = resolveThemeLibraryItems();
      const savedTheme = themes.find(theme => theme.id === savedThemeId);
      if (!savedTheme) throw new Error('皮肤保存后无法读取');
      const current = readAgyThemeConfig();
      const currentSourceId = current.sourceThemeId || current.id;
      const active = current.enabled && currentSourceId === savedThemeId
        ? activateResolvedTheme(savedTheme)
        : current;
      return { success: true, theme: savedTheme, themes, active };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('reset-theme-image', async (_event, themeId) => {
    try {
      const builtin = AGY_THEME_CATALOG.find(theme => theme.id === themeId);
      if (!builtin) throw new Error('只有内置皮肤可以恢复默认图片');
      const paths = getAgyThemePaths();
      const library = readAgyThemeLibrary();
      const override = library.overrides[builtin.id];
      if (override && override.imageFile) {
        const overridePath = path.join(paths.customAssetsDir, override.imageFile);
        if (fs.existsSync(overridePath)) fs.unlinkSync(overridePath);
      }
      delete library.overrides[builtin.id];
      writeAgyThemeLibrary(library);
      const { themes } = resolveThemeLibraryItems();
      const theme = themes.find(item => item.id === themeId);
      const current = readAgyThemeConfig();
      const active = current.enabled && (current.sourceThemeId || current.id) === themeId
        ? activateResolvedTheme(theme)
        : current;
      return { success: true, themes, active };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('delete-custom-theme', async (_event, themeId) => {
    try {
      const paths = getAgyThemePaths();
      const library = readAgyThemeLibrary();
      const index = library.customs.findIndex(theme => theme.id === themeId);
      if (index < 0) throw new Error('找不到该自定义皮肤');
      const [removed] = library.customs.splice(index, 1);
      if (removed.imageFile) {
        const imagePath = path.join(paths.customAssetsDir, removed.imageFile);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
      writeAgyThemeLibrary(library);
      const current = readAgyThemeConfig();
      const wasActive = current.enabled && current.sourceThemeId === themeId;
      const active = wasActive
        ? writeAgyThemeConfig({ version: 1, enabled: false, id: 'native', name: '原生主题', updatedAt: new Date().toISOString() })
        : current;
      return { success: true, themes: resolveThemeLibraryItems().themes, active };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('set-active-theme', async (_event, themeId) => {
    try {
      installAgyThemeAssets();
      const { themes } = resolveThemeLibraryItems();
      const theme = themes.find(item => item.id === themeId);
      if (!theme) throw new Error('未知主题');
      const active = activateResolvedTheme(theme);
      return { success: true, active, configFile: getAgyThemePaths().configFile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('disable-theme', async () => {
    try {
      const current = readAgyThemeConfig();
      const active = writeAgyThemeConfig({ ...current, enabled: false, id: 'native', name: '原生主题', updatedAt: new Date().toISOString() });
      return { success: true, active };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // 自动检测 Antigravity 安装路径
  
}

module.exports = { AGY_THEME_CATALOG, registerThemeIpc };
