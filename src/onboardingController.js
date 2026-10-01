(function exposeOnboardingController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyOnboardingController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createOnboardingController() {
  // v3 deliberately asks once again after the guide became feature-complete.
  const PROMPT_KEY = 'agy-hub:onboarding-prompt:v3';
  const allSteps = [
    {
      id: 'patch',
      title: '先确认 Antigravity 与汉化补丁',
      description: '小助手会识别 Antigravity 的 resources 目录。确认版本和路径后，再点击“注入中文汉化补丁”。首次注入会保存官方英文原版，后续只保留一个上一版汉化。',
      purpose: '这一步只负责汉化 Antigravity，不会修改 Codex、Claude Code 或任何反代配置。',
      targetTab: 'tab-patch', targetSelector: '#btn-install-patch'
    },
    {
      id: 'account',
      title: '添加 Antigravity 本地账号',
      description: '进入“本地账号”后通过官方授权添加账号。账号是 Antigravity 模型、额度读取和本地反代请求的身份来源；授权失效时，也在这里重新登录。',
      purpose: '没有可用账号时，8046 服务即使启动，也无法调用 Antigravity 模型。',
      // The local-account page remembers its last secondary tab. Explicitly restore the
      // account-management tab here so reopening the guide never highlights an invisible
      // "Add account" action behind the Token dashboard.
      targetTab: 'tab-local-accounts', openSelectors: ['#btn-la-tab-accounts'], targetSelector: '#btn-add-local-account'
    },
    {
      id: 'local-token',
      title: '查看本地账号 Token 监控大屏',
      description: '这里记录 Antigravity 本地会话的 Token 消耗、官方缓存命中率和最近调用。它与反代 Token 统计分开，方便判断额度消耗来自原生客户端还是 8046。',
      purpose: '监控页只读取和展示数据；“上游转发”仅用于本地监控识别请求来源，不会改变你的模型路由。',
      targetTab: 'tab-local-accounts', openSelectors: ['#btn-la-tab-token'], targetSelector: '#btn-la-tab-token'
    },
    {
      id: 'proxy-decision',
      title: '你需要配置反代接入吗？',
      description: '反代接入用于把 Antigravity 账号额度接入 Codex 或自定义 API Provider。如果你只需要汉化、账号、皮肤、MCP 和 Skill，可以直接跳过。',
      purpose: '选择“跳过反代”不会关闭服务、不会删除已有反代配置；本次引导会直接进入皮肤、MCP 与 Skill。',
      decision: 'proxy'
    },
    {
      id: 'gateway-start',
      requiresProxy: true,
      title: '启动并完成 8046 三级测试',
      description: '8046 是本地转换网关：它接收 Codex 请求或自定义 Provider 请求，再转换成 Antigravity Cloud Code 可识别的格式。先启动服务，再运行三级测试。',
      purpose: '测试成功只说明链路可用；只有点击“连接到 Codex”后，才会写入 Codex 配置。',
      targetTab: 'tab-codex-gateway', codexPage: 'overview', targetSelector: '#btn-codex-gateway-test'
    },
    {
      id: 'codex-connect',
      requiresProxy: true,
      title: '连接 Codex',
      description: '在 Codex 页选择账号和模型，三级测试通过后点击“连接到 Codex”。小助手会写入受管 Provider 配置，并保留恢复入口。',
      purpose: '这一步只影响 Codex 路由，不会覆盖 Claude Code 或自定义 Provider 的选择。',
      targetTab: 'tab-codex-gateway', codexPage: 'overview', targetSelector: '#btn-codex-gateway-connect'
    },
    {
      id: 'claude-connect',
      feature: 'claudeCodeGateway',
      requiresProxy: true,
      title: '按需接入 Claude Code',
      description: '切换到 Claude Code 页面，选择账号和真实模型，再执行接入。界面展示真实的 Antigravity 模型；8046 会在内部映射为 Claude Code 可识别的模型名。',
      purpose: '只有使用 Claude Code 桌面端时才需要这一步；不使用可以直接下一步。',
      targetTab: 'tab-codex-gateway', codexPage: 'claude', targetSelector: '#btn-claude-desktop-connect'
    },
    {
      id: 'provider-create',
      requiresProxy: true,
      title: '添加自定义 API Provider',
      description: '如有 Sub2API 或其他兼容中转站，在“自定义 API”页点击“添加 API”。先填写名称、URL、协议、认证和模型，再获取模型并进行三级测试。',
      purpose: '保存为配置卡片后才可以选择接入 Codex；仅测试不会切换当前正在使用的反代线路。',
      targetTab: 'tab-codex-gateway', codexPage: 'provider', targetSelector: '#btn-add-custom-provider'
    },
    {
      id: 'provider-auth',
      requiresProxy: true,
      title: '选择正确的 API 协议与认证方式',
      description: '协议必须与中转站真实接口一致：OpenAI Responses、Chat Completions、Anthropic Messages 或 Gemini Native。认证支持 Bearer、x-api-key、api-key、URL Query Key 与自定义 Header。',
      purpose: '这里只是打开未保存的配置编辑器供你查看。选择错误的协议或认证方式会导致测试失败，但不会影响 Antigravity、Codex 或 Claude Code 的既有配置。',
      targetTab: 'tab-codex-gateway', codexPage: 'provider', openSelectors: ['#btn-add-custom-provider'], targetSelector: '#codex-provider-auth-mode'
    },
    {
      id: 'theme',
      title: '应用或创建主题皮肤',
      description: '皮肤页可以一键应用内置皮肤，或点击“自定义皮肤”上传壁纸、命名并选择整体配色。保存后会同步到 Antigravity 用户目录。',
      purpose: '皮肤只改变 Antigravity 界面外观；不影响补丁、账号、Token、模型或反代服务。',
      targetTab: 'tab-themes', targetSelector: '#btn-create-theme'
    },
    {
      id: 'mcp',
      title: '从 MCP 插件市场扩展工具能力',
      description: 'MCP 市场提供推荐服务和已部署列表。首次安装会保存配置；“深度验证”会启动服务并执行握手，因此可能需要等待几秒。',
      purpose: '建议先安装真正需要的 MCP。深度验证失败通常说明本机依赖、网络或服务配置尚未就绪。',
      targetTab: 'tab-mcp', openSelectors: ['#btn-mcp-tab-market'], targetSelector: '#btn-refresh-mcp-status'
    },
    {
      id: 'skill-market',
      title: '在 Skill 市场按分类挑选技能',
      description: 'Skill 市场支持分类、搜索、页码、已安装筛选和 GitHub 社区仓库同步。先看技能简介和用途，再决定是否导入。',
      purpose: '技能会影响智能体的工作方法，不是普通插件；只安装你理解且确实需要的技能。',
      targetTab: 'tab-skill-market', targetSelector: '#btn-sync-github-skills'
    },
    {
      id: 'skill-translate',
      title: '补齐新增 Skill 的中文简介',
      description: '同步到新的英文 Skill 后，点击“翻译新增简介”。系统只处理新增或简介发生变化的条目，并把译文缓存到本地。',
      purpose: '翻译简介只影响市场展示，不会改写技能原始指令或你已经安装的 Skill 文件。',
      targetTab: 'tab-skill-market', targetSelector: '#btn-translate-skill-descriptions'
    },
    {
      id: 'skill-studio',
      title: '使用 Skill 工坊创建自己的技能',
      description: '在 Skill 工坊填写唯一英文标识、功能说明和核心指令，小助手会生成标准 SKILL.md 并写入官方目录。',
      purpose: '自定义 Skill 会影响后续对话的执行规则；创建前请明确它的适用范围和限制。',
      targetTab: 'tab-skills', targetSelector: '#btn-generate-skill'
    },
    {
      id: 'complete',
      title: '引导完成，随时可以再打开',
      description: '你已了解补丁、账号、Token 监控、反代接入、主题、MCP 与 Skill 的位置。遇到异常时，优先使用反代页的一键诊断和请求时间线。',
      purpose: '左下角“使用引导”仍会保留，方便你以后只复习某一项；本次选择不会自动修改配置。'
    }
  ];
  const steps = allSteps.filter(step => !step.feature || globalThis.AgyFeatureFlags?.enabled?.(step.feature));

  function isEditableTarget(target) {
    return target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function init() {
    const overlay = document.getElementById('guide-overlay');
    const dialog = document.getElementById('guide-dialog');
    const spotlight = document.getElementById('guide-spotlight');
    const openButton = document.getElementById('btn-open-guide');
    if (!overlay || !dialog || !openButton) return;
    const title = document.getElementById('guide-title');
    const eyebrow = document.getElementById('guide-eyebrow');
    const description = document.getElementById('guide-description');
    const purpose = document.getElementById('guide-purpose');
    const stepIndex = document.getElementById('guide-step-index');
    const progress = document.getElementById('guide-progress');
    const progressBar = document.getElementById('guide-progress-bar');
    const startButton = document.getElementById('btn-guide-start');
    const skipButton = document.getElementById('btn-guide-skip');
    const stepActions = document.getElementById('guide-step-actions');
    const decisionActions = document.getElementById('guide-decision-actions');
    const previousButton = document.getElementById('btn-guide-prev');
    const nextButton = document.getElementById('btn-guide-next');
    const decisionPreviousButton = document.getElementById('btn-guide-decision-prev');
    const proxySkipButton = document.getElementById('btn-guide-proxy-skip');
    const proxyStartButton = document.getElementById('btn-guide-proxy-start');
    let currentStep = -1;
    let proxyRequested = null;
    let highlighted = null;
    let positionTimer = null;
    let navigationTimer = null;
    let navigationRevision = 0;

    function visibleSteps() {
      return steps.filter(step => !step.requiresProxy || proxyRequested === true);
    }

    function activeStep() {
      return currentStep >= 0 ? visibleSteps()[currentStep] : null;
    }

    function clearHighlight() {
      highlighted?.classList.remove('guide-target-highlight');
      highlighted = null;
      if (spotlight) spotlight.hidden = true;
    }

    function positionDialog() {
      if (overlay.hidden || !overlay.classList.contains('is-wizard-mode')) return;
      const padding = 18;
      const gap = 24;
      const dialogRect = dialog.getBoundingClientRect();
      const width = dialogRect.width || Math.min(490, window.innerWidth - padding * 2);
      const height = dialogRect.height || 390;
      const maxLeft = Math.max(padding, window.innerWidth - width - padding);
      const maxTop = Math.max(padding, window.innerHeight - height - padding);
      const targetRect = highlighted?.getBoundingClientRect();
      if (!targetRect || window.innerWidth < 760) {
        dialog.style.setProperty('--guide-left', `${clamp((window.innerWidth - width) / 2, padding, maxLeft)}px`);
        dialog.style.setProperty('--guide-top', `${clamp((window.innerHeight - height) / 2, padding, maxTop)}px`);
        dialog.dataset.guidePlacement = 'center';
        return;
      }
      const candidates = [
        { placement: 'right', left: targetRect.right + gap, top: clamp(targetRect.top - 18, padding, maxTop) },
        { placement: 'left', left: targetRect.left - width - gap, top: clamp(targetRect.top - 18, padding, maxTop) },
        { placement: 'bottom', left: clamp(targetRect.left, padding, maxLeft), top: targetRect.bottom + gap },
        { placement: 'top', left: clamp(targetRect.left, padding, maxLeft), top: targetRect.top - height - gap }
      ];
      const selected = candidates.find(candidate => (
        candidate.left >= padding && candidate.top >= padding &&
        candidate.left + width <= window.innerWidth - padding &&
        candidate.top + height <= window.innerHeight - padding
      ));
      const fallback = selected || {
        placement: 'center',
        left: clamp((window.innerWidth - width) / 2, padding, maxLeft),
        top: clamp((window.innerHeight - height) / 2, padding, maxTop)
      };
      dialog.style.setProperty('--guide-left', `${fallback.left}px`);
      dialog.style.setProperty('--guide-top', `${fallback.top}px`);
      dialog.dataset.guidePlacement = fallback.placement;
      if (spotlight) {
        spotlight.hidden = false;
        spotlight.style.setProperty('--spotlight-left', `${Math.max(6, targetRect.left - 8)}px`);
        spotlight.style.setProperty('--spotlight-top', `${Math.max(6, targetRect.top - 8)}px`);
        spotlight.style.setProperty('--spotlight-width', `${targetRect.width + 16}px`);
        spotlight.style.setProperty('--spotlight-height', `${targetRect.height + 16}px`);
      }
    }

    function schedulePosition(delay = 0) {
      clearTimeout(positionTimer);
      positionTimer = setTimeout(() => requestAnimationFrame(positionDialog), delay);
    }

    function isElementFullyVisible(element) {
      const rect = element.getBoundingClientRect();
      const padding = 12;
      return (
        rect.top >= padding &&
        rect.left >= padding &&
        rect.bottom <= window.innerHeight - padding &&
        rect.right <= window.innerWidth - padding
      );
    }

    function navigate(step) {
      // renderStep() has already replaced the title, description, step number and progress
      // synchronously. Defer any potentially expensive page navigation until that new content
      // has had one paint, so "Next" never leaves the previous step frozen on screen.
      const revision = ++navigationRevision;
      clearTimeout(navigationTimer);
      clearHighlight();
      requestAnimationFrame(() => {
        navigationTimer = setTimeout(() => {
          if (revision !== navigationRevision || overlay.hidden) return;
          if (step.targetTab) document.querySelector(`.nav-item[data-target="${step.targetTab}"]`)?.click();
          if (step.codexPage) document.querySelector(`.codex-workspace-tab[data-codex-page="${step.codexPage}"]`)?.click();
          for (const selector of step.openSelectors || []) document.querySelector(selector)?.click();
          requestAnimationFrame(() => {
            if (revision !== navigationRevision || overlay.hidden) return;
            clearHighlight();
            highlighted = step.targetSelector ? document.querySelector(step.targetSelector) : null;
            if (highlighted) {
              highlighted.classList.add('guide-target-highlight');
              // Smooth scrolling extends the perceived delay. Only correct the viewport when
              // the target really is outside it, and make that correction immediate.
              if (!isElementFullyVisible(highlighted)) {
                highlighted.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
              }
            }
            positionDialog();
            // Let a newly opened secondary page finish layout without a human-visible delay.
            requestAnimationFrame(() => {
              if (revision === navigationRevision && !overlay.hidden) positionDialog();
            });
          });
        }, 0);
      });
    }

    function setPurpose(text, label = '这一步是做什么的') {
      purpose.replaceChildren();
      const purposeTitle = document.createElement('strong');
      purposeTitle.textContent = label;
      const purposeText = document.createElement('span');
      purposeText.textContent = text;
      purpose.append(purposeTitle, purposeText);
    }

    function renderStep() {
      const allVisibleSteps = visibleSteps();
      const step = allVisibleSteps[currentStep];
      if (!step) return;
      eyebrow.textContent = 'AGY Hub 使用引导';
      title.textContent = step.title;
      description.textContent = step.description;
      setPurpose(step.purpose);
      stepIndex.textContent = `第 ${currentStep + 1} 步，共 ${allVisibleSteps.length} 步`;
      progressBar.style.width = `${((currentStep + 1) / allVisibleSteps.length) * 100}%`;
      previousButton.disabled = currentStep === 0;
      decisionPreviousButton.disabled = currentStep === 0;
      nextButton.textContent = currentStep === allVisibleSteps.length - 1 ? '完成引导' : '下一步';
      const isDecision = step.decision === 'proxy';
      stepActions.hidden = isDecision;
      decisionActions.hidden = !isDecision;
      startButton.hidden = true;
      skipButton.hidden = true;
      navigate(step);
    }

    function showPrompt() {
      clearHighlight();
      currentStep = -1;
      proxyRequested = null;
      overlay.classList.remove('is-wizard-mode');
      overlay.hidden = false;
      eyebrow.textContent = '首次使用';
      title.textContent = '是否需要使用引导？';
      stepIndex.textContent = '首次打开时只询问一次';
      description.textContent = '引导会介绍汉化注入、本地账号、Token 监控、按需反代接入、皮肤、MCP 和 Skill。它只带你定位与说明，不会自动修改配置。';
      setPurpose('你可以按 Esc 随时退出；以后仍能从左下角“使用引导”重新打开。', '使用方式');
      progress.hidden = true;
      startButton.hidden = false;
      skipButton.hidden = false;
      stepActions.hidden = true;
      decisionActions.hidden = true;
      startButton.focus();
    }

    function startGuide() {
      localStorage.setItem(PROMPT_KEY, 'started');
      currentStep = 0;
      proxyRequested = null;
      overlay.classList.add('is-wizard-mode');
      overlay.hidden = false;
      progress.hidden = false;
      // The large start CTA belongs only to the first-run question, never to a running or manually reopened guide.
      startButton.hidden = true;
      skipButton.hidden = true;
      decisionActions.hidden = true;
      renderStep();
    }

    function chooseProxy(wantsProxy) {
      proxyRequested = wantsProxy;
      const targetId = wantsProxy ? 'gateway-start' : 'theme';
      currentStep = visibleSteps().findIndex(step => step.id === targetId);
      renderStep();
    }

    function move(delta) {
      const next = currentStep + delta;
      if (next < 0 || next >= visibleSteps().length) return;
      currentStep = next;
      renderStep();
    }

    function closeGuide(choice = 'dismissed') {
      if (currentStep < 0) localStorage.setItem(PROMPT_KEY, choice);
      clearHighlight();
      clearTimeout(positionTimer);
      clearTimeout(navigationTimer);
      navigationRevision += 1;
      overlay.hidden = true;
      overlay.classList.remove('is-wizard-mode');
      dialog.style.removeProperty('--guide-left');
      dialog.style.removeProperty('--guide-top');
      delete dialog.dataset.guidePlacement;
      currentStep = -1;
      proxyRequested = null;
    }

    openButton.addEventListener('click', startGuide);
    startButton.addEventListener('click', startGuide);
    skipButton.addEventListener('click', () => closeGuide('skipped'));
    document.getElementById('btn-close-guide')?.addEventListener('click', () => closeGuide());
    previousButton.addEventListener('click', () => move(-1));
    decisionPreviousButton.addEventListener('click', () => move(-1));
    proxySkipButton.addEventListener('click', () => chooseProxy(false));
    proxyStartButton.addEventListener('click', () => chooseProxy(true));
    nextButton.addEventListener('click', () => {
      if (currentStep >= visibleSteps().length - 1) {
        localStorage.setItem(PROMPT_KEY, 'completed');
        closeGuide('completed');
        return;
      }
      move(1);
    });
    document.addEventListener('keydown', event => {
      if (overlay.hidden) return;
      if (event.key === 'Escape') {
        closeGuide();
      } else if (!isEditableTarget(event.target) && event.key === 'ArrowLeft' && currentStep >= 0) {
        move(-1);
      } else if (!isEditableTarget(event.target) && event.key === 'ArrowRight' && currentStep >= 0 && !activeStep()?.decision) {
        nextButton.click();
      }
    });
    window.addEventListener('resize', () => schedulePosition());
    window.addEventListener('scroll', () => schedulePosition(), true);
    overlay.addEventListener('click', event => {
      if (event.target === overlay && !overlay.classList.contains('is-wizard-mode')) closeGuide();
    });

    if (!localStorage.getItem(PROMPT_KEY)) setTimeout(showPrompt, 650);
  }

  return { init, steps, PROMPT_KEY };
});
