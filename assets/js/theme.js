/* 明暗模式：三态循环 自动 → 浅色 → 深色。

   同步加载于 <head>，第一件事是把存档写进 data-theme —— 若等到
   DOMContentLoaded 再写，页面会先按系统偏好渲染一帧再跳色。
   localStorage 在隐私模式下访问本身就会抛异常，故全部包 try/catch。 */
(function () {
  var KEY = 'theme';
  var ORDER = ['auto', 'light', 'dark'];
  var ICON = { auto: '◐', light: '☀', dark: '☾' };
  var LABEL = { auto: '跟随系统', light: '浅色', dark: '深色' };

  function read() {
    try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; }
  }
  function apply(m) {
    if (m === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', m);
  }

  var mode = read();
  apply(mode);

  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.querySelector('.nav .wrap');
    if (!wrap) return;
    var btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.type = 'button';
    btn.textContent = ICON[mode];
    btn.title = LABEL[mode];
    btn.setAttribute('aria-label', 'Colour scheme');
    btn.addEventListener('click', function () {
      mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      try { localStorage.setItem(KEY, mode); } catch (e) {}
      apply(mode);
      btn.textContent = ICON[mode];
      btn.title = LABEL[mode];
    });
    wrap.appendChild(btn);
  });
})();
