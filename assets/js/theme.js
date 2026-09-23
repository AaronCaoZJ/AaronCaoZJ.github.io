/* 明暗模式：两态切换，默认浅色，不跟随系统。

   默认值写死在 <html data-theme="light"> 上，所以浏览器解析到文档第一行
   时浅色就已生效 —— 这一层不依赖 JS，脚本加载失败或被禁用也不会跑偏。
   本文件只负责一件事：读到存档是 'dark' 时把属性改掉。
   localStorage 在隐私模式下访问本身就会抛异常，故全部包 try/catch。 */
(function () {
  var KEY = 'theme';
  var ICON = { light: '☀', dark: '☾' };
  var LABEL = { light: '浅色', dark: '深色' };

  function read() {
    var v;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    // 只认显式存下的 'dark'；'auto' 等历史值一律按默认的浅色处理
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
