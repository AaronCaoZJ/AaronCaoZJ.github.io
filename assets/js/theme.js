/* 明暗模式：两态切换，默认浅色，不跟随系统。

   同步加载于 <head>，第一件事是把存档写进 data-theme —— 若等到
   DOMContentLoaded 再写，深色用户会先看到一帧浅色再跳。
   localStorage 在隐私模式下访问本身就会抛异常，故全部包 try/catch。 */
(function () {
  var KEY = 'theme';
  var ICON = { light: '☀', dark: '☾' };
  var LABEL = { light: '浅色', dark: '深色' };

  function read() {
    var v;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    // 早期版本存过 'auto'，一律按浅色处理
    return v === 'dark' ? 'dark' : 'light';
  }
  function apply(m) {
    document.documentElement.setAttribute('data-theme', m);
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
      mode = mode === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, mode); } catch (e) {}
      apply(mode);
      btn.textContent = ICON[mode];
      btn.title = LABEL[mode];
    });
    wrap.appendChild(btn);
  });
})();
