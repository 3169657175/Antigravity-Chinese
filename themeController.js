(function exposeThemeController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyThemeController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createThemeController() {
  let activeThemeId = 'native';

async function init(dependencies = {}) {
  const { scheduleAfterPaint, logToTerminal = () => {} } = dependencies;
  const grid = document.getElementById('theme-grid');
  const statusTitle = document.getElementById('theme-status-title');
  const disableButton = document.getElementById('btn-disable-theme');
  const createButton = document.getElementById('btn-create-theme');
  const modal = document.getElementById('theme-editor-modal');
  const modalTitle = document.getElementById('theme-editor-title');
  const modalSubtitle = document.getElementById('theme-editor-subtitle');
  const modalPreview = document.getElementById('theme-editor-preview');
  const modalMessage = document.getElementById('theme-editor-message');
  const nameField = document.getElementById('theme-name-field');
  const nameInput = document.getElementById('input-theme-name');
  const paletteList = document.getElementById('theme-palette-list');
  const pickImageButton = document.getElementById('btn-pick-theme-image');
  const saveButton = document.getElementById('btn-save-theme-editor');
  const resetImageButton = document.getElementById('btn-reset-theme-image');
  const deleteButton = document.getElementById('btn-delete-custom-theme');
  if (!grid || !statusTitle || !disableButton || !createButton || !modal) return;

  let themes = [];
  let palettes = [];
  let editorState = null;
  const warmedThemePreviews = new Set();

  const prewarmThemePreviews = (items) => {
    const pending = items.filter(theme => theme.previewDataUrl && !warmedThemePreviews.has(theme.id));
    if (!pending.length) return;
    scheduleAfterPaint(async () => {
      await Promise.allSettled(pending.map(async theme => {
        const image = new Image();
        image.decoding = 'async';
        image.src = theme.previewDataUrl;
        if (typeof image.decode === 'function') await image.decode();
        warmedThemePreviews.add(theme.id);
      }));
    }, 1200);
  };

  const setBusy = (busy) => {
    grid.classList.toggle('is-busy', busy);
    disableButton.disabled = busy;
    createButton.disabled = busy;
  };

  const updateActiveState = (active) => {
    activeThemeId = active && active.enabled ? (active.sourceThemeId || active.id) : 'native';
    const selected = themes.find(theme => theme.id === activeThemeId);
    statusTitle.textContent = selected ? `当前主题：${selected.name}` : '当前主题：Antigravity 原生';
    grid.querySelectorAll('.theme-card').forEach(card => {
      const isActive = card.dataset.themeId === activeThemeId;
      card.classList.toggle('active', isActive);
      const button = card.querySelector('.theme-apply-button');
      if (button) button.textContent = isActive ? '正在使用' : '一键应用';
    });
  };

  const renderThemes = (nextThemes, active) => {
    themes = nextThemes;
    grid.innerHTML = '';
    for (const theme of themes) {
      const card = document.createElement('article');
      card.className = 'theme-card';
      card.dataset.themeId = theme.id;
      card.style.setProperty('--theme-accent', theme.accent || '#6ee7f9');

      const preview = document.createElement('div');
      preview.className = 'theme-preview';
      if (theme.previewDataUrl) preview.style.backgroundImage = `url("${theme.previewDataUrl}")`;

      const activeBadge = document.createElement('span');
      activeBadge.className = 'theme-active-badge';
      activeBadge.textContent = '已启用';
      preview.appendChild(activeBadge);

      if (theme.kind === 'custom' || theme.isCustomized) {
        const kindBadge = document.createElement('span');
        kindBadge.className = 'theme-kind-badge';
        kindBadge.textContent = theme.kind === 'custom' ? '自定义' : '已换图';
        preview.appendChild(kindBadge);
      }

      const body = document.createElement('div');
      body.className = 'theme-card-body';
      const heading = document.createElement('h3');
      heading.textContent = theme.name;
      const description = document.createElement('p');
      description.textContent = theme.description || 'Antigravity 专属主题';
      const button = document.createElement('button');
      button.className = 'theme-apply-button';
      button.type = 'button';
      button.textContent = '一键应用';
      button.addEventListener('click', async () => {
        setBusy(true);
        button.textContent = '正在应用…';
        try {
          const result = await window.agyHubAPI.setActiveTheme(theme.id);
          if (!result || !result.success) throw new Error(result?.error || '应用失败');
          updateActiveState(result.active);
          logToTerminal(`[Theme] 已切换为 ${theme.name}，Antigravity 将自动热加载。`);
        } catch (error) {
          button.textContent = '重试';
          logToTerminal(`[Theme] ${error.message}`, 'error');
        } finally {
          setBusy(false);
        }
      });
      const editButton = document.createElement('button');
      editButton.className = 'theme-edit-button';
      editButton.type = 'button';
      editButton.textContent = '编辑皮肤';
      editButton.addEventListener('click', () => openEditor(theme));
      const actions = document.createElement('div');
      actions.className = 'theme-card-actions';
      actions.append(button, editButton);
      body.append(heading, description, actions);
      card.append(preview, body);
      grid.appendChild(card);
    }
    updateActiveState(active);
    prewarmThemePreviews(themes);
  };

  const renderPaletteChoices = () => {
    paletteList.innerHTML = '';
    for (const palette of palettes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-palette-choice';
      button.style.setProperty('--palette-accent', palette.accent);
      button.dataset.paletteId = palette.id;
      button.innerHTML = '<span class="swatch"></span><span></span><span class="check">✓</span>';
      button.children[1].textContent = `${palette.name}色调`;
      button.classList.toggle('active', editorState && editorState.paletteId === palette.id);
      button.disabled = Boolean(editorState && editorState.kind === 'builtin');
      button.addEventListener('click', () => {
        if (!editorState || editorState.kind === 'builtin') return;
        editorState.paletteId = palette.id;
        paletteList.querySelectorAll('.theme-palette-choice').forEach(choice => {
          choice.classList.toggle('active', choice.dataset.paletteId === palette.id);
        });
      });
      paletteList.appendChild(button);
    }
  };

  const setEditorPreview = (dataUrl) => {
    modalPreview.classList.toggle('has-image', Boolean(dataUrl));
    modalPreview.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
  };

  const closeEditor = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    editorState = null;
    modalMessage.textContent = '';
  };

  function openEditor(theme = null) {
    const isCreate = !theme;
    editorState = {
      create: isCreate,
      themeId: theme ? theme.id : '',
      kind: theme ? theme.kind : 'custom',
      paletteId: theme ? (theme.paletteId || theme.id) : (palettes[0] && palettes[0].id),
      imagePath: '',
      previewDataUrl: theme ? theme.previewDataUrl : ''
    };
    modalTitle.textContent = isCreate ? '自定义皮肤' : `编辑「${theme.name}」`;
    modalSubtitle.textContent = isCreate
      ? '上传一张壁纸，再选择与界面搭配的整体色调。'
      : theme.kind === 'builtin'
        ? '替换壁纸图片，原有的按钮、侧栏和卡片色调保持不变。'
        : '可以替换壁纸，也可以重新选择整体色调。';
    nameField.hidden = Boolean(theme && theme.kind === 'builtin');
    nameInput.value = theme && theme.kind === 'custom' ? theme.name : '';
    resetImageButton.hidden = !(theme && theme.kind === 'builtin' && theme.isCustomized);
    deleteButton.hidden = !(theme && theme.kind === 'custom');
    saveButton.textContent = isCreate ? '创建并保存' : '保存修改';
    pickImageButton.textContent = theme ? '更换图片' : '选择图片';
    modalMessage.textContent = '';
    setEditorPreview(editorState.previewDataUrl);
    renderPaletteChoices();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (!nameField.hidden) setTimeout(() => nameInput.focus(), 80);
  }

  const reloadThemes = async (preferredActive = null) => {
    const result = await window.agyHubAPI.listThemes();
    if (!result || !result.success) throw new Error(result?.error || '主题资源读取失败');
    palettes = result.palettes || [];
    renderThemes(result.themes || [], preferredActive || result.active || { enabled: false, id: 'native' });
  };

  createButton.addEventListener('click', () => openEditor());
  document.getElementById('btn-close-theme-editor').addEventListener('click', closeEditor);
  document.getElementById('btn-cancel-theme-editor').addEventListener('click', closeEditor);
  modal.querySelector('[data-theme-editor-close]').addEventListener('click', closeEditor);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeEditor();
  });

  pickImageButton.addEventListener('click', async () => {
    modalMessage.textContent = '';
    const result = await window.agyHubAPI.pickThemeImage();
    if (!result || !result.success) {
      modalMessage.textContent = result?.error || '图片选择失败';
      return;
    }
    if (result.canceled) return;
    editorState.imagePath = result.filePath;
    editorState.previewDataUrl = result.previewDataUrl;
    setEditorPreview(result.previewDataUrl);
    pickImageButton.textContent = '重新选择';
  });

  saveButton.addEventListener('click', async () => {
    if (!editorState) return;
    if ((editorState.create || editorState.kind === 'builtin') && !editorState.imagePath) {
      modalMessage.textContent = editorState.create ? '请先选择一张主题图片。' : '请选择一张新的壁纸图片。';
      return;
    }
    saveButton.disabled = true;
    modalMessage.textContent = '';
    try {
      const result = await window.agyHubAPI.saveThemeDesign({
        create: editorState.create,
        themeId: editorState.themeId,
        name: nameInput.value,
        paletteId: editorState.paletteId,
        imagePath: editorState.imagePath
      });
      if (!result || !result.success) throw new Error(result?.error || '皮肤保存失败');
      renderThemes(result.themes || [], result.active || { enabled: false, id: 'native' });
      logToTerminal(`[Theme Studio] ${editorState.create ? '已创建' : '已更新'}皮肤：${result.theme.name}`);
      closeEditor();
    } catch (error) {
      modalMessage.textContent = error.message;
    } finally {
      saveButton.disabled = false;
    }
  });

  resetImageButton.addEventListener('click', async () => {
    if (!editorState || editorState.kind !== 'builtin') return;
    resetImageButton.disabled = true;
    try {
      const result = await window.agyHubAPI.resetThemeImage(editorState.themeId);
      if (!result || !result.success) throw new Error(result?.error || '恢复默认图片失败');
      renderThemes(result.themes || [], result.active || { enabled: false, id: 'native' });
      logToTerminal('[Theme Studio] 已恢复内置皮肤的默认图片。');
      closeEditor();
    } catch (error) {
      modalMessage.textContent = error.message;
    } finally {
      resetImageButton.disabled = false;
    }
  });

  deleteButton.addEventListener('click', async () => {
    if (!editorState || editorState.kind !== 'custom') return;
    if (!window.confirm('确定删除这个自定义皮肤吗？此操作不会删除你原始上传的图片。')) return;
    deleteButton.disabled = true;
    try {
      const result = await window.agyHubAPI.deleteCustomTheme(editorState.themeId);
      if (!result || !result.success) throw new Error(result?.error || '删除失败');
      renderThemes(result.themes || [], result.active || { enabled: false, id: 'native' });
      logToTerminal('[Theme Studio] 已删除自定义皮肤。');
      closeEditor();
    } catch (error) {
      modalMessage.textContent = error.message;
    } finally {
      deleteButton.disabled = false;
    }
  });

  disableButton.addEventListener('click', async () => {
    setBusy(true);
    try {
      const result = await window.agyHubAPI.disableTheme();
      if (!result || !result.success) throw new Error(result?.error || '恢复失败');
      updateActiveState(result.active);
      logToTerminal('[Theme] 已恢复 Antigravity 原生主题。');
    } catch (error) {
      logToTerminal(`[Theme] ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  });

  try {
    await reloadThemes();
  } catch (error) {
    grid.innerHTML = `<div class="theme-loading theme-error">${error.message}</div>`;
    statusTitle.textContent = '主题管理器加载失败';
    logToTerminal(`[Theme] ${error.message}`, 'error');
  }

  // 监听来自 Antigravity 软件的主题变更事件，实现双向秒同步
  if (window.agyHubAPI.onThemeChanged) {
    window.agyHubAPI.onThemeChanged(async (activeConfig) => {
      try {
        await reloadThemes(activeConfig || { enabled: false, id: 'native' });
        logToTerminal(`[Theme] 检测到客户端同步更改主题，当前已自适应激活：${activeConfig.name || '原生主题'}`);
      } catch (err) {
        console.error('Failed to sync external theme change:', err);
      }
    });
  }
}


  return { init };
});
