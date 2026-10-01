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

  /* 参数与模型对照两个参考实现：
     - liquid-dom（github.com/AndrewPrifer/liquid-dom）：折射、高光、阴影的物理模型与默认值。
       它本身是 WebGPU 渲染器，而且要开 Chrome 实验开关（HTML-in-Canvas）才能把页面 DOM
       折射进玻璃，公开页面用不了；这里把它的着色模型搬进 SVG 滤镜与 canvas 生成的贴图。
     - liquid-glass（github.com/shuding/liquid-glass）：把位移滤镜挂在 backdrop-filter 上，
       位移图按实际最大位移归一化后编码，8 位精度用满。
     除"厚度"随玻璃尺寸缩小外（见 thick），取值都是 liquid-dom 的默认值。 */
  var G = {
    bezel: 14,              // 弯边宽度上限
    bezelK: .16,            // 小块玻璃的弯边按短边的这个比例收窄（50px 的胶囊 / 圆约 8px）
    edgeRamp: 2.5,          // 最外侧这几像素里位移从 0 渐增：边界两侧内容连续，不会被"切断"
    thickness: 90,          // 玻璃厚度上限
    ior: 1.5,               // 折射率
    frost: 1.5,             // 背景模糊 σ。liquid-dom 默认 blur = 8 太糊；shuding 只有 0.25px。
                            // 取 1.5：背后内容仍清楚可见，带一点柔化，导航文字压得住
    minStretch: .2,         // 边缘取样位置的最小前进率：保证不倒转，最多放大 5 倍
    fieldBlur: 1,           // 位移场模糊：三遍 box 近似高斯。liquid-dom 的 displacementBlur = 6
                            // 对 50px 的小圆太大，会把斜率抹到圆心，整片变成锥形
    light: -Math.PI / 4,    // 光照方向，0 朝上，−π/4 即左上
    spec: { width: 1, feather: 1, strength: 1, falloff: 1, opposite: 1, sharp: 2, opacity: .45 }
  };
  /* 小块玻璃按短边缩小厚度：90px 是给大面板的，放在 50px 高的胶囊上，
     边缘取样会越过对面的边。Apple 也说小块玻璃更通透、透镜更弱 */
  function thick(w, h) { return Math.min(G.thickness, Math.min(w, h)); }
  /* 弯边宽度：圆片要中间平、只有边缘一圈弯，才读得出是一片有厚度的玻璃；
     弯边占满半径就成了锥 */
  function bezelOf(w, h) { return Math.min(G.bezel, G.bezelK * Math.min(w, h)); }

  function smooth(a, b, x) {
    var t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  }
  /* 圆角矩形的有向距离场：o.d 在内为负、在外为正，(o.nx, o.ny) 为朝外的法线 */
  function rrect(px, py, hx, hy, r, o) {
    var qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r, nx, ny;
    if (qx > 0 && qy > 0) {
      var L = Math.sqrt(qx * qx + qy * qy) || 1;
      o.d = L - r; nx = qx / L; ny = qy / L;
    } else if (qx > qy) { o.d = qx - r; nx = 1; ny = 0; }
    else { o.d = qy - r; nx = 0; ny = 1; }
    o.nx = px < 0 ? -nx : nx;
    o.ny = py < 0 ? -ny : ny;
  }
  function radiusOf(pane, w, h) {
    return Math.min(parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0, w / 2, h / 2);
  }

  /* 0. 高光（所有浏览器都有，只是一张图片），即 liquid-dom 的 white specular：
     只落在轮廓往里 width 像素的一条带上（两侧各羽化 feather），
     强度 = (法线·光照方向)^sharp，并有一道镜像方向的对侧高光；
     带内越往里越弱（falloff），整体乘 opacity。 */
  var LX = Math.sin(G.light), LY = -Math.cos(G.light);
  function specularMap(w, h, r) {
    var k = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(w * k), H = Math.round(h * k);
    var S = G.spec, o = {}, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    var reach = S.width + S.feather, unit = Math.max(S.width, S.feather);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        rrect((x + .5) / k - w / 2, (y + .5) / k - h / 2, w / 2, h / 2, r, o);
        var inward = Math.max(-o.d, 0);
        if (o.d > S.feather || inward > reach) continue;
        var band = (1 - smooth(0, S.feather, o.d)) * (1 - smooth(S.width, reach, inward));
        var prog = Math.min(inward / unit, 1), fall = S.falloff * prog * prog;
        var facing = o.nx * LX + o.ny * LY;
        var p = Math.min(Math.max(Math.pow(Math.max(facing, 0), S.sharp) * (S.strength - fall), 0), 1);
        var q = Math.min(Math.max(Math.pow(Math.max(-facing, 0), S.sharp) * (S.opposite - fall), 0), 1);
        var i = (y * W + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.min((p + q) * band, 1) * S.opacity * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  /* 尺寸连续变化时（窄屏菜单展开 / 收起、窗口缩放）不要逐帧重画：一张卡片的贴图要
     二三十毫秒，手机上更慢，动画会卡。先凑合用旧的（高光图拉伸、折射换成普通模糊），
     尺寸稳定 120ms 后再画一次。第一次直接画。 */
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
      if (final) lit.style.backgroundImage = 'url(' + specularMap(w, h, radiusOf(pane, w, h)) + ')';
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

  /* liquid-dom 的凸 squircle 剖面：x 为弯边进度（0 在轮廓上，1 在弯边内侧），
     返回 [高度, 斜率]。比圆弧顶部更平、边上更陡 */
  function squircle(x) {
    var u = 1 - Math.min(Math.max(x, 0), 1), inside = Math.max(1 - u * u * u * u, 1e-4), s = Math.sqrt(inside);
    return [s, 2 * u * u * u / s];
  }
  var TAN85 = Math.tan(85 * Math.PI / 180), ETA = 1 / G.ior;

  /* 可分离的 box 模糊，原地进行；连做三遍近似高斯 */
  function boxBlur(a, w, h, r, tmp) {
    var n = 2 * r + 1, x, y, acc, row;
    for (y = 0; y < h; y++) {
      row = y * w; acc = 0;
      for (x = -r; x <= r; x++) acc += a[row + Math.min(Math.max(x, 0), w - 1)];
      for (x = 0; x < w; x++) {
        tmp[row + x] = acc / n;
        acc += a[row + Math.min(x + r + 1, w - 1)] - a[row + Math.max(x - r, 0)];
      }
    }
    for (x = 0; x < w; x++) {
      acc = 0;
      for (y = -r; y <= r; y++) acc += tmp[Math.min(Math.max(y, 0), h - 1) * w + x];
      for (y = 0; y < h; y++) {
        a[y * w + x] = acc / n;
        acc += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x];
      }
    }
  }

  /* 防倒转系数。厚玻璃在最外缘取样取得太远，取样位置会折返：边上显示一段压缩、
     上下颠倒的像，静止时是一圈暗带，滚动时这圈内容会逆着滚动方向走，非常别扭。
     沿边缘法线按同样的流程（斜率 → 模糊 → 折射）算一遍一维剖面，找出取样位置
     前进最慢的一点，把整张位移场等比缩小到那里仍以 minStretch 的速率前进 ——
     相当于 liquid-dom 的 displacementFactor，只是按"刚好不倒转"自动定。 */
  function foldGuard(T, bz) {
    var P = G.fieldBlur * 3 + 2, L = P + bz + 40, i;
    var sl = new Float32Array(L), fl = new Float32Array(L), ht = new Float32Array(L), tmp = new Float32Array(L);
    for (i = P; i < L; i++) {                       // 下标 P 处是轮廓，往后是玻璃内部
      var inward = i - P + .5, sq = squircle(inward / bz);
      sl[i] = inward > bz ? 0 : Math.min(sq[1], TAN85);
      fl[i] = 1; ht[i] = T + (inward > bz ? 1 : sq[0]) * bz;
    }
    for (var pass = 0; pass < 3; pass++) { boxBlur(sl, L, 1, G.fieldBlur, tmp); boxBlur(fl, L, 1, G.fieldBlur, tmp); }
    var D = new Float32Array(L), worst = 0;
    for (i = P; i < L; i++) {
      var sx = fl[i] > 1e-4 ? sl[i] / fl[i] : 0, inv = 1 / Math.sqrt(sx * sx + 1), cosi = inv;
      var c = ETA * cosi - Math.sqrt(Math.max(1 - ETA * ETA * (1 - cosi * cosi), 0));
      D[i] = -c * sx * inv * ht[i] / Math.max(ETA - c * cosi, 1e-4);   // 向内的偏移量
      if (i > P) worst = Math.max(worst, D[i - 1] - D[i]);             // 每往里 1px，偏移减少多少
    }
    return worst > 0 ? Math.min(1, (1 - G.minStretch) / worst) : 1;
  }

  /* 折射位移图，按 liquid-dom 的流程：
     1. 斜率场：弯边内按 squircle 斜率沿法线倾斜（上限 tan 85°），往里放平；
        预乘覆盖率，模糊时形状外的空值才不会把边缘拉低。
     2. 斜率场整体模糊后再除以模糊过的覆盖率，得到平滑的曲面法线。
     3. 一条垂直向下的视线按 IOR 折射，偏移 = 折射方向的水平分量 / 垂直分量 ×（厚度 + 剖面高度）。
        折射总是朝法线内侧弯，所以边上取的是往里的内容 —— 凸透镜边缘的拉伸。
        再乘以 foldGuard 的系数，最边上只拉伸、不倒转。
     4. 按实际最大偏移归一化编码（shuding 的做法）：R、G 存 x、y，127.5 为不动，
        feDisplacementMap 的 scale 取 2 × 最大偏移。 */
  function refractMap(w, h, r, frost) {
    var P = G.fieldBlur * 3 + 2, FW = w + 2 * P, FH = h + 2 * P, N = FW * FH;
    var vx = new Float32Array(N), vy = new Float32Array(N), fill = new Float32Array(N);
    var hgt = new Float32Array(N), tmp = new Float32Array(N), o = {}, T = thick(w, h), bz = bezelOf(w, h);
    var ramp = new Float32Array(w * h);
    for (var y = 0; y < FH; y++) {
      for (var x = 0; x < FW; x++) {
        rrect(x + .5 - P - w / 2, y + .5 - P - h / 2, w / 2, h / 2, r, o);
        var f = 1 - smooth(0, 1.4, o.d);
        if (f <= 0) continue;
        var inward = Math.max(-o.d, 0), sq = squircle(inward / bz), j = y * FW + x;
        var slope = inward > bz ? 0 : Math.min(sq[1], TAN85);
        vx[j] = o.nx * slope * f; vy[j] = o.ny * slope * f; fill[j] = f;
        hgt[j] = T + (inward > bz ? 1 : sq[0]) * bz;
        var px = x - P, py = y - P;
        if (px >= 0 && py >= 0 && px < w && py < h) ramp[py * w + px] = G.edgeRamp ? smooth(0, G.edgeRamp, inward) : 1;
      }
    }
    for (var pass = 0; pass < 3; pass++) {
      boxBlur(vx, FW, FH, G.fieldBlur, tmp);
      boxBlur(vy, FW, FH, G.fieldBlur, tmp);
      boxBlur(fill, FW, FH, G.fieldBlur, tmp);
    }
    var dx = new Float32Array(w * h), dy = new Float32Array(w * h), max = 0, F = foldGuard(T, bz);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var k = (y + P) * FW + x + P, fb = fill[k];
        if (fb < 1e-4 || !hgt[k]) continue;
        var sx = vx[k] / fb, sy = vy[k] / fb, inv = 1 / Math.sqrt(sx * sx + sy * sy + 1);
        var Nx = sx * inv, Ny = sy * inv, cosi = inv;              // N·(−I)，I 为垂直向下的视线
        var c = ETA * cosi - Math.sqrt(Math.max(1 - ETA * ETA * (1 - cosi * cosi), 0));
        var Tz = -ETA + c * cosi;                                  // 折射方向 = ETA·I + c·N
        var e = y * w + x, t = hgt[k] / Math.max(-Tz, 1e-4);
        dx[e] = c * Nx * t * F * ramp[e]; dy[e] = c * Ny * t * F * ramp[e];
        max = Math.max(max, Math.abs(dx[e]), Math.abs(dy[e]));
      }
    }
    max = Math.max(max, .5);
    var M = Math.ceil(max + frost * 3 + 2), W = w + 2 * M, H = h + 2 * M;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (var i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = 128; d[i + 3] = 255; }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var q = ((y + M) * W + x + M) * 4, e2 = y * w + x;
        d[q]     = Math.round(127.5 + dx[e2] / max * 127.5);
        d[q + 1] = Math.round(127.5 + dy[e2] / max * 127.5);
      }
    }
    g.putImageData(img, 0, 0);
    return { url: cv.toDataURL(), margin: M, scale: 2 * max };
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
    // 和 liquid-dom 一样，折射取的是模糊过的背景
    svgEl('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: G.frost, result: 'frost' }, f);
    var map = svgEl('feImage', { x: 0, y: 0, preserveAspectRatio: 'none', result: 'map' }, f);
    var disp = svgEl('feDisplacementMap', { 'in': 'frost', in2: 'map',
      xChannelSelector: 'R', yChannelSelector: 'G' }, f);

    /* 尺寸变化中折射先换成普通模糊，稳定后再生成位移图挂回去 ——
       折射是"显现"出来的，Apple 描述玻璃出现时也是逐渐调制光的弯折 */
    var fit = settled(pane, function (w, h, final) {
      if (!final) { lyr.style.backdropFilter = 'blur(' + G.frost + 'px)'; return; }
      var m = refractMap(w, h, radiusOf(pane, w, h), G.frost);
      lyr.style.inset = -m.margin + 'px';
      f.setAttribute('width', w + 2 * m.margin); f.setAttribute('height', h + 2 * m.margin);
      map.setAttribute('width', w + 2 * m.margin); map.setAttribute('height', h + 2 * m.margin);
      map.setAttribute('href', m.url);
      disp.setAttribute('scale', m.scale.toFixed(2));
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
