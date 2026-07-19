// ==========================================================
// Antigravity Theme Engine V2 - state aware semantic theming
// ==========================================================
(function AntigravityThemeEngineV2() {
    const themeIpc = electron_1.ipcRenderer;
    const catalog = [
        {
            id: 'doraemon', name: '哆啦A梦', accent: '#3ba5fc', accentSoft: '#d8f2fb',
            warm: '#fff1c7', app: '#edf8f8', sidebar: 'rgba(233,247,247,.91)', content: 'rgba(248,252,250,.90)',
            dialog: 'rgba(250,253,252,.985)', input: 'rgba(255,255,255,.965)', text: '#17313a',
            muted: '#526d73', border: 'rgba(59,165,252,.20)', shadow: 'rgba(21,81,103,.18)', position: 'center center'
        },
        {
            id: 'shinchan', name: '蜡笔小新', accent: '#fbd160', accentSoft: '#fff0d0',
            warm: '#ffe6a8', app: '#f3f9ec', sidebar: 'rgba(243,249,235,.90)', content: 'rgba(250,253,246,.90)',
            dialog: 'rgba(253,254,250,.985)', input: 'rgba(255,255,252,.965)', text: '#283b36',
            muted: '#5f746c', border: 'rgba(251,209,96,.20)', shadow: 'rgba(38,76,56,.17)', position: 'center center'
        },
        {
            id: 'line-dog', name: '线条小狗', accent: '#52c49c', accentSoft: '#dff6e6',
            warm: '#fff3cf', app: '#eef9f4', sidebar: 'rgba(238,249,244,.91)', content: 'rgba(250,253,251,.90)',
            dialog: 'rgba(251,254,252,.988)', input: 'rgba(255,255,255,.97)', text: '#1f3932',
            muted: '#5a746c', border: 'rgba(82,196,156,.19)', shadow: 'rgba(27,91,69,.16)', position: 'center center'
        },
        {
            id: 'one-piece', name: '海贼王', accent: '#fca240', accentSoft: '#fff0cf',
            warm: '#ffe0a0', app: '#fbf3e5', sidebar: 'rgba(250,241,223,.91)', content: 'rgba(255,251,243,.91)',
            dialog: 'rgba(255,252,247,.988)', input: 'rgba(255,253,249,.97)', text: '#3d3026',
            muted: '#77665a', border: 'rgba(252,162,64,.22)', shadow: 'rgba(94,54,25,.18)', position: 'center center'
        },
        {
            id: 'fox-spirit', name: '狐妖小红娘', accent: '#f06c8b', accentSoft: '#fbe5e7',
            warm: '#ffe4bd', app: '#faf2f1', sidebar: 'rgba(249,239,238,.92)', content: 'rgba(254,249,248,.91)',
            dialog: 'rgba(255,251,250,.99)', input: 'rgba(255,252,251,.97)', text: '#442d32',
            muted: '#7b6066', border: 'rgba(240,108,139,.21)', shadow: 'rgba(92,42,50,.18)', position: 'center center'
        }
    ];
    let lastRevision = '';
    let activeImageKey = '';
    let semanticTimer = 0;
    let observer = null;

    function ensureStyle() {
        if (document.getElementById('agy-theme-engine-v2-style')) return;
        const style = document.createElement('style');
        style.id = 'agy-theme-engine-v2-style';
        style.textContent = `
          :root {
            --agy-accent: #319b73;
            --agy-accent-soft: #dff6e6;
            --agy-warm: #fff3cf;
            --agy-app: #eef9f4;
            --agy-sidebar: rgba(238,249,244,.91);
            --agy-content: rgba(250,253,251,.945);
            --agy-dialog: rgba(251,254,252,.988);
            --agy-input: rgba(255,255,255,.97);
            --agy-text: #1f3932;
            --agy-muted: #5a746c;
            --agy-border: rgba(49,155,115,.19);
            --agy-shadow: rgba(27,91,69,.16);
            --agy-wallpaper-position: center center;
          }
          #agy-theme-wallpaper-v2 {
            position: fixed;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            opacity: 0;
            background-size: cover;
            background-position: var(--agy-wallpaper-position);
            background-repeat: no-repeat;
            transition: opacity .3s ease, filter .3s ease;
          }
          #agy-theme-wallpaper-v2::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(105deg, rgba(246,250,248,.22) 0%, rgba(248,251,249,.08) 48%, rgba(250,252,250,.14) 100%);
            transition: background .3s ease;
          }
          html.agy-theme-active-v2 #root { position: relative; z-index: 1; }
          html.agy-theme-active-v2 #agy-theme-wallpaper-v2 { opacity: 1; }
          html.agy-theme-active-v2,
          html.agy-theme-active-v2 body,
          html.agy-theme-active-v2 [data-agy-surface="app"] { background: transparent !important; }
          html.agy-theme-active-v2,
          html.agy-theme-active-v2 body {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }

          html.agy-theme-active-v2[data-agy-view="new-chat"] #agy-theme-wallpaper-v2 { opacity: .96; filter: saturate(.98) brightness(1.01); }
          html.agy-theme-active-v2[data-agy-view="new-chat"] #agy-theme-wallpaper-v2::after {
            background: linear-gradient(105deg, rgba(249,252,250,.18) 0%, rgba(250,252,251,.03) 48%, rgba(250,252,251,.08) 100%);
          }
          html.agy-theme-active-v2[data-agy-view="conversation"] #agy-theme-wallpaper-v2 { opacity: .64; filter: saturate(.86) brightness(1.015); }
          html.agy-theme-active-v2[data-agy-view="conversation"] #agy-theme-wallpaper-v2::after { background: rgba(250,252,250,.10); }
          html.agy-theme-active-v2[data-agy-view="settings"] #agy-theme-wallpaper-v2,
          html.agy-theme-active[data-agy-view="settings"] #agy-theme-wallpaper-v2 { opacity: .65; filter: saturate(.85) brightness(1.02); }
          html.agy-theme-active-v2[data-agy-view="settings"] #agy-theme-wallpaper-v2::after,
          html.agy-theme-active[data-agy-view="settings"] #agy-theme-wallpaper-v2::after { background: rgba(250,252,250,.18); }
          html.agy-theme-active-v2[data-agy-view="review"] #agy-theme-wallpaper-v2 { opacity: .60; filter: saturate(.83) brightness(1.02); }
          html.agy-theme-active-v2[data-agy-view="review"] #agy-theme-wallpaper-v2::after { background: rgba(250,252,250,.12); }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"],
          html.agy-theme-active-v2 aside,
          html.agy-theme-active [data-agy-surface="sidebar"],
          html.agy-theme-active aside {
            color: var(--agy-text) !important;
            background: linear-gradient(155deg,
              color-mix(in srgb, var(--agy-warm) 74%, transparent) 0%,
              color-mix(in srgb, var(--agy-accent-soft) 68%, transparent) 46%,
              color-mix(in srgb, var(--agy-sidebar) 70%, transparent) 100%) !important;
            border-right: 1px solid var(--agy-border) !important;
            
            /* 霓虹发光光晕精准定位在最左侧外界边框 */
            border-left: 2.5px solid var(--agy-accent) !important;
            box-shadow: -10px 0 30px color-mix(in srgb, var(--agy-shadow) 42%, transparent) !important;
            
            backdrop-filter: blur(24px) saturate(1.12);
            transition: background .28s ease, backdrop-filter .28s ease, box-shadow .28s ease, border-color .28s ease;
          }
          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-surface="sidebar"],
          html.agy-theme-active-v2[data-agy-view="new-chat"] aside,
          html.agy-theme-active[data-agy-view="new-chat"] [data-agy-surface="sidebar"],
          html.agy-theme-active[data-agy-view="new-chat"] aside {
            background: linear-gradient(90deg,
              color-mix(in srgb, var(--agy-warm) 18%, transparent) 0%,
              color-mix(in srgb, var(--agy-accent-soft) 12%, transparent) 70%,
              color-mix(in srgb, var(--agy-accent) 22%, transparent) 100%) !important;
            border-left: 2.5px solid var(--agy-accent) !important;
            border-right: 1px solid var(--agy-border) !important;
            box-shadow: inset 14px 0 24px color-mix(in srgb, var(--agy-accent-soft) 46%, transparent),
              -8px 0 28px color-mix(in srgb, var(--agy-shadow) 34%, transparent) !important;
            backdrop-filter: blur(2px) saturate(.96);
          }
          html.agy-theme-active-v2[data-agy-view="conversation"] [data-agy-surface="sidebar"],
          html.agy-theme-active-v2[data-agy-view="conversation"] aside,
          html.agy-theme-active-v2[data-agy-view="review"] [data-agy-surface="sidebar"],
          html.agy-theme-active-v2[data-agy-view="review"] aside,
          html.agy-theme-active[data-agy-view="conversation"] [data-agy-surface="sidebar"],
          html.agy-theme-active[data-agy-view="review"] [data-agy-surface="sidebar"],
          html.agy-theme-active[data-agy-view="conversation"] aside,
          html.agy-theme-active[data-agy-view="review"] aside {
            background: linear-gradient(90deg,
              color-mix(in srgb, var(--agy-warm) 18%, transparent) 0%,
              color-mix(in srgb, var(--agy-accent-soft) 12%, transparent) 70%,
              color-mix(in srgb, var(--agy-accent) 22%, transparent) 100%) !important;
            border-left: 2.5px solid var(--agy-accent) !important;
            border-right: 1px solid var(--agy-border) !important;
            box-shadow: inset 14px 0 24px color-mix(in srgb, var(--agy-accent-soft) 46%, transparent),
              -8px 0 28px color-mix(in srgb, var(--agy-shadow) 34%, transparent) !important;
            backdrop-filter: blur(2px) saturate(.96);
          }
          html.agy-theme-active-v2 [data-agy-surface="main"],
          html.agy-theme-active [data-agy-surface="main"] {
            color: var(--agy-text) !important;
            transition: background .25s ease, box-shadow .25s ease;
          }
          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-surface="main"],
          html.agy-theme-active[data-agy-view="new-chat"] [data-agy-surface="main"] { background: transparent !important; }
          html.agy-theme-active-v2[data-agy-view="conversation"] [data-agy-surface="main"],
          html.agy-theme-active-v2[data-agy-view="review"] [data-agy-surface="main"],
          html.agy-theme-active[data-agy-view="conversation"] [data-agy-surface="main"],
          html.agy-theme-active[data-agy-view="review"] [data-agy-surface="main"] {
            background: linear-gradient(105deg,
              color-mix(in srgb, var(--agy-content) 66%, transparent) 0%,
              color-mix(in srgb, var(--agy-content) 56%, transparent) 52%,
              color-mix(in srgb, var(--agy-warm) 44%, transparent) 100%) !important;
            box-shadow: inset 1px 0 0 color-mix(in srgb, var(--agy-border) 65%, transparent);
            backdrop-filter: blur(1px) saturate(.96);
          }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="text-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="main"] [class~="text-foreground"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="text-foreground"],
          html.agy-theme-active-v2 [data-agy-component="popover"] [class~="text-foreground"],
          html.agy-theme-active [data-agy-surface="sidebar"] [class~="text-foreground"],
          html.agy-theme-active aside [class~="text-foreground"],
          html.agy-theme-active [data-agy-surface="main"] [class~="text-foreground"] { color: var(--agy-text) !important; }
          
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="text-secondary-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="text-muted-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="main"] [class~="text-secondary-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="main"] [class~="text-muted-foreground"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="text-secondary-foreground"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="text-muted-foreground"],
          html.agy-theme-active [data-agy-surface="sidebar"] [class~="text-secondary-foreground"],
          html.agy-theme-active [data-agy-surface="sidebar"] [class~="text-muted-foreground"],
          html.agy-theme-active aside [class~="text-secondary-foreground"],
          html.agy-theme-active aside [class~="text-muted-foreground"],
          html.agy-theme-active [data-agy-surface="main"] [class~="text-secondary-foreground"] { color: var(--agy-muted) !important; }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="bg-card"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="bg-secondary"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="bg-muted"],
          html.agy-theme-active [data-agy-surface="sidebar"] [class~="bg-card"],
          html.agy-theme-active [data-agy-surface="sidebar"] [class~="bg-secondary"],
          html.agy-theme-active aside [class~="bg-card"],
          html.agy-theme-active aside [class~="bg-secondary"] {
            background-color: transparent !important;
          }
          
          /* 侧边栏当前激活态/选中态对话卡片的专属定制高亮 */
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-agy-active="true"],
          html.agy-theme-active [data-agy-surface="sidebar"] [data-agy-active="true"],
          html.agy-theme-active aside [data-agy-active="true"] {
            background-color: var(--agy-accent) !important;
            color: var(--agy-text) !important;
            font-weight: 600 !important;
            box-shadow: 0 4px 14px color-mix(in srgb, var(--agy-accent) 45%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-agy-active="true"] *,
          html.agy-theme-active [data-agy-surface="sidebar"] [data-agy-active="true"] *,
          html.agy-theme-active aside [data-agy-active="true"] * {
            color: var(--agy-text) !important;
          }

          /* 账号每周限额面板卡片的专属定制磨砂与描边 */
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="card"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="Card"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="profile"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="account"],
          html.agy-theme-active [data-agy-surface="sidebar"] [class*="card"],
          html.agy-theme-active [data-agy-surface="sidebar"] [class*="profile"],
          html.agy-theme-active aside [class*="card"],
          html.agy-theme-active aside [class*="profile"] {
            background-color: color-mix(in srgb, var(--agy-input) 32%, rgba(255, 255, 255, 0.04)) !important;
            border: 1.5px solid color-mix(in srgb, var(--agy-accent) 42%, rgba(255, 255, 255, 0.08)) !important;
            box-shadow: 0 8px 24px color-mix(in srgb, var(--agy-shadow) 20%, transparent) !important;
            backdrop-filter: blur(16px) !important;
          }

          /* 免费额度进度条及数值的主题皮肤定制 */
          html.agy-theme-active-v2 [data-agy-component="quota-item"],
          html.agy-theme-active [data-agy-component="quota-item"] {
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="quota-progress"],
          html.agy-theme-active [data-agy-component="quota-progress"] {
            background-color: color-mix(in srgb, var(--agy-accent) 15%, rgba(255, 255, 255, 0.08)) !important;
            height: 6px !important;
            border-radius: 9999px !important;
            overflow: hidden !important;
          }
          html.agy-theme-active-v2 [data-agy-component="quota-progress-indicator"],
          html.agy-theme-active-v2 [data-agy-component="quota-progress"] [class*="indicator"],
          html.agy-theme-active-v2 [data-agy-component="quota-progress"] div,
          html.agy-theme-active [data-agy-component="quota-progress-indicator"],
          html.agy-theme-active [data-agy-component="quota-progress"] div {
            background-color: var(--agy-accent) !important;
            box-shadow: 0 0 8px var(--agy-accent) !important;
          }

          /* 鼠标 hover 对话卡片时右侧显示的 3 个快捷操作小按钮的自适应呼吸高亮定制 */
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] a button,
          html.agy-theme-active [data-agy-surface="sidebar"] a button,
          html.agy-theme-active aside a button,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-agy-active="true"] button,
          html.agy-theme-active [data-agy-surface="sidebar"] [data-agy-active="true"] button {
            color: var(--agy-text) !important;
            opacity: 0.65 !important;
            background: transparent !important;
            transition: all 0.2s ease !important;
            border-radius: 6px !important;
          }
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] a button:hover,
          html.agy-theme-active [data-agy-surface="sidebar"] a button:hover,
          html.agy-theme-active aside a button:hover,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-agy-active="true"] button:hover,
          html.agy-theme-active [data-agy-surface="sidebar"] [data-agy-active="true"] button:hover {
            opacity: 1 !important;
            background-color: color-mix(in srgb, var(--agy-accent) 45%, rgba(255,255,255,0.15)) !important;
            box-shadow: 0 2px 8px color-mix(in srgb, var(--agy-accent) 60%, transparent) !important;
            transform: scale(1.1) !important;
          }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"] button:hover,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [role="button"]:hover,
          html.agy-theme-active [data-agy-surface="sidebar"] button:hover,
          html.agy-theme-active aside button:hover {
            background-color: color-mix(in srgb, var(--agy-accent-soft) 28%, transparent) !important;
            color: var(--agy-text) !important;
          }

          /* 模型选择器解放宽度限制并彻底清除省略号，确保完整看清模型名称 */
          html.agy-theme-active-v2 [data-agy-component="model-picker"],
          html.agy-theme-active-v2 [data-agy-component="model-picker"] *,
          html.agy-theme-active-v2 [class*="model-picker"],
          html.agy-theme-active-v2 [class*="model-picker"] *,
          html.agy-theme-active-v2 [class*="ModelPicker"] * {
            max-width: none !important;
            width: auto !important;
            min-width: fit-content !important;
            white-space: nowrap !important;
            overflow: visible !important;
            text-overflow: clip !important;
          }

          html.agy-theme-active-v2 [data-agy-component="composer"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-input) 82%, transparent) !important;
            border: 1px solid color-mix(in srgb, var(--agy-accent) 32%, transparent) !important;
            
            /* 输入框左侧霓虹流光 */
            border-left: 3px solid var(--agy-accent) !important;
            
            box-shadow: 0 14px 38px color-mix(in srgb, var(--agy-shadow) 72%, transparent), 0 2px 8px rgba(0,0,0,.04) !important;
            backdrop-filter: blur(22px) saturate(1.08);
            transition: background .24s ease, border-color .24s ease, box-shadow .24s ease;
          }
          
          /* 输入框最右侧发送/停止按钮圆形自适应定制 */
          html.agy-theme-active-v2 [data-agy-control="send"] {
            background-color: var(--agy-accent) !important;
            color: var(--agy-text) !important;
            border-radius: 9999px !important;
            width: 32px !important;
            height: 32px !important;
            padding: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 4px 10px color-mix(in srgb, var(--agy-accent) 50%, transparent) !important;
            transition: all 0.2s ease !important;
          }
          html.agy-theme-active-v2 [data-agy-control="send"] * {
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-control="send"]:hover {
            transform: scale(1.08) !important;
            background-color: var(--agy-accent) !important;
            box-shadow: 0 6px 14px color-mix(in srgb, var(--agy-accent) 65%, transparent) !important;
          }

          /* 模型列表下拉弹出窗的高档描边定制 */
          html.agy-theme-active-v2 [data-agy-component="popover"],
          html.agy-theme-active-v2 [data-agy-component="dropdown"],
          html.agy-theme-active-v2 [class*="model-picker-menu"],
          html.agy-theme-active-v2 .dropdown-menu {
            background-color: color-mix(in srgb, var(--agy-input) 88%, rgba(10, 14, 20, 0.96)) !important;
            border: 1.5px solid var(--agy-accent) !important;
            box-shadow: 0 12px 32px color-mix(in srgb, var(--agy-shadow) 52%, transparent) !important;
            backdrop-filter: blur(20px) !important;
          }
          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-component="composer"] {
            background: linear-gradient(110deg,
              color-mix(in srgb, var(--agy-input) 76%, transparent) 0%,
              color-mix(in srgb, var(--agy-input) 72%, transparent) 58%,
              color-mix(in srgb, var(--agy-warm) 62%, transparent) 100%) !important;
            border-color: color-mix(in srgb, var(--agy-accent) 48%, transparent) !important;
            box-shadow: 0 16px 44px color-mix(in srgb, var(--agy-shadow) 60%, transparent), 0 2px 12px rgba(255,255,255,.32) inset !important;
            backdrop-filter: blur(24px) saturate(1.06);
          }
          html.agy-theme-active-v2[data-agy-view="conversation"] [data-agy-component="composer"],
          html.agy-theme-active-v2[data-agy-view="review"] [data-agy-component="composer"] {
            background: color-mix(in srgb, var(--agy-input) 86%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer-inner"] {
            background: transparent !important;
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"] button,
          html.agy-theme-active-v2 [data-agy-component="model-picker"] {
            color: var(--agy-muted) !important;
            background: transparent !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"] button:hover,
          html.agy-theme-active-v2 [data-agy-component="model-picker"]:hover {
            color: var(--agy-text) !important;
            background: var(--agy-accent-soft) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"]:focus-within {
            border-color: color-mix(in srgb, var(--agy-accent) 65%, transparent) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--agy-accent) 14%, transparent), 0 16px 42px var(--agy-shadow) !important;
          }

          html.agy-theme-active-v2 [data-agy-component="settings-backdrop"],
          html.agy-theme-active [data-agy-component="settings-backdrop"] {
            background: rgba(10, 14, 20, 0.38) !important;
            backdrop-filter: blur(8px) saturate(0.85) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"],
          html.agy-theme-active [data-agy-component="settings-dialog"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-dialog) 86%, rgba(255, 255, 255, 0.08)) !important;
            border: 1.5px solid color-mix(in srgb, var(--agy-accent) 35%, rgba(255, 255, 255, 0.1)) !important;
            box-shadow: 0 24px 68px color-mix(in srgb, var(--agy-shadow) 50%, transparent) !important;
            opacity: 1 !important;
            backdrop-filter: blur(28px) saturate(1.1) !important;
            border-radius: 20px !important;
          }
          html.agy-theme-active-v2 [data-agy-component="settings-sidebar"],
          html.agy-theme-active [data-agy-component="settings-sidebar"] {
            background-color: color-mix(in srgb, var(--agy-input) 45%, rgba(255, 255, 255, 0.02)) !important;
            border-right: 1px solid var(--agy-border) !important;
            padding: 12px 8px !important;
          }
          
          /* 设置项卡片本身及 hover/active 定制 */
          html.agy-theme-active-v2 [data-agy-settings-item="true"],
          html.agy-theme-active [data-agy-settings-item="true"] {
            background-color: transparent !important;
            background: transparent !important;
            color: var(--agy-text) !important;
            border: 1px solid transparent !important;
            border-left: 3px solid transparent !important;
            transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease !important;
            border-radius: 9px !important;
            box-shadow: none !important;
          }
          html.agy-theme-active-v2 [data-agy-settings-item="true"]:hover,
          html.agy-theme-active [data-agy-settings-item="true"]:hover {
            background-color: color-mix(in srgb, var(--agy-accent-soft) 26%, transparent) !important;
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-settings-item="true"][data-agy-active="true"],
          html.agy-theme-active [data-agy-settings-item="true"][data-agy-active="true"] {
            background: linear-gradient(90deg,
              color-mix(in srgb, var(--agy-accent-soft) 64%, transparent),
              color-mix(in srgb, var(--agy-warm) 28%, transparent)) !important;
            border-color: color-mix(in srgb, var(--agy-accent) 24%, transparent) !important;
            border-left-color: var(--agy-accent) !important;
            color: var(--agy-text) !important;
            font-weight: 600 !important;
            box-shadow: 0 5px 16px color-mix(in srgb, var(--agy-shadow) 24%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-settings-item="true"][data-agy-active="true"] *,
          html.agy-theme-active [data-agy-settings-item="true"][data-agy-active="true"] * {
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-background"] { background: var(--agy-dialog) !important; }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-secondary"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-card"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-muted"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-accent-soft) 48%, white) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] button:hover {
            color: var(--agy-text) !important;
            background-color: color-mix(in srgb, var(--agy-accent-soft) 74%, white) !important;
          }

          html.agy-theme-active-v2 [data-agy-component="popover"] {
            color: var(--agy-text) !important;
            background: var(--agy-dialog) !important;
            border: 1px solid var(--agy-border) !important;
            box-shadow: 0 18px 48px var(--agy-shadow), 0 3px 10px rgba(0,0,0,.08) !important;
            opacity: 1 !important;
            backdrop-filter: none !important;
          }
          html.agy-theme-active-v2 [data-agy-component="popover"] [class~="bg-secondary"],
          html.agy-theme-active-v2 [data-agy-component="popover"] button:hover,
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="option"]:hover {
            color: var(--agy-text) !important;
            background: var(--agy-accent-soft) !important;
          }

          html.agy-theme-active-v2 [data-agy-component="agent-message"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-dialog) 74%, transparent);
            border: 1px solid color-mix(in srgb, var(--agy-border) 66%, transparent);
            border-radius: 16px;
            padding: 8px 10px;
            box-shadow: 0 5px 18px color-mix(in srgb, var(--agy-shadow) 32%, transparent);
          }
          html.agy-theme-active-v2 [data-agy-component="semantic-card"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-dialog) 94%, var(--agy-accent-soft)) !important;
            border-color: var(--agy-border) !important;
            box-shadow: 0 6px 20px color-mix(in srgb, var(--agy-shadow) 28%, transparent);
          }
          html.agy-theme-active-v2 [data-agy-component="review-card"] {
            border-left: 3px solid var(--agy-accent) !important;
            background: color-mix(in srgb, var(--agy-accent-soft) 42%, var(--agy-dialog)) !important;
          }

          html.agy-theme-active-v2 *:focus-visible {
            outline: 2px solid color-mix(in srgb, var(--agy-accent) 74%, white) !important;
            outline-offset: 2px !important;
          }
          html.agy-theme-active-v2 [class~="border-border"] { border-color: var(--agy-border) !important; }
          html.agy-theme-active-v2 ::selection { background: color-mix(in srgb, var(--agy-accent) 28%, transparent); }

          /* v1.2.6 semantic state layer: only plugin-authored state markers may create selection emphasis. */
          html.agy-theme-active-v2 [data-agy-nav-item="true"],
          html.agy-theme-active [data-agy-nav-item="true"] {
            background: transparent !important;
            border: 1px solid transparent !important;
            border-left: 3px solid transparent !important;
            border-radius: 10px !important;
            box-shadow: none !important;
            color: var(--agy-muted) !important;
            transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease !important;
          }
          html.agy-theme-active-v2 [data-agy-nav-item="true"]:hover,
          html.agy-theme-active [data-agy-nav-item="true"]:hover {
            background: color-mix(in srgb, var(--agy-accent-soft) 24%, transparent) !important;
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-nav-item="true"][data-agy-active="true"],
          html.agy-theme-active [data-agy-nav-item="true"][data-agy-active="true"] {
            background: linear-gradient(90deg,
              color-mix(in srgb, var(--agy-accent-soft) 58%, transparent),
              color-mix(in srgb, var(--agy-warm) 30%, transparent)) !important;
            border-color: color-mix(in srgb, var(--agy-accent) 24%, transparent) !important;
            border-left-color: var(--agy-accent) !important;
            color: var(--agy-text) !important;
            font-weight: 600 !important;
            box-shadow: 0 5px 16px color-mix(in srgb, var(--agy-shadow) 22%, transparent) !important;
          }

          html.agy-theme-active-v2 .settings-modal-container:not([data-agy-settings-ready="true"]),
          html.agy-theme-active .settings-modal-container:not([data-agy-settings-ready="true"]) {
            opacity: 0 !important;
            visibility: hidden !important;
          }
          html.agy-theme-active-v2 [data-agy-settings-ready="true"],
          html.agy-theme-active [data-agy-settings-ready="true"] {
            visibility: visible !important;
            animation: agySettingsReady .14s ease-out both;
          }

          html.agy-theme-active-v2 [data-agy-component="model-picker"] {
            min-width: 0 !important;
            max-width: min(290px, 48vw) !important;
            width: auto !important;
            height: 30px !important;
            padding: 0 9px !important;
            overflow: hidden !important;
            color: var(--agy-muted) !important;
            background: color-mix(in srgb, var(--agy-input) 46%, transparent) !important;
            border: 1px solid color-mix(in srgb, var(--agy-border) 72%, transparent) !important;
            border-radius: 10px !important;
            box-shadow: none !important;
          }
          html.agy-theme-active-v2 [data-agy-component="model-picker"] * {
            max-width: 250px !important;
            min-width: 0 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          html.agy-theme-active-v2 [data-agy-component="model-picker"]:hover {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-accent-soft) 34%, transparent) !important;
            border-color: color-mix(in srgb, var(--agy-accent) 36%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="model-picker"][aria-expanded="true"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-accent-soft) 52%, var(--agy-input)) !important;
            border-color: color-mix(in srgb, var(--agy-accent) 52%, transparent) !important;
            box-shadow: 0 4px 14px color-mix(in srgb, var(--agy-shadow) 24%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-control="voice"],
          html.agy-theme-active-v2 [data-agy-control="send"] {
            width: 34px !important;
            min-width: 34px !important;
            max-width: 34px !important;
            height: 34px !important;
            min-height: 34px !important;
            max-height: 34px !important;
            padding: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 50% !important;
          }
          html.agy-theme-active-v2 [data-agy-control="voice"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-accent-soft) 48%, transparent) !important;
            border: 1px solid color-mix(in srgb, var(--agy-accent) 30%, transparent) !important;
            box-shadow: none !important;
          }
          html.agy-theme-active-v2 [data-agy-control="send"] {
            color: var(--agy-text) !important;
            background: var(--agy-accent) !important;
            border: 1px solid color-mix(in srgb, var(--agy-accent) 70%, white) !important;
            box-shadow: 0 5px 14px color-mix(in srgb, var(--agy-accent) 38%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="option"],
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="menuitem"] {
            background: transparent !important;
            border-left: 2px solid transparent !important;
            color: var(--agy-muted) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="option"]:hover,
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="menuitem"]:hover {
            background: color-mix(in srgb, var(--agy-accent-soft) 30%, transparent) !important;
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="option"][aria-selected="true"],
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="menuitem"][data-state="checked"] {
            background: color-mix(in srgb, var(--agy-accent-soft) 58%, transparent) !important;
            border-left-color: var(--agy-accent) !important;
            color: var(--agy-text) !important;
            font-weight: 600 !important;
          }

          html.agy-theme-active-v2 [data-agy-component="quota-card"],
          html.agy-theme-active [data-agy-component="quota-card"] {
            color: var(--agy-text) !important;
            background: linear-gradient(145deg,
              color-mix(in srgb, var(--agy-input) 64%, transparent),
              color-mix(in srgb, var(--agy-accent-soft) 34%, transparent)) !important;
            border: 1px solid color-mix(in srgb, var(--agy-accent) 30%, transparent) !important;
            border-left: 3px solid var(--agy-accent) !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 24px color-mix(in srgb, var(--agy-shadow) 24%, transparent) !important;
            backdrop-filter: blur(14px) saturate(1.05) !important;
          }

          @keyframes agySettingsReady { from { opacity: 0; transform: scale(.992); } to { opacity: 1; transform: none; } }

          #agy-theme-switcher-v2 { position: fixed; right: 18px; bottom: 24px; z-index: 2147483000; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif; }
          #agy-theme-switcher-v2 button { font: inherit; }
          #agy-theme-trigger-v2 { width: 42px; height: 42px; border: 1px solid color-mix(in srgb, var(--agy-accent) 46%, white); border-radius: 14px; color: var(--agy-text); background: var(--agy-dialog); box-shadow: 0 10px 30px var(--agy-shadow); cursor: pointer; transition: transform .16s ease, background .16s ease; }
          #agy-theme-trigger-v2:hover { transform: translateY(-2px) rotate(-3deg); background: var(--agy-accent-soft); }
          #agy-theme-menu-v2 { display: none; position: absolute; right: 0; bottom: 52px; width: 226px; padding: 10px; border: 1px solid var(--agy-border); border-radius: 16px; color: var(--agy-text); background: var(--agy-dialog); box-shadow: 0 22px 58px var(--agy-shadow); }
          #agy-theme-switcher-v2.open #agy-theme-menu-v2 { display: block; animation: agyThemeV2In .16s ease-out; }
          #agy-theme-menu-v2 strong { display: block; padding: 5px 8px 9px; font-size: 12px; }
          .agy-theme-v2-choice { display: flex; align-items: center; width: 100%; gap: 9px; padding: 9px; border: 0; border-radius: 10px; color: var(--agy-muted); background: transparent; cursor: pointer; text-align: left; font-size: 12px; }
          .agy-theme-v2-choice:hover, .agy-theme-v2-choice.active { color: var(--agy-text); background: var(--agy-accent-soft); }
          .agy-theme-v2-swatch { width: 10px; height: 10px; border-radius: 50%; background: var(--choice-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--choice-accent) 18%, transparent); }
          .agy-theme-v2-native { margin-top: 5px; border-top: 1px solid var(--agy-border); border-radius: 0 0 10px 10px; }
          @keyframes agyThemeV2In { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
          @media (prefers-reduced-motion: reduce) { #agy-theme-wallpaper-v2, #agy-theme-switcher-v2 * { transition: none !important; animation: none !important; } }
        `;
        document.head.appendChild(style);
    }

    function ensureWallpaper() {
        let wallpaper = document.getElementById('agy-theme-wallpaper-v2');
        if (!wallpaper) {
            wallpaper = document.createElement('div');
            wallpaper.id = 'agy-theme-wallpaper-v2';
            document.body.prepend(wallpaper);
        }
        return wallpaper;
    }

    function visible(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }

    function compactText(element) {
        return String(element && (element.innerText || element.textContent) || '').replace(/\s+/g, ' ').trim();
    }

    function mark(element, key, value) {
        if (!element) return;
        const attribute = `data-agy-${key}`;
        if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    }

    function ancestorMatching(start, predicate, limit = 18) {
        let current = start;
        for (let index = 0; current && index < limit; index += 1, current = current.parentElement) {
            if (predicate(current)) return current;
        }
        return null;
    }

    function detectView() {
        const settings = document.querySelector('.settings-modal-container');
        if (visible(settings)) return 'settings';
        const reviewText = Array.from(document.querySelectorAll('button')).filter(visible).map(compactText).join(' ');
        if (/审核|批准|拒绝|Approve|Reject/.test(reviewText) && document.querySelector('[role="article"]')) return 'review';
        if (/^\/c\//.test(location.pathname) || document.querySelector('[role="article"][aria="Agent response"]')) return 'conversation';
        return 'new-chat';
    }

    function annotateSemanticDom() {
        if (!document.body) return;
        const view = detectView();
        if (document.documentElement.dataset.agyView !== view) document.documentElement.dataset.agyView = view;

        const app = Array.from(document.querySelectorAll('#root *')).find(element => {
            const className = String(element.className || '');
            return className.includes('h-screen') && className.includes('w-screen') && className.includes('bg-background');
        });
        mark(app, 'surface', 'app');

        const newChatButton = Array.from(document.querySelectorAll('button')).find(element => {
            const text = compactText(element);
            return (text === '新建对话' || text === 'New Project' || text === 'New chat' || text === '新建项目') && element.getBoundingClientRect().x < 260;
        });
        const sidebarCandidates = [];
        for (let current = newChatButton; current; current = current.parentElement) {
            const rect = current.getBoundingClientRect();
            if (rect.x <= 2 && rect.width >= 210 && rect.width <= 280 && rect.height > innerHeight * .72) sidebarCandidates.push(current);
        }
        let sidebar = sidebarCandidates.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
        if (!sidebar) {
            /* 极致兜底：如果按钮推演失败，直接根据 aside 或 sidebar 关键字寻找可见大容器，并取消死板的宽高校验 */
            sidebar = document.querySelector('aside') || 
                      Array.from(document.querySelectorAll('div')).find(el => {
                          const className = String(el.className || '').toLowerCase();
                          const id = String(el.id || '').toLowerCase();
                          return (className.includes('sidebar') || className.includes('left-panel') || className.includes('sidebarcandidates') || id.includes('sidebar')) && visible(el);
                      });
        }
        mark(sidebar, 'surface', 'sidebar');

        const composer = document.getElementById('antigravity.agentSidePanelInputBox');
        mark(composer, 'component', 'composer');
        if (composer) {
            const inner = Array.from(composer.children).find(child => String(child.className || '').includes('bg-card')) || composer.firstElementChild;
            mark(inner, 'component', 'composer-inner');
            const modelPicker = composer.querySelector('[aria-label*="选择模型"], [aria-label*="Select model"]');
            mark(modelPicker, 'component', 'model-picker');
            const composerButtons = Array.from(composer.querySelectorAll('button')).filter(visible);
            composerButtons.forEach(button => button.removeAttribute('data-agy-control'));
            const sendButton = composerButtons.find(button => {
                const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${compactText(button)}`;
                const className = String(button.className || '');
                return button.type === 'submit' || /发送|停止|Send|Stop/i.test(label) || className.includes('composer-send-button');
            });
            const voiceButton = composerButtons.find(button => {
                if (button === sendButton) return false;
                const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${compactText(button)}`;
                return /麦克风|语音|录音|microphone|voice|mic/i.test(label);
            });
            if (sendButton) sendButton.setAttribute('data-agy-control', 'send');
            if (voiceButton) voiceButton.setAttribute('data-agy-control', 'voice');
            const main = ancestorMatching(composer, element => {
                const rect = element.getBoundingClientRect();
                const className = String(element.className || '');
                return rect.width > innerWidth * .62 && rect.height > innerHeight * .75 && className.includes('flex-1') && className.includes('flex-col') && className.includes('min-w-0');
            });
            mark(main, 'surface', 'main');
            const hero = ancestorMatching(composer, element => String(element.className || '').includes('pt-[30vh]'));
            mark(hero, 'component', 'new-chat-hero');
        }

        const backdrop = document.querySelector('.settings-modal-backdrop');
        const settingsDialog = document.querySelector('.settings-modal-container');
        mark(backdrop, 'component', 'settings-backdrop');
        mark(settingsDialog, 'component', 'settings-dialog');
        if (settingsDialog) {
            const dialogRect = settingsDialog.getBoundingClientRect();
            const settingSidebar = Array.from(settingsDialog.querySelectorAll('div')).filter(visible).find(element => {
                const rect = element.getBoundingClientRect();
                return rect.x <= dialogRect.x + 230 && rect.width >= 180 && rect.width <= 240 && rect.height > dialogRect.height * .78;
            });
            mark(settingSidebar, 'component', 'settings-sidebar');
            if (settingSidebar) {
                // 1. 获取右侧区域当前可见的大标题，作为当前激活面板的参考
                const rightTitleEl = Array.from(settingsDialog.querySelectorAll('h2, h1, [class*="title"], [class*="header"]'))
                    .filter(visible)
                    .find(el => {
                        if (settingSidebar.contains(el)) return false;
                        const txt = el.textContent.trim();
                        return txt.length > 1 && txt.length < 15;
                    });
                const currentTitleText = rightTitleEl ? rightTitleEl.textContent.trim() : '';

                // 2. 直接获取侧栏的直接一级子节点（它们在DOM中天然是平铺的选项卡片），物理容错率 100%
                const items = Array.from(settingSidebar.children).filter(el => {
                    return el.textContent.trim().length > 0;
                });

                // 3. 多重逻辑寻找当前激活项
                let activeItem = null;
                
                // 方案 A：右侧标题匹配法（无敌文本联动）
                if (currentTitleText) {
                    activeItem = items.find(el => el.textContent.trim().includes(currentTitleText) || currentTitleText.includes(el.textContent.trim()));
                }
                
                // 方案 B：类名与状态兜底检测
                if (!activeItem) {
                    activeItem = items.find(el => {
                        if (el.getAttribute?.('aria-selected') === 'true') return true;
                        if (el.getAttribute?.('data-state') === 'active') return true;
                        if (el.getAttribute?.('data-active') === 'true') return true;
                        const className = String(el.className || '');
                        if (className.includes('bg-secondary') || className.includes('bg-accent') || className.includes('bg-muted')) return true;
                        return false;
                    });
                }

                // 4. 清除并重新打标
                items.forEach(el => el.removeAttribute('data-agy-active'));
                if (activeItem) {
                    activeItem.setAttribute('data-agy-active', 'true');
                }
            }
        }

        /* Stable settings semantics: discard broad container guesses and mark only leaf navigation rows. */
        if (settingsDialog) {
            settingsDialog.setAttribute('data-agy-settings-ready', 'true');
            const stableSettingsSidebar = settingsDialog.querySelector('[data-agy-component="settings-sidebar"]');
            if (stableSettingsSidebar) {
                const settingsItems = Array.from(stableSettingsSidebar.querySelectorAll('button, a, [role="button"]')).filter(element => {
                    const rect = element.getBoundingClientRect();
                    const text = compactText(element);
                    return visible(element)
                        && text.length >= 2 && text.length <= 32
                        && rect.width >= 120 && rect.width <= 250
                        && rect.height >= 24 && rect.height <= 54;
                });
                stableSettingsSidebar.querySelectorAll('[data-agy-settings-item], [data-agy-active]').forEach(element => {
                    element.removeAttribute('data-agy-settings-item');
                    element.removeAttribute('data-agy-active');
                });
                settingsItems.forEach(element => element.setAttribute('data-agy-settings-item', 'true'));

                const activeByNativeState = settingsItems.filter(element => {
                    const className = String(element.className || '');
                    return element.getAttribute('aria-selected') === 'true'
                        || element.getAttribute('aria-current') === 'page'
                        || element.getAttribute('data-state') === 'active'
                        || element.getAttribute('data-active') === 'true'
                        || /(^|\s)bg-sidebar-secondary(\s|$)/.test(className);
                });
                let activeSettingsItem = activeByNativeState.length === 1 ? activeByNativeState[0] : null;

                if (!activeSettingsItem) {
                    const sidebarRect = stableSettingsSidebar.getBoundingClientRect();
                    const labels = new Map(settingsItems.map(element => [compactText(element), element]));
                    const titleMatch = Array.from(settingsDialog.querySelectorAll('*')).filter(element => {
                        if (!visible(element) || stableSettingsSidebar.contains(element)) return false;
                        const rect = element.getBoundingClientRect();
                        const text = compactText(element);
                        return labels.has(text)
                            && rect.x > sidebarRect.right + 24
                            && rect.width < 520
                            && rect.height >= 20 && rect.height <= 64;
                    }).sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y)[0];
                    activeSettingsItem = titleMatch ? labels.get(compactText(titleMatch)) : null;
                }
                if (activeSettingsItem) activeSettingsItem.setAttribute('data-agy-active', 'true');
            }
        }

        document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"]').forEach(element => {
            if (!settingsDialog || !settingsDialog.contains(element)) mark(element, 'component', 'popover');
        });

        document.querySelectorAll('[role="article"][aria="Agent response"]').forEach(element => mark(element, 'component', 'agent-message'));
        document.querySelectorAll('[role="article"] [class*="border"][class*="rounded"]').forEach(element => {
            const rect = element.getBoundingClientRect();
            if (rect.width > 180 && rect.width < 820 && rect.height > 44) mark(element, 'component', 'semantic-card');
        });
        Array.from(document.querySelectorAll('button')).filter(element => /审核|批准|拒绝|Approve|Reject/.test(compactText(element))).forEach(button => {
            const card = ancestorMatching(button, element => {
                const rect = element.getBoundingClientRect();
                return rect.width > 220 && rect.width < 900 && rect.height > 70 && String(element.className || '').includes('border');
            }, 10);
            mark(card, 'component', 'review-card');
        });

        /* 1. 动态查找并强力标注侧边栏当前激活/选中的对话项目链接 */
        /* 1. 动态查找并强力标注侧边栏当前激活/选中的对话项目链接（严格限定为 a 链接以防误染） */
        if (sidebar) {
            const activeCandidates = Array.from(sidebar.querySelectorAll('a')).filter(el => {
                const href = el.getAttribute?.('href') || '';
                if (!href || href === '#' || href === '/') return false;
                // 精准匹配当前正在打开的会话 hash 路由
                if (location.hash && location.hash.length > 2 && href.includes(location.hash)) return true;
                if (el.getAttribute?.('aria-current') === 'page') return true;
                if (el.getAttribute?.('data-state') === 'active') return true;
                if (el.getAttribute?.('data-active') === 'true') return true;
                return false;
            });
            sidebar.querySelectorAll('[data-agy-active]').forEach(el => el.removeAttribute('data-agy-active'));
            activeCandidates.forEach(el => el.setAttribute('data-agy-active', 'true'));
        }

        /* Stable primary navigation state: theme ambience remains global, selection belongs to exactly one route. */
        if (sidebar) {
            const navLabels = new Set(['新建对话', '历史对话', '计划任务', '设置', 'New chat', 'History', 'Scheduled tasks', 'Settings']);
            const navItems = Array.from(sidebar.querySelectorAll('button, a, [role="button"]')).filter(element => {
                const rect = element.getBoundingClientRect();
                return visible(element) && rect.width > 120 && rect.height >= 28 && rect.height <= 56 && navLabels.has(compactText(element));
            });
            navItems.forEach(element => {
                element.setAttribute('data-agy-nav-item', 'true');
                element.removeAttribute('data-agy-active');
            });
            sidebar.querySelectorAll('a[data-agy-active]').forEach(element => element.removeAttribute('data-agy-active'));

            const settingsNavItem = navItems.find(element => /^(设置|Settings)$/.test(compactText(element)));
            const newChatNavItem = navItems.find(element => /^(新建对话|New chat)$/.test(compactText(element)));
            const nativeActiveNavItem = navItems.find(element =>
                element.getAttribute('aria-current') === 'page'
                || element.getAttribute('aria-pressed') === 'true'
                || element.getAttribute('data-state') === 'active'
            );
            const currentConversation = Array.from(sidebar.querySelectorAll('a[href]')).find(element => {
                try {
                    const target = new URL(element.getAttribute('href'), location.href);
                    return target.pathname === location.pathname && target.search === location.search;
                } catch (_) {
                    return false;
                }
            });
            if (currentConversation) currentConversation.setAttribute('data-agy-nav-item', 'true');
            const activeNavItem = settingsDialog
                ? settingsNavItem
                : currentConversation || nativeActiveNavItem || (view === 'new-chat' ? newChatNavItem : null);
            if (activeNavItem) activeNavItem.setAttribute('data-agy-active', 'true');
        }

        if (sidebar) {
            const quotaCard = Array.from(sidebar.querySelectorAll('div')).filter(element => {
                if (!visible(element)) return false;
                const text = compactText(element);
                const rect = element.getBoundingClientRect();
                return text.includes('每周额度') && text.includes('5H额度')
                    && rect.width >= 190 && rect.width <= 340 && rect.height >= 130 && rect.height <= 420;
            }).sort((a, b) => {
                const ar = a.getBoundingClientRect();
                const br = b.getBoundingClientRect();
                return ar.width * ar.height - br.width * br.height;
            })[0];
            mark(quotaCard, 'component', 'quota-card');
            if (quotaCard) {
                quotaCard.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]').forEach(progress => {
                    mark(progress, 'component', 'quota-progress');
                    const indicator = progress.firstElementChild;
                    if (indicator) mark(indicator, 'component', 'quota-progress-indicator');
                });
            }
        }

        /* 2. 动态抓取免费额度卡片、文本以及进度条指示器进行主题美化（支持 body 内任意位置挂载） */
        Array.from(document.querySelectorAll('body *')).forEach(element => {
            const text = compactText(element);
            if (text.includes('每周额度') || text.includes('5H额度') || text.includes('免费额度') || text.includes('额度：')) {
                mark(element, 'component', 'quota-item');
                
                // 向上寻找最近的一个符合卡片特征的容器作为额度卡片进行标记
                const card = ancestorMatching(element, el => {
                    const rect = el.getBoundingClientRect();
                    const className = String(el.className || '').toLowerCase();
                    return rect.width > 120 && rect.width < 320 && 
                           (className.includes('border') || className.includes('rounded') || className.includes('bg-') || className.includes('card'));
                }, 5);
                if (card) {
                    mark(card, 'component', 'quota-card');
                }

                const parent = element.parentElement;
                if (parent) {
                    const progress = parent.querySelector('[role="progressbar"], [class*="progress"], [class*="Progress"]');
                    if (progress) {
                        mark(progress, 'component', 'quota-progress');
                        const indicator = progress.querySelector('div');
                        if (indicator) mark(indicator, 'component', 'quota-progress-indicator');
                    }
                }
            }
        });
    }

    function scheduleSemanticUpdate() {
        clearTimeout(semanticTimer);
        semanticTimer = setTimeout(annotateSemanticDom, 70);
    }

    function setThemeVariables(theme) {
        const root = document.documentElement;
        const values = {
            '--agy-accent': theme.accent,
            '--agy-accent-soft': theme.accentSoft,
            '--agy-warm': theme.warm,
            '--agy-app': theme.app,
            '--agy-sidebar': theme.sidebar,
            '--agy-content': theme.content,
            '--agy-dialog': theme.dialog,
            '--agy-input': theme.input,
            '--agy-text': theme.text,
            '--agy-muted': theme.muted,
            '--agy-border': theme.border,
            '--agy-shadow': theme.shadow,
            '--agy-wallpaper-position': theme.position
        };
        Object.entries(values).forEach(([name, value]) => root.style.setProperty(name, value));
        const quotaWidget = document.getElementById('antigravity-quota-widget');
        if (quotaWidget) {
            quotaWidget.style.setProperty('--ag-fg', 'var(--agy-text)');
            quotaWidget.style.setProperty('--ag-muted-fg', 'var(--agy-muted)');
            quotaWidget.style.setProperty('--ag-card-bg-base', 'color-mix(in srgb, var(--agy-input) 72%, transparent)');
            quotaWidget.style.setProperty('--ag-card-bg', 'linear-gradient(145deg, color-mix(in srgb, var(--agy-input) 82%, transparent), color-mix(in srgb, var(--agy-accent-soft) 42%, transparent))');
            quotaWidget.style.setProperty('--ag-trigger-bg', 'color-mix(in srgb, var(--agy-dialog) 76%, var(--agy-accent-soft))');
            quotaWidget.style.setProperty('--ag-menu-bg', 'color-mix(in srgb, var(--agy-dialog) 94%, var(--agy-accent-soft))');
            quotaWidget.style.setProperty('--ag-menu-fg', 'var(--agy-text)');
            quotaWidget.style.setProperty('--ag-border', 'color-mix(in srgb, var(--agy-accent) 38%, transparent)');
            quotaWidget.style.setProperty('--ag-hover', 'linear-gradient(145deg, color-mix(in srgb, var(--agy-input) 92%, transparent), color-mix(in srgb, var(--agy-accent-soft) 58%, transparent))');
            quotaWidget.style.setProperty('--ag-accent', 'var(--agy-accent)');
            quotaWidget.style.setProperty('--ag-shadow', 'color-mix(in srgb, var(--agy-shadow) 32%, transparent)');
        }
    }

    function updateChoiceState(themeId) {
        document.querySelectorAll('.agy-theme-v2-choice').forEach(button => button.classList.toggle('active', button.dataset.themeId === themeId));
    }

    function applyConfig(config) {
        if (!document.body) return;
        ensureStyle();
        const wallpaper = ensureWallpaper();
        if (!config || !config.enabled || config.id === 'native') {
            document.documentElement.classList.remove('agy-theme-active-v2');
            document.documentElement.removeAttribute('data-agy-theme');
            wallpaper.style.backgroundImage = '';
            activeImageKey = '';
            updateChoiceState('native');
            return;
        }
        const theme = catalog.find(item => item.id === config.id) || catalog[0];
        if (!config.imageDataUrl) return;
        const imageKey = `${config.id}:${config.revision || config.updatedAt || ''}`;
        if (activeImageKey !== imageKey) {
            wallpaper.style.backgroundImage = `url("${config.imageDataUrl}")`;
            activeImageKey = imageKey;
        }
        setThemeVariables(theme);
        document.documentElement.classList.add('agy-theme-active-v2');
        document.documentElement.dataset.agyTheme = theme.id;
        
        const activeId = config.sourceThemeId || config.id;
        renderSwitcherChoices(config.themes || [], activeId);
        scheduleSemanticUpdate();
    }

    function renderSwitcherChoices(themes, activeId) {
        const menu = document.getElementById('agy-theme-menu-v2');
        if (!menu) return;
        
        // 保留标题，清空所有按钮
        const title = menu.querySelector('strong');
        menu.innerHTML = '';
        if (title) menu.appendChild(title);
        
        const themesList = themes && themes.length > 0 ? themes : catalog;
        
        themesList.forEach(theme => {
            const button = document.createElement('button');
            button.className = 'agy-theme-v2-choice';
            button.dataset.themeId = theme.id;
            button.style.setProperty('--choice-accent', theme.accent);
            button.innerHTML = '<span class="agy-theme-v2-swatch"></span><span></span>';
            button.lastElementChild.textContent = theme.name;
            if (theme.id === activeId) {
                button.classList.add('active');
            }
            button.addEventListener('click', async event => {
                event.stopPropagation();
                try {
                    const config = await themeIpc.invoke('agy-theme:set', theme.id);
                    lastRevision = config.revision || '';
                    applyConfig(config);
                } catch (error) {
                    console.warn('[AGY Theme V2] switch failed:', error);
                }
                const switcher = document.getElementById('agy-theme-switcher-v2');
                if (switcher) switcher.classList.remove('open');
            });
            menu.appendChild(button);
        });

        const nativeButton = document.createElement('button');
        nativeButton.className = 'agy-theme-v2-choice agy-theme-v2-native';
        nativeButton.dataset.themeId = 'native';
        if (activeId === 'native') nativeButton.classList.add('active');
        nativeButton.innerHTML = '<span class="agy-theme-v2-swatch" style="--choice-accent:#9aa4ad"></span><span>恢复原生主题</span>';
        nativeButton.addEventListener('click', async event => {
            event.stopPropagation();
            try {
                const config = await themeIpc.invoke('agy-theme:disable');
                lastRevision = config.revision || '';
                applyConfig(config);
            } catch (error) {
                console.warn('[AGY Theme V2] disable failed:', error);
            }
            const switcher = document.getElementById('agy-theme-switcher-v2');
            if (switcher) switcher.classList.remove('open');
        });
        menu.appendChild(nativeButton);
    }

    function ensureSwitcher() {
        if (document.getElementById('agy-theme-switcher-v2')) return;
        const switcher = document.createElement('div');
        switcher.id = 'agy-theme-switcher-v2';
        const menu = document.createElement('div');
        menu.id = 'agy-theme-menu-v2';
        const title = document.createElement('strong');
        title.textContent = 'Antigravity 主题皮肤';
        menu.appendChild(title);
        
        const trigger = document.createElement('button');
        trigger.id = 'agy-theme-trigger-v2';
        trigger.type = 'button';
        trigger.title = '切换主题皮肤';
        trigger.setAttribute('aria-label', '切换主题皮肤');
        trigger.textContent = '✦';
        trigger.addEventListener('click', event => {
            event.stopPropagation();
            switcher.classList.toggle('open');
        });
        switcher.append(menu, trigger);
        document.body.appendChild(switcher);
        document.addEventListener('click', () => switcher.classList.remove('open'));
        
        renderSwitcherChoices([], 'native');
    }

    async function refreshTheme() {
        try {
            const config = await themeIpc.invoke('agy-theme:get', lastRevision);
            if (!config) return;
            const activeId = config.sourceThemeId || config.id;
            renderSwitcherChoices(config.themes || [], activeId);
            
            if (config.unchanged) return;
            lastRevision = config.revision || '';
            applyConfig(config);
        } catch (error) {
            console.warn('[AGY Theme V2] refresh failed:', error);
        }
    }

    function removeLegacyEngine() {
        document.getElementById('agy-theme-engine-style')?.remove();
        document.getElementById('agy-theme-wallpaper')?.remove();
        document.getElementById('agy-theme-switcher')?.remove();
        document.documentElement.classList.remove('agy-theme-active', 'agy-chat-empty');
    }

    function start() {
        removeLegacyEngine();
        ensureStyle();
        ensureWallpaper();
        ensureSwitcher();
        annotateSemanticDom();
        refreshTheme();
        setInterval(refreshTheme, 900);
        setInterval(annotateSemanticDom, 800);
        observer = new MutationObserver(scheduleSemanticUpdate);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('popstate', scheduleSemanticUpdate);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();