/**
 * modules/theme-adapter.js
 * Antigravity-Chinese v2 - 主题颜色自适应工具
 * 提供：getNativeThemeColors、showBeautifulConfirm
 */

function getNativeThemeColors(anchor = document.body) {
  const rootStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const pick = (...names) => {
    for (const name of names) {
      const val = rootStyle.getPropertyValue(name).trim() || bodyStyle.getPropertyValue(name).trim();
      if (val) return val;
    }
    return '';
  };
  const parseColor = (value) => {
    const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(',').map(v => parseFloat(v.trim()));
    if (parts.length < 3) return null;
    if (parts.length >= 4 && parts[3] === 0) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
  };
  const rgb = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;
  const rgba = (c, a) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
  const mix = (a, b, t) => ({
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t)
  });
  const luminance = (c) => {
    const vals = [c.r, c.g, c.b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return vals[0] * 0.2126 + vals[1] * 0.7152 + vals[2] * 0.0722;
  };
  const findBackground = (start) => {
    let cur = start || document.body;
    while (cur && cur !== document.documentElement) {
      const bg = parseColor(getComputedStyle(cur).backgroundColor);
      if (bg) return bg;
      cur = cur.parentElement;
    }
    return parseColor(pick('--background', '--color-background', '--vscode-editor-background')) ||
      parseColor(bodyStyle.backgroundColor) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? { r: 16, g: 16, b: 16 } : { r: 245, g: 245, b: 245 });
  };
  const pageBgColor = findBackground(anchor);
  const isDark = luminance(pageBgColor) < 0.45;
  const fg = isDark ? { r: 232, g: 236, b: 242 } : { r: 32, g: 35, b: 42 };
  const muted = isDark ? { r: 170, g: 176, b: 186 } : { r: 88, g: 95, b: 108 };
  const contrast = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const surfaceColor = mix(pageBgColor, contrast, isDark ? 0.09 : 0.035);
  const subtleColor = mix(pageBgColor, contrast, isDark ? 0.14 : 0.055);
  const hoverColor = mix(pageBgColor, contrast, isDark ? 0.2 : 0.085);
  const accent = pick('--accent', '--primary', '--vscode-focusBorder') || '#3b82f6';
  return {
    isDark,
    accent,
    base: rgb(pageBgColor),
    surface: rgb(surfaceColor),
    foreground: rgb(fg),
    muted: rgb(muted),
    border: rgba(contrast, isDark ? 0.16 : 0.12),
    subtle: rgb(subtleColor),
    subtleHover: rgb(hoverColor),
    overlay: isDark ? 'rgba(0,0,0,0.56)' : 'rgba(0,0,0,0.26)',
    shadow: isDark ? '0 18px 48px rgba(0,0,0,0.45)' : '0 18px 42px rgba(0,0,0,0.16)'
  };
}

function showBeautifulConfirm(title, message, confirmText = '确定', cancelText = '取消') {
  return new Promise((resolve) => {
    const theme = getNativeThemeColors();
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:${theme.overlay};backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.22s cubic-bezier(0.25,1,0.5,1);`;
    const card = document.createElement('div');
    card.style.cssText = `background:${theme.surface};border:1px solid ${theme.border};border-radius:10px;padding:24px 28px;width:380px;box-shadow:${theme.shadow};font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;transform:scale(0.92) translateY(10px);transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1),opacity 0.22s ease;opacity:0;color:${theme.foreground};`;
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `font-size:16px;font-weight:600;color:${theme.foreground};margin-bottom:12px;letter-spacing:0;`;
    titleEl.textContent = title;
    const descEl = document.createElement('div');
    descEl.style.cssText = `font-size:13.5px;line-height:1.6;color:${theme.muted};margin-bottom:24px;white-space:pre-wrap;`;
    descEl.textContent = message;
    const btnArea = document.createElement('div');
    btnArea.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = `background:${theme.subtle};border:1px solid ${theme.border};border-radius:6px;padding:8px 16px;font-size:12.5px;font-weight:500;color:${theme.foreground};cursor:pointer;transition:all 0.15s ease;`;
    cancelBtn.textContent = cancelText;
    cancelBtn.onmouseenter = () => { cancelBtn.style.background = theme.subtleHover; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.background = theme.subtle; };
    const confirmBtn = document.createElement('button');
    confirmBtn.style.cssText = `background:${theme.accent};border:none;border-radius:6px;padding:8px 20px;font-size:12.5px;font-weight:600;color:#ffffff;cursor:pointer;transition:all 0.15s ease;`;
    confirmBtn.textContent = confirmText;
    confirmBtn.onmouseenter = () => { confirmBtn.style.transform = 'translateY(-1px)'; confirmBtn.style.filter = theme.isDark ? 'brightness(1.12)' : 'brightness(0.96)'; };
    confirmBtn.onmouseleave = () => { confirmBtn.style.transform = 'translateY(0)'; confirmBtn.style.filter = 'brightness(1)'; };
    btnArea.appendChild(cancelBtn);
    btnArea.appendChild(confirmBtn);
    card.appendChild(titleEl);
    card.appendChild(descEl);
    card.appendChild(btnArea);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    const close = (result) => {
      overlay.style.opacity = '0';
      card.style.transform = 'scale(0.92) translateY(10px)';
      setTimeout(() => { if (document.body.contains(overlay)) document.body.removeChild(overlay); resolve(result); }, 220);
    };
    cancelBtn.onclick = (e) => { e.stopPropagation(); close(false); };
    confirmBtn.onclick = (e) => { e.stopPropagation(); close(true); };
    overlay.onclick = (ev) => { if (ev.target === overlay) { ev.stopPropagation(); close(false); } };
    setTimeout(() => { overlay.style.opacity = '1'; card.style.opacity = '1'; card.style.transform = 'scale(1) translateY(0)'; }, 20);
  });
}

module.exports = { getNativeThemeColors, showBeautifulConfirm };
