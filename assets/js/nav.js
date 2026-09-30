/* 窄屏横幅的 ☰ 菜单。什么时候是横幅由 style.css 的断点决定，这里只管开合；
   宽屏下按钮不显示，.open 也不影响任何样式。

   收起的时机：点了某个入口（页内锚点不会刷新页面，得手动收）、
   点到横幅以外（包括手指按下准备滚动页面）、按 Esc、窗口变宽切回胶囊。 */
(function () {
  var nav = document.querySelector('.nav');
  var btn = nav && nav.querySelector('.nav-menu');
  if (!btn) return;

  function set(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }

  btn.addEventListener('click', function () { set(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('pointerdown', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target)) set(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); }
  });
  var wide = window.matchMedia && window.matchMedia('(min-width: 661px)');
  if (wide && wide.addEventListener) wide.addEventListener('change', function () { set(false); });
})();
