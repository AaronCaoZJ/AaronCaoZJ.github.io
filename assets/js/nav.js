/* ---------- 悬停水滴 ----------
   一颗水滴跟着指针在一组条目之间滑动：换位时沿移动方向先拉长、
   横向压扁，再随 CSS 的回弹缓动落定，读起来像一滴液体被拖过去。
   拉伸按像素算并封顶 10%（100px 的菜单项是 1.1 x 0.9），换别的尺寸也不会失控。

   box 须是定位元素（水滴绝对定位在里面），pick(target) 返回指针下的条目或 null。
   指针离开所有条目（停在空白处）120ms 后水滴才消失：条目之间的窄缝一划而过，不会闪一下、
   让水滴重新从原地浮起，而是接着滑到下一个条目上。 */
function liquidLens(box, pick, cls) {
  var lens = document.createElement('span');
  lens.className = 'liquid-lens' + (cls ? ' ' + cls : '');
  lens.setAttribute('aria-hidden', 'true');
  box.appendChild(lens);   // 放在最后，不打乱条目原有的顺序
  var cur = null, lx = 0, ly = 0, lw = 0, lh = 0, settle = 0, leave = 0;
  function place(sx, sy) {
    lens.style.transform = 'translate(' + lx + 'px,' + ly + 'px) scale(' + sx + ',' + sy + ')';
  }
  function grow(px, size) { return Math.min(.1, px / size); }
  function to(el) {
    clearTimeout(leave);
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
  function off() { clearTimeout(leave); cur = null; lens.classList.remove('on'); }

  box.addEventListener('pointerover', function (e) {
    var el = pick(e.target);
    if (el) to(el);
    else { clearTimeout(leave); leave = setTimeout(off, 120); }
  });
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
}

/* ---------- 顶部导航 ----------
   导航下面垫着整条的渐变模糊（样式见 style.css「顶部导航」）。页面在顶部时导航下面只有纯色底，
   模糊看不出区别，却要 GPU 每帧多做几遍，所以滚动之后才打开：这里给导航加 / 去 .scrolled，
   另外挂上入口之间的悬停水滴 */
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  function scrolled() { nav.classList.toggle('scrolled', window.scrollY > 0); }
  scrolled();
  window.addEventListener('scroll', scrolled, { passive: true });

  // 整条导航共用一颗悬停水滴（见文件开头的 liquidLens）：入口、相册页的放大镜开关、语言按钮之间都能滑过去；
  // 有它时这些条目自己的悬停底色就不画了（.has-lens）
  var wrap = nav.querySelector('.wrap');
  if (!wrap) return;
  liquidLens(nav, function (t) {
    var el = t.closest && t.closest('a, button');
    if (!el || !nav.contains(el)) return null;
    return el.tagName === 'A' ? (el.parentNode === wrap ? el : null) : el;
  }, 'nav-lens');
  nav.classList.add('has-lens');
})();
