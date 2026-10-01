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

/* ---------- 液态玻璃 ----------
   样式的分层说明见 style.css「顶部导航」。这里管三件事：
   光斑与悬停水滴（所有浏览器），以及只有 Chromium 才有的真折射。 */
(function () {
  var nav = document.querySelector('.nav');
  var wrap = nav && nav.querySelector('.wrap');
  if (!wrap) return;
  var panes = [wrap, nav.querySelector('.language-toggle')].filter(Boolean);
  nav.classList.add('lg-live');

  function layer(pane, cls) {
    var n = document.createElement('span');
    n.className = cls;
    n.setAttribute('aria-hidden', 'true');
    pane.appendChild(n);   // 放在最后：窄屏样式用 a:first-child 认首页，插在前面会带歪
    return n;
  }

  /* 1. 悬停水滴。绝对定位，不参与 flex 排布。
     换位时先压成 1.1 x 0.9 再弹回，配合 CSS 的回弹缓动，读起来像一滴液体被拖过去。 */
  var lens = layer(wrap, 'nav-lens');
  var cur = null, lx = 0, ly = 0, settle = 0;
  function place(sx, sy) {
    lens.style.transform = 'translate(' + lx + 'px,' + ly + 'px) scale(' + sx + ',' + sy + ')';
  }
  function lensTo(a) {
    var first = !cur;
    lx = a.offsetLeft; ly = a.offsetTop;
    if (first) lens.style.transition = 'none';     // 首次出现原地浮起，不从角落飞过来
    lens.style.width = a.offsetWidth + 'px';
    lens.style.height = a.offsetHeight + 'px';
    if (first) {
      place(.86, .86);
      void lens.offsetWidth;                         // 先落定起始状态，再恢复过渡
      lens.style.transition = '';
      place(1, 1);
    } else if (a !== cur) {
      place(1.1, .9);
      clearTimeout(settle);
      settle = setTimeout(function () { place(1, 1); }, 140);
    }
    cur = a;
    lens.classList.add('on');
  }
  function lensOff() { cur = null; lens.classList.remove('on'); }
  function linkOf(t) { var a = t.closest && t.closest('a'); return a && a.parentNode === wrap ? a : null; }

  wrap.addEventListener('pointerover', function (e) { var a = linkOf(e.target); if (a) lensTo(a); });
  wrap.addEventListener('pointerleave', lensOff);
  wrap.addEventListener('pointerdown', function (e) { if (cur && linkOf(e.target) === cur) place(1.12, 1.08); });
  wrap.addEventListener('pointerup', function () { if (cur) place(1, 1); });
  wrap.addEventListener('focusin', function (e) {
    var a = linkOf(e.target);
    if (a && a.matches(':focus-visible')) lensTo(a);
  });
  wrap.addEventListener('focusout', lensOff);
  // 窄屏菜单收起时，水滴所在的那一行已经藏起来了
  new MutationObserver(function () { if (!nav.classList.contains('open')) lensOff(); })
    .observe(nav, { attributes: true, attributeFilter: ['class'] });

  /* 2. 光斑：只写两个变量，渐变由 CSS 画。放在水滴之后，叠在它上面 */
  panes.forEach(function (pane) {
    layer(pane, 'lg-glow');
    pane.addEventListener('pointermove', function (e) {
      var r = pane.getBoundingClientRect();
      pane.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      pane.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* 3. 折射：backdrop-filter 引用 SVG 位移滤镜。只有 Chromium 渲染它 ——
     Safari 与 Firefox 会把整条 backdrop-filter 当无效值丢掉，连兜底的模糊都没了，
     所以必须先认准是 Chromium 再挂。userAgentData 只有 Chromium 系实现。 */
  var brands = navigator.userAgentData && navigator.userAgentData.brands || [];
  var chromium = brands.some(function (b) { return b.brand === 'Chromium'; });
  var lowT = window.matchMedia && window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
  if (!chromium || lowT || !window.ResizeObserver) return;

  var M = 24;          // 折射层四周外扩，须与 style.css 里 .lg-refract 的 inset 一致
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* 位移图：每个像素存"该处应从哪里取背景"，R、G 分别管 x、y，128 为不动。
     按圆角矩形的有向距离场算：离边缘 bezel 以内，沿法线**向外**取样，
     最外缘取到约 dmax 之外，越往里越近（平方衰减）。外面一段内容被压缩着
     折进边缘，往里逐渐过渡到平坦 —— 这是凸边玻璃的样子。
     向外取样时，取样点随位置单调变化，再强也不会在边缘翻折成镜像条纹。
     图的尺寸是整个折射层（胶囊 + 四周 M），胶囊以外的部分最终被裁掉，填 128。
     B 通道空着没用，拿来存"边缘区"遮罩：边上为 1，进到 bezel 处降到 0 ——
     滤镜据此把清晰的折射边和磨砂的中间区拼起来。 */
  function refractMap(w, h, r, bezel) {
    var W = w + 2 * M, H = h + 2 * M;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    var hx = w / 2, hy = h / 2, ix = hx - r, iy = hy - r;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var px = x + .5 - M - hx, py = y + .5 - M - hy;
        var qx = Math.abs(px) - ix, qy = Math.abs(py) - iy, nx = 0, ny = 0, dist;
        if (qx > 0 && qy > 0) {              // 圆角段：法线沿径向
          var L = Math.sqrt(qx * qx + qy * qy) || 1;
          dist = r - L; nx = qx / L; ny = qy / L;
        } else if (qx > qy) { dist = r - qx; nx = 1; }   // 左右直边
        else { dist = r - qy; ny = 1; }                   // 上下直边
        var t = dist >= 0 && dist < bezel ? 1 - dist / bezel : 0;
        var k = t * t;
        var i = (y * W + x) * 4;
        d[i]     = 128 + (px < 0 ? -nx : nx) * k * 127;   // 法线朝外，取样也朝外
        d[i + 1] = 128 + (py < 0 ? -ny : ny) * k * 127;
        d[i + 2] = t * 255; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  var defs = svgEl('svg', { 'aria-hidden': 'true', width: 0, height: 0 });
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(defs);

  /* 色散：R、G、B 各自按略不同的强度位移再合成，边缘出现一丝真实玻璃的彩边。
     三个通道各取一路，用 arithmetic 相加（k2 = k3 = 1）拼回一张图。 */
  var CH = [['R', .95, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
            ['G', 1,   '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
            ['B', 1.05, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']];

  panes.forEach(function (pane, n) {
    var id = 'lg-refract-' + n;
    // color-interpolation-filters 必须是 sRGB：默认的 linearRGB 会把位移图的 128 当成别的值，
    // 整块玻璃就会平白往一个方向偏
    var f = svgEl('filter', { id: id, x: 0, y: 0, filterUnits: 'userSpaceOnUse',
      primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
    /* 两区：边缘只轻微模糊，让折进来的外部内容看得清；中间磨砂得更重，
       背后是正文时导航文字才压得住。两区都按同一张图位移，过渡处不会错位。 */
    svgEl('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: 1.2, result: 'sharp' }, f);
    svgEl('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: 5, result: 'frost' }, f);
    var map = svgEl('feImage', { x: 0, y: 0, preserveAspectRatio: 'none', result: 'map' }, f);
    var disps = CH.map(function (c) {
      var dm = svgEl('feDisplacementMap', { 'in': 'sharp', in2: 'map',
        xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + c[0] }, f);
      svgEl('feColorMatrix', { 'in': 'd' + c[0], type: 'matrix', values: c[2], result: 'c' + c[0] }, f);
      return dm;
    });
    svgEl('feComposite', { 'in': 'cR', in2: 'cG', operator: 'arithmetic', k2: 1, k3: 1, result: 'rim' }, f);
    svgEl('feComposite', { 'in': 'rim', in2: 'cB', operator: 'arithmetic', k2: 1, k3: 1, result: 'rim' }, f);
    disps.push(svgEl('feDisplacementMap', { 'in': 'frost', in2: 'map',
      xChannelSelector: 'R', yChannelSelector: 'G', result: 'body' }, f));
    // B 通道 → alpha：只留下边缘区的清晰折射，盖在磨砂的中间区上
    svgEl('feColorMatrix', { 'in': 'map', type: 'matrix',
      values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0', result: 'edge' }, f);
    svgEl('feComposite', { 'in': 'rim', in2: 'edge', operator: 'in', result: 'rimOnly' }, f);
    svgEl('feComposite', { 'in': 'rimOnly', in2: 'body', operator: 'over', result: 'glass' }, f);
    svgEl('feColorMatrix', { 'in': 'glass', type: 'saturate', values: 1.3 }, f);

    var w0 = 0, h0 = 0;
    function fit() {
      var w = pane.offsetWidth, h = pane.offsetHeight;
      if (!w || !h || (w === w0 && h === h0)) return;
      w0 = w; h0 = h;
      var r = Math.min(parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0, w / 2, h / 2);
      var bezel = Math.min(20, h * .4);
      var dmax = Math.min(M - 5, bezel * .9);       // 留 5px 给模糊，免得取到折射层边界之外
      f.setAttribute('width', w + 2 * M); f.setAttribute('height', h + 2 * M);
      map.setAttribute('width', w + 2 * M); map.setAttribute('height', h + 2 * M);
      map.setAttribute('href', refractMap(w, h, r, bezel));
      // 位移 = scale × (通道值 − 0.5)，通道值最大偏离约 0.498
      disps.forEach(function (dm, i) {   // 前三个是 R/G/B 色散，最后一个是磨砂区
        dm.setAttribute('scale', (dmax / .498 * (CH[i] ? CH[i][1] : 1)).toFixed(2));
      });
    }

    var lyr = layer(pane, 'lg-refract');
    // 胶囊自己不能再带 backdrop-filter：那样它会成为"背景根"，折射层只读得到胶囊内部
    pane.style.backdropFilter = pane.style.webkitBackdropFilter = 'none';
    lyr.style.backdropFilter = 'url(#' + id + ')';
    fit();
    // 窄屏菜单展开时 .wrap 逐帧变高。ResizeObserver 本来就在每帧渲染时最多回调一次，
    // 不必再用 rAF 节流；位移图只有几百像素见方，生成一次不到 1ms
    new ResizeObserver(fit).observe(pane);
  });
})();
