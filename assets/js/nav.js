/* ---------- 悬停水滴 ----------
   一颗玻璃水滴跟着指针在一组条目之间滑动：换位时沿移动方向先拉长、
   横向压扁，再随 CSS 的回弹缓动落定，读起来像一滴液体被拖过去。
   拉伸按像素算并封顶 10%（100px 的菜单项是 1.1 x 0.9），换别的尺寸也不会失控。

   box 须是定位元素（水滴绝对定位在里面），pick(target) 返回指针下的条目或 null。 */
function liquidLens(box, pick, cls) {
  var lens = document.createElement('span');
  lens.className = 'liquid-lens' + (cls ? ' ' + cls : '');
  lens.setAttribute('aria-hidden', 'true');
  box.appendChild(lens);   // 放在最后，不打乱条目原有的顺序
  var cur = null, lx = 0, ly = 0, lw = 0, lh = 0, settle = 0;
  function place(sx, sy) {
    lens.style.transform = 'translate(' + lx + 'px,' + ly + 'px) scale(' + sx + ',' + sy + ')';
  }
  function grow(px, size) { return Math.min(.1, px / size); }
  function to(el) {
    var first = !cur, x = el.offsetLeft, y = el.offsetTop;
    var horiz = Math.abs(x - lx) >= Math.abs(y - ly);
    lx = x; ly = y; lw = el.offsetWidth; lh = el.offsetHeight;
    if (first) lens.style.transition = 'none';     // 首次出现原地浮起，不从角落飞过来
    lens.style.width = lw + 'px';
    lens.style.height = lh + 'px';
    if (first) {
      place(1 - grow(14, lw), 1 - grow(14, lh));
      void lens.offsetWidth;                         // 先落定起始状态，再恢复过渡
      lens.style.transition = '';
      place(1, 1);
    } else if (el !== cur) {
      if (horiz) place(1 + grow(10, lw), 1 - grow(5, lh));
      else place(1 - grow(5, lw), 1 + grow(10, lh));
      clearTimeout(settle);
      settle = setTimeout(function () { place(1, 1); }, 140);
    }
    cur = el;
    lens.classList.add('on');
  }
  function off() { cur = null; lens.classList.remove('on'); }

  box.addEventListener('pointerover', function (e) { var el = pick(e.target); if (el) to(el); });
  box.addEventListener('pointerleave', off);
  // 按下时鼓起一点
  box.addEventListener('pointerdown', function (e) {
    if (cur && pick(e.target) === cur) place(1 + grow(8, lw), 1 + grow(8, lh));
  });
  box.addEventListener('pointerup', function () { if (cur) place(1, 1); });
  box.addEventListener('focusin', function (e) {
    var el = pick(e.target);
    if (el && e.target.matches(':focus-visible')) to(el);
  });
  box.addEventListener('focusout', off);
  return { lens: lens, off: off };
}

/* ---------- 液态玻璃的交互层 ----------
   折射与高光由 glass.js 用 WebGL 渲染；这里只管悬停水滴与随光标的光斑（所有浏览器）。
   样式的分层说明见 style.css「顶部导航」。 */
(function () {
  var nav = document.querySelector('.nav');
  var wrap = nav && nav.querySelector('.wrap');
  if (!wrap) return;
  // 导航的两块，加上页面里标了 data-lg-pane 的玻璃钮（相册页右下角那组悬浮按钮）
  var panes = [wrap, nav.querySelector('.language-toggle')].filter(Boolean)
    .concat([].slice.call(document.querySelectorAll('[data-lg-pane]')));
  nav.classList.add('lg-live');

  function layer(pane, cls) {
    var n = document.createElement('span');
    n.className = cls;
    n.setAttribute('aria-hidden', 'true');
    pane.appendChild(n);   // 放在最后，不打乱入口与按钮原有的顺序
    return n;
  }

  /* 1. 悬停水滴（见文件开头的 liquidLens）。在玻璃内部，排在光斑之下 */
  liquidLens(wrap, function (t) {
    var a = t.closest && t.closest('a');
    return a && a.parentNode === wrap ? a : null;
  }, 'nav-lens');

  /* 2. 光斑：只写两个变量，渐变由 CSS 画。放在水滴之后，叠在它上面 */
  panes.forEach(function (pane) {
    layer(pane, 'lg-glow');
    pane.addEventListener('pointermove', function (e) {
      var r = pane.getBoundingClientRect();
      pane.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      pane.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
})();
