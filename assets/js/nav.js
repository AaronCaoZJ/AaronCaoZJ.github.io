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

  /* 光学模型移植自 ybouane/liquidglass（github.com/ybouane/liquidglass，MIT）的片元着色器
     FS_GLASS，参数取它的默认值。原库用 html-to-image 把页面栅格化后交给 WebGL 渲染；
     本页是一整页滚动内容、里面还有视频，每帧重新栅格化代价太大，所以只搬公式：
     折射逐像素算成位移图交给 SVG 位移滤镜（仅 Chromium），高光画成图片（所有浏览器）。 */
  var G = {
    refraction: .69,        // 折射强度
    zRadius: 40,            // 弯边深度（CSS px）：截面是半圆，高度 sqrt(d·(2zR − d))
    chroma: .05,            // 色散
    edgeHL: .05,            // 边缘高光
    fresnel: 1,             // 菲涅耳反射
    frost: 1                // 背景模糊 σ（物理像素）。原库演示里的 Regular Glass 是 0，按钮是 3.2
                            // （blurAmount 0.3）；3.2 会把纯色交界抹成十几像素宽的渐变。
                            // 取 1：交界和 0 一样利落，只顺手抹平弯边处逐像素取样的锯齿
  };

  function smooth(a, b, x) {                     // 同 GLSL smoothstep，a > b 时反向
    var t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  }
  function rrSDF(px, py, hx, hy, r) {            // 圆角矩形有向距离：内负外正
    var qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r;
    var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - r;
  }
  function bevelHeight(d, zR) {
    if (d <= 0) return 0;
    if (d >= zR) return zR;
    return Math.sqrt(d * (2 * zR - d));
  }
  function frostCss() { return G.frost / (window.devicePixelRatio || 1); }   // 模糊 σ 换成 CSS 像素
  function radiusOf(pane, w, h) {
    return Math.min(parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0, w / 2, h / 2);
  }

  /* 玻璃上一点 (px, py)（以中心为原点、y 向下，CSS 像素）的光学量，写进 o：
     sdf、法线 N、折射取样偏移 (rx, ry)、色散偏移 (cx, cy)（都是 CSS 像素）、
     白色高光强度 hl、边缘遮罩 mask。逐行对应 FS_GLASS。
     单位要跟原库一致：它把尺寸、圆角、弯边深度都乘以 devicePixelRatio 传进着色器，
     而着色器里的常数（折射 ×30、色散 ×18、差分步长 2、描边 1.5 …）都按物理像素算。
     所以这里先换成物理像素算，最后再除回 CSS 像素 —— Retina 屏上偏移只有按 CSS 像素算的一半 */
  var IOR = 1.5, REFR_POW = 1 - 1 / IOR, E = 2;
  function glassAt(px, py, hx, hy, r, o) {
    var D = window.devicePixelRatio || 1;
    px *= D; py *= D; hx *= D; hy *= D; r *= D;
    /* 弯边深度不超过短边的一半：原库默认 40，比 50px 胶囊的半高 25 还深，上下两段圆弧
       在中线处以一个夹角相接，斜率在中线两侧突然反向 —— 上半往下取、下半往上取，
       中线上出现一道几像素宽的接缝，看起来上下是分段的。原库演示的面板都比 80px 高，
       弯边在中线前就放平了，所以碰不到。封顶到半高后中线处斜率正好为 0，截面是光滑的半圆 */
    var sdf = rrSDF(px, py, hx, hy, r), zR = Math.min(G.zRadius * D, Math.min(hx, hy));
    o.sdf = sdf;
    var inside = -sdf, maxD = Math.min(hx, hy);
    var edge = smooth(maxD * .35, 0, inside);
    var hC = bevelHeight(inside, zR);
    var hR = bevelHeight(-rrSDF(px + E, py, hx, hy, r), zR), hL = bevelHeight(-rrSDF(px - E, py, hx, hy, r), zR);
    var hU = bevelHeight(-rrSDF(px, py + E, hx, hy, r), zR), hD = bevelHeight(-rrSDF(px, py - E, hx, hy, r), zR);
    var gx = (hR - hL) / (2 * E), gy = (hU - hD) / (2 * E);
    var nl = Math.sqrt(gx * gx + gy * gy + 1), Nx = -gx / nl, Ny = -gy / nl, Nz = 1 / nl;
    var depth = smooth(0, zR, inside);
    // 双凸：入射、出射各折一次，再加穿过厚度的一段；外加一点朝中心的整体放大
    var thickNorm = hC * 2 / Math.max(zR * 2, 1);
    var k = REFR_POW * (2 + thickNorm * .5) * G.refraction * 30;
    o.rx = (gx * k - px / Math.max(hx, 1) * G.refraction * 4 * depth) / D;
    o.ry = (gy * k - py / Math.max(hy, 1) * G.refraction * 4 * depth) / D;
    var caS = G.chroma * 18 * (edge * .7 + .3) * 2 / D;
    o.cx = Nx * caS; o.cy = Ny * caS;
    // 高光：菲涅耳、内描边（上沿更亮）、边缘光、内辉光、底部的环境反射
    var fres = Math.pow(1 - Math.abs(Nz), 4) * G.fresnel;
    var bw = 1.5, stroke = smooth(-bw - 1, -bw, sdf) * (1 - smooth(-1, 0, sdf));
    stroke *= .4 + .6 * (.5 + .5 * (-py / hy));
    var add = edge * G.edgeHL * .22 + smooth(5, 0, inside) * G.edgeHL * .15
            + stroke * G.edgeHL * .55 + (Ny * .5 + .5) * fres * .08;
    o.hl = 1 - (1 - Math.min(add, 1)) * (1 - fres * .2);   // col + add 再向白色混 fres·0.2
    o.mask = 1 - smooth(-1.5, .5, sdf);                    // 最外 1.5px 渐回未折射的背景
  }

  /* 0. 高光图（所有浏览器都有，只是一张图片） */
  function specularMap(w, h, r) {
    var k = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(w * k), H = Math.round(h * k);
    var o = {}, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        glassAt((x + .5) / k - w / 2, (y + .5) / k - h / 2, w / 2, h / 2, r, o);
        if (o.sdf > .5) continue;
        var i = (y * W + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.min(o.hl * o.mask, 1) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  /* 尺寸连续变化时（窄屏菜单展开 / 收起、窗口缩放）不要逐帧重画：一张卡片的贴图要
     二三十毫秒，手机上更慢，动画会卡。变化期间高光层先隐藏、折射换成普通模糊，
     尺寸稳定 120ms 后再画一次。第一次直接画。
     高光层不能拿旧图拉伸着凑合：50px 圆片那圈亮边被拉大约 5 倍，
     展开时卡片四周会出现一圈二十多像素宽的白光。 */
  function settled(pane, draw) {
    var w0 = 0, h0 = 0, timer = 0, ready = false;
    function run() {
      var w = pane.offsetWidth, h = pane.offsetHeight;
      if (!w || !h) return;
      w0 = w; h0 = h; draw(w, h, true);
    }
    return function () {
      var w = pane.offsetWidth, h = pane.offsetHeight;
      if (!w || !h || (w === w0 && h === h0)) return;
      if (!ready) { ready = true; run(); return; }
      draw(w, h, false);
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    };
  }
  panes.forEach(function (pane) {
    var lit = layer(pane, 'lg-light');
    var relight = settled(pane, function (w, h, final) {
      if (!final) { lit.style.opacity = '0'; return; }
      lit.style.backgroundImage = 'url(' + specularMap(w, h, radiusOf(pane, w, h)) + ')';
      lit.style.opacity = '';
    });
    relight();
    if (window.ResizeObserver) new ResizeObserver(relight).observe(pane);
  });

  /* 1. 悬停水滴（见文件开头的 liquidLens）。在玻璃内部，排在光斑之下 */
  var drop = liquidLens(wrap, function (t) {
    var a = t.closest && t.closest('a');
    return a && a.parentNode === wrap ? a : null;
  }, 'nav-lens');
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

  /* 位移图：R、G、B 三个通道各一张（色散：红取 偏移+色散，蓝取 偏移−色散），
     每张的 R、G 存 x、y 偏移，127.5 为不动，B 存遮罩（最外 1.5px 渐回背景）。
     三张共用一个归一化尺度（shuding 的做法），feDisplacementMap 的 scale = 2 × 最大偏移。
     取样会伸出胶囊之外（边缘能映出对面的内容），折射层四周外扩到最大偏移以外。 */
  function refractMaps(w, h, r) {
    var k = Math.min(window.devicePixelRatio || 1, 2), hx = w / 2, hy = h / 2, o = {};
    var Wd = Math.round(w * k), Hd = Math.round(h * k), N = Wd * Hd;
    var f = { rx: new Float32Array(N), ry: new Float32Array(N), cx: new Float32Array(N),
              cy: new Float32Array(N), m: new Float32Array(N) }, max = .5;
    for (var y = 0; y < Hd; y++) {
      for (var x = 0; x < Wd; x++) {
        glassAt((x + .5) / k - hx, (y + .5) / k - hy, hx, hy, r, o);
        if (o.sdf > .5) continue;
        var j = y * Wd + x;
        f.rx[j] = o.rx; f.ry[j] = o.ry; f.cx[j] = o.cx; f.cy[j] = o.cy; f.m[j] = o.mask;
        max = Math.max(max, Math.abs(o.rx) + Math.abs(o.cx), Math.abs(o.ry) + Math.abs(o.cy));
      }
    }
    var M = Math.ceil(max + frostCss() * 3 + 2), CW = Wd + Math.round(2 * M * k), CH = Hd + Math.round(2 * M * k);
    var mk = Math.round(M * k), urls = [];
    [1, 0, -1].forEach(function (sign) {         // 红、绿、蓝
      var cv = document.createElement('canvas');
      cv.width = CW; cv.height = CH;
      var g = cv.getContext('2d'), img = g.createImageData(CW, CH), d = img.data;
      for (var i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = 128; d[i + 3] = 255; }
      for (var y = 0; y < Hd; y++) {
        for (var x = 0; x < Wd; x++) {
          var j = y * Wd + x;
          if (!f.m[j]) continue;
          var q = ((y + mk) * CW + x + mk) * 4;
          d[q]     = Math.round(127.5 + (f.rx[j] + sign * f.cx[j]) / max * 127.5);
          d[q + 1] = Math.round(127.5 + (f.ry[j] + sign * f.cy[j]) / max * 127.5);
          d[q + 2] = Math.round(f.m[j] * 255);
        }
      }
      g.putImageData(img, 0, 0);
      urls.push(cv.toDataURL());
    });
    return { urls: urls, margin: M, scale: 2 * max, fw: CW / k, fh: CH / k };
  }

  var defs = svgEl('svg', { 'aria-hidden': 'true', width: 0, height: 0 });
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(defs);

  var aligners = [];
  function alignAll() { aligners.forEach(function (f) { f(); }); }
  window.addEventListener('resize', alignAll);

  panes.forEach(function (pane, n) {
    var id = 'lg-refract-' + n;
    // color-interpolation-filters 必须是 sRGB：默认的 linearRGB 会把位移图的 128 当成别的值，
    // 整块玻璃就会平白往一个方向偏
    var f = svgEl('filter', { id: id, x: 0, y: 0, filterUnits: 'userSpaceOnUse',
      primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
    /* 背景先轻模糊；三个通道各用自己的位移图折射，各取一个颜色分量拼回去（色散）；
       再按遮罩与未折射的背景混合（边缘抗锯齿），最后整体提亮 6%（原着色器 col *= 1 + 0.06·depth） */
    var blur = svgEl('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: frostCss(), result: 'frost' }, f);
    var ONLY = ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
                '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
                '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'];
    var maps = [], disps = [];
    ['R', 'G', 'B'].forEach(function (c, i) {
      maps.push(svgEl('feImage', { x: 0, y: 0, preserveAspectRatio: 'none', result: 'map' + c }, f));
      disps.push(svgEl('feDisplacementMap', { 'in': 'frost', in2: 'map' + c,
        xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' + c }, f));
      svgEl('feColorMatrix', { 'in': 'bent' + c, type: 'matrix', values: ONLY[i], result: 'only' + c }, f);
    });
    svgEl('feComposite', { 'in': 'onlyR', in2: 'onlyG', operator: 'arithmetic', k2: 1, k3: 1, result: 'rg' }, f);
    svgEl('feComposite', { 'in': 'rg', in2: 'onlyB', operator: 'arithmetic', k2: 1, k3: 1, result: 'glass' }, f);
    svgEl('feColorMatrix', { 'in': 'mapG', type: 'matrix',
      values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0', result: 'mask' }, f);
    svgEl('feComposite', { 'in': 'glass', in2: 'mask', operator: 'in', result: 'glassIn' }, f);
    svgEl('feComposite', { 'in': 'glassIn', in2: 'SourceGraphic', operator: 'over', result: 'lens' }, f);
    var lift = svgEl('feComponentTransfer', { 'in': 'lens' }, f);
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach(function (t) { svgEl(t, { type: 'linear', slope: 1.06 }, lift); });

    /* 尺寸变化中折射先换成普通模糊，稳定后再生成位移图挂回去 ——
       折射是"显现"出来的，Apple 描述玻璃出现时也是逐渐调制光的弯折 */
    var fit = settled(pane, function (w, h, final) {
      if (!final) { lyr.style.backdropFilter = 'blur(' + frostCss() + 'px)'; return; }
      blur.setAttribute('stdDeviation', frostCss().toFixed(2));   // 拖到另一块屏幕后 dpr 会变
      var m = refractMaps(w, h, radiusOf(pane, w, h));
      lyr.style.inset = -m.margin + 'px';
      f.setAttribute('width', m.fw); f.setAttribute('height', m.fh);
      maps.forEach(function (mp, i) {
        mp.setAttribute('width', m.fw); mp.setAttribute('height', m.fh);
        mp.setAttribute('href', m.urls[i]);
      });
      disps.forEach(function (dm) { dm.setAttribute('scale', m.scale.toFixed(2)); });
      lyr.style.backdropFilter = 'url(#' + id + ')';
    });

    var lyr = layer(pane, 'lg-refract');
    // 胶囊自己不能再带 backdrop-filter：那样它会成为"背景根"，折射层只读得到胶囊内部
    pane.style.backdropFilter = pane.style.webkitBackdropFilter = 'none';

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
    // 任一块玻璃变了尺寸，另一块的位置也可能跟着变（语言按钮排在胶囊右边），全部重新对齐
    new ResizeObserver(function () { fit(); alignAll(); }).observe(pane);
  });
})();
