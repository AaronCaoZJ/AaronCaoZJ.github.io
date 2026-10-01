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

/* ---------- 悬停水滴（导航、联系方式、论文卡片共用） ----------
   一颗玻璃水滴跟着指针在一组条目之间滑动：换位时沿移动方向先拉长、
   横向压扁，再随 CSS 的回弹缓动落定，读起来像一滴液体被拖过去。
   拉伸按像素算并封顶 10%：100px 的菜单项是 1.1 x 0.9，
   一张 700px 宽的论文卡片只多出十几像素，不会夸张地放大一成。

   box 须是定位元素（水滴绝对定位在里面），pick(target) 返回指针下的条目或 null；
   opt.outset 让水滴比条目大出一圈（论文卡片不透明，水滴只能从四周露出来）。 */
function liquidLens(box, pick, opt) {
  opt = opt || {};
  var o = opt.outset || 0;
  var lens = document.createElement('span');
  lens.className = 'liquid-lens' + (opt.cls ? ' ' + opt.cls : '');
  lens.setAttribute('aria-hidden', 'true');
  box.appendChild(lens);   // 放在最后，不打乱条目原有的顺序
  var cur = null, lx = 0, ly = 0, lw = 0, lh = 0, settle = 0;
  function place(sx, sy) {
    lens.style.transform = 'translate(' + lx + 'px,' + ly + 'px) scale(' + sx + ',' + sy + ')';
  }
  function grow(px, size) { return Math.min(.1, px / size); }
  function to(el) {
    var first = !cur, x = el.offsetLeft - o, y = el.offsetTop - o;
    var horiz = Math.abs(x - lx) >= Math.abs(y - ly);
    lx = x; ly = y; lw = el.offsetWidth + 2 * o; lh = el.offsetHeight + 2 * o;
    if (first) lens.style.transition = 'none';     // 首次出现原地浮起，不从角落飞过来
    lens.style.width = lw + 'px';
    lens.style.height = lh + 'px';
    if (opt.radius) lens.style.borderRadius = opt.radius;
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
    pane.appendChild(n);   // 放在最后，不打乱入口与按钮原有的顺序
    return n;
  }

  /* 弯边向内延伸的深度（px）：光照与折射共用，两者必须落在同一圈上。
     小块玻璃不宜太"鼓" */
  function bevelOf(h) { return Math.min(18, h * .36); }

  /* 0. 光照：贴着轮廓的一道细亮边，所有浏览器都有（只是一张图片）。
     按菲涅耳效应来：视线越贴近曲面（越靠轮廓），反射越强 —— 把弯边当作
     四分之一圆弧，亮度取 (1 − N·V)⁴，几乎全落在最外侧两三个像素里，往内迅速衰减，
     中间保持通透。再按朝向调强弱：朝左上方光源的一侧最亮，正对面有一道
     内部反射回来的次高光，两侧最暗。
     不用宽的高光波瓣：那会在弯边内侧铺开一大片白，压在深色照片上就成了乳白雾斑。 */
  var LX = -.5, LY = -.85, LN = Math.sqrt(LX * LX + LY * LY);
  LX /= LN; LY /= LN;
  var RIM = { key: 1, back: .55, side: .22, power: 4 };
  function lightMap(w, h, r, bezel) {
    var k = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(w * k), Hh = Math.round(h * k);
    var c = document.createElement('canvas');
    c.width = W; c.height = Hh;
    var g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
    var hx = w / 2, hy = h / 2, ix = hx - r, iy = hy - r;
    for (var y = 0; y < Hh; y++) {
      for (var x = 0; x < W; x++) {
        var px = (x + .5) / k - hx, py = (y + .5) / k - hy;
        var qx = Math.abs(px) - ix, qy = Math.abs(py) - iy, nx = 0, ny = 0, dist;
        if (qx > 0 && qy > 0) { var Lq = Math.sqrt(qx * qx + qy * qy) || 1; dist = r - Lq; nx = qx / Lq; ny = qy / Lq; }
        else if (qx > qy) { dist = r - qx; nx = 1; }
        else { dist = r - qy; ny = 1; }
        if (dist < 0 || dist >= bezel) continue;            // 弯边以外透明
        if (px < 0) nx = -nx;
        if (py < 0) ny = -ny;
        var u = 1 - dist / bezel;                             // 1 在轮廓上，0 在弯边内侧
        var nv = Math.sqrt(Math.max(1 - u * u, 0));           // 圆弧上法线与视线夹角的余弦
        var fres = Math.pow(1 - nv, RIM.power);
        var facing = nx * LX + ny * LY;                       // 1 朝光，−1 背光
        var a = fres * (RIM.side + RIM.key * Math.max(0, facing) + RIM.back * Math.max(0, -facing));
        var i = (y * W + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.min(a, 1) * 235;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  panes.forEach(function (pane) {
    var lit = layer(pane, 'lg-light'), w0 = 0, h0 = 0;
    function relight() {
      var w = pane.offsetWidth, h = pane.offsetHeight;
      if (!w || !h || (w === w0 && h === h0)) return;
      w0 = w; h0 = h;
      var r = Math.min(parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0, w / 2, h / 2);
      lit.style.backgroundImage = 'url(' + lightMap(w, h, r, bevelOf(h)) + ')';
    }
    relight();
    if (window.ResizeObserver) new ResizeObserver(relight).observe(pane);
  });

  /* 1. 悬停水滴（见文件开头的 liquidLens）。在玻璃内部，排在光斑之下 */
  var drop = liquidLens(wrap, function (t) {
    var a = t.closest && t.closest('a');
    return a && a.parentNode === wrap ? a : null;
  }, { cls: 'nav-lens' });
  // 窄屏菜单收起时，水滴所在的那一行已经藏起来了
  new MutationObserver(function () { if (!nav.classList.contains('open')) drop.off(); })
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

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* 位移图：每个像素存"该处应从哪里取背景"，R、G 分别管 x、y，128 为不动。
     按圆角矩形的有向距离场算：离边缘 bezel 以内，沿法线**向内**取样 ——
     边上显示的是往里一点的内容，一小段被摊开到整条边上，即凸透镜边缘的**拉伸放大**。
     位移按 (1 − t)² 衰减、最外缘为 0.42 个 bezel：此时取样位置对坐标的导数
     在边上是 1 − 2 × 0.42 = 0.16（约放大 6 倍），且处处为正 —— 超过 0.5
     导数就会变负，取样点在边缘折返，背景被镜像成一道道条纹。
     图的尺寸是整个折射层（胶囊 + 四周外扩 M），胶囊以外的部分最终被裁掉，填 128。
     B 通道空着没用，拿来存"边缘区"遮罩：边上为 1，进到 bezel 处降到 0 ——
     滤镜据此把清晰的折射边和磨砂的中间区拼起来。 */
  function refractMap(w, h, r, bezel, M) {   // M：折射层四周外扩的像素
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
        d[i]     = 128 - (px < 0 ? -nx : nx) * k * 127;   // 法线朝外，取样朝内
        d[i + 1] = 128 - (py < 0 ? -ny : ny) * k * 127;
        d[i + 2] = t * 255; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  var defs = svgEl('svg', { 'aria-hidden': 'true', width: 0, height: 0 });
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(defs);

  /* 色散：R、G、B 各自按略不同的强度位移（±2.5%）再合成，边缘出现一丝真实玻璃的彩边；
     再大就成了明显的蓝紫色描边。
     三个通道各取一路，用 arithmetic 相加（k2 = k3 = 1）拼回一张图。 */
  var CH = [['R', .975, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
            ['G', 1,   '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
            ['B', 1.025, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']];

  var aligners = [];
  function alignAll() { aligners.forEach(function (f) { f(); }); }
  window.addEventListener('resize', alignAll);

  panes.forEach(function (pane, n) {
    var id = 'lg-refract-' + n;
    // color-interpolation-filters 必须是 sRGB：默认的 linearRGB 会把位移图的 128 当成别的值，
    // 整块玻璃就会平白往一个方向偏
    var f = svgEl('filter', { id: id, x: 0, y: 0, filterUnits: 'userSpaceOnUse',
      primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
    /* 两区：边缘只轻微模糊，让折进来的外部内容看得清；中间磨砂得更重，
       背后是正文时导航文字才压得住。两区都按同一张图位移，过渡处不会错位。 */
    svgEl('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: 1.2, result: 'sharp' }, f);
    var frost = svgEl('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: 5, result: 'frost' }, f);
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
      var bezel = bevelOf(h);
      /* 磨砂随玻璃变大而加重：小胶囊 5px，窄屏菜单长成卡片后到 10px
         （Apple："玻璃越大，散射越柔"）。连续过渡，展开途中不会跳一下。
         折射层外扩取模糊半径的 3 倍，模糊才读得到足够的背景，卡片边缘不发虚 */
      var sigma = 5 + 5 * Math.min(Math.max((h - 50) / 150, 0), 1);
      var M = Math.ceil(sigma * 3);
      frost.setAttribute('stdDeviation', sigma.toFixed(2));
      lyr.style.inset = -M + 'px';
      var dmax = bezel * .42;              // 见 refractMap 的说明：再大就折返
      f.setAttribute('width', w + 2 * M); f.setAttribute('height', h + 2 * M);
      map.setAttribute('width', w + 2 * M); map.setAttribute('height', h + 2 * M);
      map.setAttribute('href', refractMap(w, h, r, bezel, M));
      // 位移 = scale × (通道值 − 0.5)，通道值最大偏离约 0.498
      disps.forEach(function (dm, i) {   // 前三个是 R/G/B 色散，最后一个是磨砂区
        dm.setAttribute('scale', (dmax / .498 * (CH[i] ? CH[i][1] : 1)).toFixed(2));
      });
    }

    var lyr = layer(pane, 'lg-refract');
    // 胶囊自己不能再带 backdrop-filter：那样它会成为"背景根"，折射层只读得到胶囊内部
    pane.style.backdropFilter = pane.style.webkitBackdropFilter = 'none';
    lyr.style.backdropFilter = 'url(#' + id + ')';

    /* 投影替身：紧跟在胶囊后面插入，在胶囊画完之后才画，折射层就读不到它。
       语言按钮的替身紧挨着按钮，CSS 用 + 选择器让它跟着按钮一起缩放 */
    var shade = document.createElement('span');
    shade.className = 'lg-shadow';
    shade.setAttribute('aria-hidden', 'true');
    pane.parentNode.insertBefore(shade, pane.nextSibling);
    pane.style.boxShadow = 'none';
    function align() {
      shade.style.left = pane.offsetLeft + 'px';
      shade.style.top = pane.offsetTop + 'px';
      shade.style.width = pane.offsetWidth + 'px';
      shade.style.height = pane.offsetHeight + 'px';
      shade.style.borderRadius = getComputedStyle(pane).borderTopLeftRadius;
      shade.hidden = !pane.offsetWidth;          // 语言按钮在 i18n 就绪前是隐藏的
    }
    aligners.push(align);
    fit();
    align();
    // 窄屏菜单展开时 .wrap 逐帧变高。ResizeObserver 本来就在每帧渲染时最多回调一次，
    // 不必再用 rAF 节流；位移图只有几百像素见方，生成一次不到 1ms
    // 任一块玻璃变了尺寸，另一块的位置也可能跟着变（语言按钮排在胶囊右边），全部重新对齐
    new ResizeObserver(function () { fit(); alignAll(); }).observe(pane);
  });
})();

/* ---------- 页面里的悬停水滴 ----------
   联系方式那排小胶囊，以及论文 / 写作两组卡片，用和导航同一种水滴代替原来的上浮。
   盒子加上 lens-live 后，条目自己的悬停描边与投影就撤掉，免得两种反馈叠在一起。 */
(function () {
  function direct(box, sel) {
    return function (t) {
      var el = t.closest && t.closest(sel);
      return el && el.parentNode === box ? el : null;
    };
  }
  var links = document.querySelector('.links');
  if (links) {
    liquidLens(links, direct(links, 'a'));
    links.classList.add('lens-live');
  }
  ['publications', 'writing'].forEach(function (id) {
    var sec = document.getElementById(id);
    if (!sec || !sec.querySelector('.pub')) return;
    // 卡片圆角 14px，水滴大出 6px，圆角相应放到 20px，四周的光环才是等宽的
    liquidLens(sec, direct(sec, '.pub'), { cls: 'pub-lens', outset: 6, radius: '20px' });
    sec.classList.add('lens-live');
  });
})();
