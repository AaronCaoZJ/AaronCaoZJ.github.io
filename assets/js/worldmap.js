/* 访客世界地图 —— 错位点阵的平面地图，零外部依赖。

   陆地用一张 180x101 的位掩码画成圆点：每行 45 个十六进制字符，
   一个字符管四格，整张图 4.5 KB，不需要任何地图库或瓦片服务。

   点阵是错位（六边形）排布：奇数行右移半格，行距取列距的 √3/2，
   每个点与周围六个点等距。比横平竖直的方格细腻，也不会在斜向海岸线
   上出现锯齿台阶。

   投影是 Miller 圆柱：纬线仍是水平直线，但越往高纬行距越大，
   整张图约 2:1，接近平常看惯的世界地图。等距圆柱（纬线等距）会有
   2.6:1 那么扁；墨卡托则把格陵兰放大到跟非洲差不多。Miller 介于两者之间。

   掩码由 Natural Earth 110m 陆地边界离线生成：每行取该行中心的纬线，
   在格心做扫描线判定。纬度裁到 83N~56S，去掉南极洲和北冰洋的空行；
   左右切在白令海峡，大西洋居中。 */
/* ---------- 记一次访问 ----------
   与地图的显示完全解耦：地图被隐藏、#visitorMap 不存在时照样记录，
   恢复显示那天看到的是连续的数据，而不是隐藏期间的一段空白。

   同一浏览器 24 小时内只记一次 —— 判断在客户端，能被绕过，但对个人
   主页足够，也免得自己刷新几次就把本地的点顶大。隐私模式下 localStorage
   访问本身就会抛异常，所以包 try/catch；存不了就每次都记，无所谓。 */
(function () {
  var KEY = 'vmap:seen', now = Date.now();
  try {
    if (now - (+localStorage.getItem(KEY) || 0) < 864e5) return;
    localStorage.setItem(KEY, now);
  } catch (e) {}
  if (window.fetch) {
    fetch('/api/visit', { method: 'POST', keepalive: true }).catch(function () {});
  }
})();

/* ---------- 画地图 ---------- */
(function () {
  var el = document.getElementById('visitorMap');
  if (!el) return;

  var W = 180, H = 101, CH = 45;
  var ROWK = Math.sqrt(3) / 2;   // 六边形排布的行距 / 列距
  /* 左边缘所在经线：切在白令海峡正中 —— 阿拉斯加本土最西 −168.1°，
     对岸圣劳伦斯岛最东 −168.7°。切在 180° 的话，楚科奇半岛越过 180°
     的那一截会被甩到最左边，挂在阿拉斯加旁边。 */
  var LON_W = -168.5;

  /* Miller 圆柱投影的纵坐标（弧度单位，与经度同尺度） */
  function miller(lat) {
    return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * Math.PI / 180));
  }
  /* 顶边 83N；底边由 H 行 × 行距推出（≈56S），与生成掩码时完全一致 */
  var YT = miller(83), YB = YT - H * ROWK * 2 * Math.PI / W;

  /* 经纬度 → 在地图上的相对位置（0–1），与生成掩码时的映射一致 */
  function place(lat, lon) {
    return { x: ((((lon - LON_W) % 360) + 360) % 360) / 360,
             y: (YT - miller(lat)) / (YT - YB) };
  }
  var MASK =
    '00000000005ff807ffc00000000000000000000000000' +
    '0000000003fff7fffe000000000000000000000000000' +
    '0000000005ffeffffffc0000000000000000000000000' +
    '000000000e1fbfffffe00005001800003800000000000' +
    '000000000fff0fffffe0002b800000001c00000000000' +
    '00000001877c7fffffc0007c000000000f00000000000' +
    '00000000507cffffffc0001d000000000300000000000' +
    '000000c000f03fffffc00010000000000180000000000' +
    '000001c42ff87fffffc000000000060001f0000000000' +
    '00000076e66003ffffc00000000070007ff800f000000' +
    '000000080bf001ffffc000000000c000fff0004200000' +
    '000003800c0000ffff80000000018001ffe0000000000' +
    '000003e32dbc007fff80000000018007ffffb80000000' +
    '000007fa69ec00ffff0000000002037ffffff07e00000' +
    '0200003f0cff003fff8000000001037ffffffbff00020' +
    '1fc0001f8cffc0fffe000003e000077ffffffffff0000' +
    '1ffeffbf9663e01fff000007f8003bffffffffffff3c0' +
    '7fffffe63f61c07ff800000ffe27fffffffffffffffe0' +
    '3ffffffffff0f07ff000001fffafffffffffffffffff8' +
    '5fffffffff81d87fc090003ffbffffffffffffffffffe' +
    '7fffffffffc7e03f0078003e7cfffffffffffffffffcc' +
    '1fffffffff61e03e0070007dfffffffffffffffffff80' +
    '3ffffffffe00501e000000f9fffffffffffffffffffc1' +
    '7ffffffff807001e000003f3fffffffffffffffffbe00' +
    '3f5ffffff8078006000001f9ffffffffffffffffcbc00' +
    '1e83fffff0079000000003f83fffffffffffffff88000' +
    '0200fffffc07d800000021b8ffffffffffffffe008000' +
    '06007ffffc07f800000060b2ffffffffffffff8038000' +
    '08003fffff83fc0000006091ffffffffffffff8038000' +
    '00003fffffeffe000000e08bfffffffffffffe0038000' +
    '00000fffffe7ff00000090fffffffffffffffff030000' +
    '00000fffffefff0000013bffffffffffffffffc020000' +
    '000007fffffffe0000003ffffffffffffffffff000000' +
    '00000bffffffc10000000fffffffffffffffffd000000' +
    '000001fffffff1c000003fffffffffffffffffd000000' +
    '000003ffffffe00000001ffffdfbffffffffff8000000' +
    '000003fffffffc0000000fffe5f1ffffffffff8000000' +
    '000003ffffff900000001f5fc1e7ffffffffff1000000' +
    '000003ffffff80000000fc27c071fffffffffc3000000' +
    '000003fffffe00000001f837dcf1fffffffff80000000' +
    '000003fffffe00000000f0833ff9ffffffff502000000' +
    '000003fffffc00000001f0037ff1fffffffe304000000' +
    '000001fffffc0000000063c13ffdffffffff98e000000' +
    '000001fffffc000000005f808bfffffffffe13c000000' +
    '0000007ffff800000000ffc003ffffffffff050000000' +
    '0000007fffe000000001ffe207ffffffffff040000000' +
    '0000002ffff000000001fffbffffffffffff800000000' +
    '0000002ff02000000003fffffff7ffffffff800000000' +
    '00000017f01000000003fffffbf9ffffffff800000000' +
    '00000007e0100000000ffffffbfcffffffff000000000' +
    '00000001e0000000000ffffffdfd83fffffe800000000' +
    '00000001e0100000000ffffffdffc1ffbff8000000000' +
    '00000000f1840000000ffffffeffc17f3fd0000000000' +
    '00000001f3018000000ffffffcff80fc1fa0000000000' +
    '000000007f000000000fffffff7f007c1fc0800000000' +
    '0000000016000000001ffffffe7c007017c0800000000' +
    '0000000003e00000000fffffffb8003007e0400000000' +
    '0000000000c00000001fffffff80007005c0000000000' +
    '00000000004144000007ffffffdc003004c0400000000' +
    '00000000003bf8000007fffffff800200480200000000' +
    '000000000007fe000003fffffff800080200700000000' +
    '000000000007ff800001f3fffff000000202000000000' +
    '000000000003ffe00000007ffff000000d06000000000' +
    '00000000000fffc00000007fffe00000051e000000000' +
    '00000000000fffe00000007fffc00000031ec80000000' +
    '00000000001ffff8000000ffff800000031d860000000' +
    '00000000000fffff0000007fff000000018c0be000000' +
    '00000000001fffff8000003ffe000000018000f800000' +
    '00000000000fffffe000003fff0000000060017c00000' +
    '00000000000fffffc000003ffe0000000018002410000' +
    '000000000007ffffc000001fff0000000000a00200000' +
    '000000000007ffff8000001fff0000000000000000000' +
    '000000000003ffff8000001fff8000000000071000000' +
    '000000000003ffff0000003fff18000000003f1000000' +
    '000000000000ffff8000003fff38000000003f9800000' +
    '0000000000007fff0000003ffc30000000007ff800000' +
    '0000000000007fff0000001ffc3800000000fffc00000' +
    '0000000000007ffe0000001ff87000000007fffc00000' +
    '0000000000007ffc0000001ffc3000000007ffff00000' +
    '000000000000fff00000001ff82000000007ffff00000' +
    '0000000000007ff00000000ff80000000007ffff80000' +
    '000000000000ffe00000000ff00000000007ffff80000' +
    '0000000000007fe000000007f00000000003ffff80000' +
    '000000000000ffc000000007e00000000003ffff00000' +
    '000000000000ffc000000007c00000000003c1ff00000' +
    '000000000000ff800000000400000000000201fe00000' +
    '000000000000ff0000000000000000000000003e00100' +
    '000000000001fe0000000000000000000000003e00100' +
    '000000000000f80000000000000000000000000000180' +
    '000000000001f80000000000000000000000000000100' +
    '000000000001f00000000000000000000000000400200' +
    '000000000001e00000000000000000000000000000400' +
    '000000000001f00000000000000000000000000000c00' +
    '000000000003c00000000000000000000000000001800' +
    '000000000001e00000000000000000000000000000000' +
    '000000000003c00000000000000002000000000000000' +
    '000000000001c00000000000000000000000000000000' +
    '000000000003860000000000000000000000000000000' +
    '000000000001c00000000000000000000000000000000' +
    '000000000001c00000000000000000000000000000000' +
    '000000000000000000000000000000000000000000000'
;

  /* 部署好 Worker 之后把 USE_MOCK 改成 false，这是唯一需要动的开关。
     为 false 时若接口取不到数据，整块保持隐藏 —— 宁可什么都不显示，
     也不能把编出来的数字当成真实访问量摆在页面上。 */
  var USE_MOCK = false;
  var API_READ  = '/api/visitors';

  var DATA = [];

  /* ⚠️ 原型数据，非真实访问，仅供 USE_MOCK 时预览版式。 */
  var MOCK = [
    { city: 'Singapore',     cc: 'SG', lat:   1.29, lon:  103.85, n: 486, ago: 2 },
    { city: 'Hangzhou',      cc: 'CN', lat:  30.27, lon:  120.15, n: 341, ago: 10 },
    { city: 'Shanghai',      cc: 'CN', lat:  31.23, lon:  121.47, n: 208, ago: 30 },
    { city: 'Beijing',       cc: 'CN', lat:  39.90, lon:  116.40, n: 152, ago: 60 },
    { city: 'Shenzhen',      cc: 'CN', lat:  22.54, lon:  114.06, n:  97, ago: 100 },
    { city: 'Hong Kong',     cc: 'HK', lat:  22.32, lon:  114.17, n:  84, ago: 150 },
    { city: 'Tokyo',         cc: 'JP', lat:  35.68, lon:  139.69, n:  73, ago: 200 },
    { city: 'Seoul',         cc: 'KR', lat:  37.57, lon:  126.98, n:  51, ago: 260 },
    { city: 'Bengaluru',     cc: 'IN', lat:  12.97, lon:   77.59, n:  44, ago: 340 },
    { city: 'Sydney',        cc: 'AU', lat: -33.87, lon:  151.21, n:  38, ago: 420 },
    { city: 'Melbourne',     cc: 'AU', lat: -37.81, lon:  144.96, n:  22, ago: 520 },
    { city: 'London',        cc: 'GB', lat:  51.51, lon:   -0.13, n:  96, ago: 640 },
    { city: 'Zurich',        cc: 'CH', lat:  47.38, lon:    8.54, n:  61, ago: 760 },
    { city: 'Munich',        cc: 'DE', lat:  48.14, lon:   11.58, n:  47, ago: 900 },
    { city: 'Paris',         cc: 'FR', lat:  48.86, lon:    2.35, n:  35, ago: 1100 },
    { city: 'Amsterdam',     cc: 'NL', lat:  52.37, lon:    4.90, n:  29, ago: 1400 },
    { city: 'Stockholm',     cc: 'SE', lat:  59.33, lon:   18.07, n:  17, ago: 1700 },
    { city: 'Tel Aviv',      cc: 'IL', lat:  32.09, lon:   34.78, n:  14, ago: 2100 },
    { city: 'New York',      cc: 'US', lat:  40.71, lon:  -74.01, n: 174, ago: 2500 },
    { city: 'Boston',        cc: 'US', lat:  42.36, lon:  -71.06, n: 118, ago: 3000 },
    { city: 'San Francisco', cc: 'US', lat:  37.77, lon: -122.42, n: 142, ago: 3600 },
    { city: 'Seattle',       cc: 'US', lat:  47.61, lon: -122.33, n:  66, ago: 4300 },
    { city: 'Pittsburgh',    cc: 'US', lat:  40.44, lon:  -79.996, n: 31, ago: 5000 },
    { city: 'Toronto',       cc: 'CA', lat:  43.65, lon:  -79.38, n:  58, ago: 6000 },
    { city: 'Sao Paulo',     cc: 'BR', lat: -23.55, lon:  -46.63, n:  19, ago: 7000 },
    { city: 'Nairobi',       cc: 'KE', lat:  -1.29, lon:   36.82, n:   8, ago: 9000 }
  ];

  var view = document.createElement('div');     // 裁切窗口：放大后超出的部分藏在里面
  var cvs  = document.createElement('canvas');
  var pins = document.createElement('div');
  var tip  = document.createElement('div');
  var out  = document.createElement('button');  // 放大后出现：缩回全图
  view.className = 'vmap-view';
  cvs.className = 'vmap-land';
  pins.className = 'vmap-pins';
  tip.className = 'vmap-tip';
  out.className = 'vmap-out';
  out.type = 'button';
  out.textContent = '\u2212';
  out.setAttribute('aria-label', 'Zoom out');
  tip.hidden = true;
  out.hidden = true;
  view.appendChild(cvs); view.appendChild(pins);
  el.appendChild(view); el.appendChild(tip); el.appendChild(out);

  /* 视图：z 是放大倍数，(ux, uy) 是视窗中心在整张图上的相对位置（0–1）。
     z = 1 即全图。点阵和访客点都经 toX / toY 换算，两者永远对得上。 */
  var ZOOM = 3, z = 1, ux = 0.5, uy = 0.5, w = 0, h = 0, sizedFor = 0;
  var zt = 1;   // 目标倍数。判断点击该放大还是缩回要看它，而不是动画中途的 z ——
                // 否则在 0.38 秒的过渡里连点两下，会按一个半截的倍数做决定
  function toX(u) { return (u - ux) * w * z + w / 2; }
  function toY(v) { return (v - uy) * h * z + h / 2; }
  function clampCenter(zz, u, v) {             // 视窗不许拖出地图边界
    var m = 0.5 / zz;
    return [Math.min(1 - m, Math.max(m, u)), Math.min(1 - m, Math.max(m, v))];
  }

  /* 取第 gy 行第 gx 格的位。一个十六进制字符压四格，
     所以先定位到 gx>>2 那个字符，再取它的第 gx&3 位。 */
  function bitAt(gx, gy) {
    var c = MASK.charCodeAt(gy * CH + (gx >> 2));
    var v = c <= 57 ? c - 48 : c - 87;
    return (v >> (3 - (gx & 3))) & 1;
  }

  function draw() {
    w = el.clientWidth;
    if (!w) return;
    var cw  = w / W;
    var ch  = cw * ROWK;         // 行距
    h = ch * H;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width  = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';

    var g = cvs.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = getComputedStyle(el).getPropertyValue('--vmap-dot').trim() || '#cec9c6';
    var r = Math.max(0.55, cw * 0.30) * z;   // 放大时点阵跟着变大，像拿放大镜看
    for (var gy = 0; gy < H; gy++) {
      var off = (gy & 1) ? 0.5 : 0;   // 奇数行右移半格
      var y = toY((gy + 0.5) / H);
      if (y < -r || y > h + r) continue;
      for (var gx = 0; gx < W; gx++) {
        if (!bitAt(gx, gy)) continue;
        var x = toX((gx + 0.5 + off) / W);
        if (x < -r || x > w + r) continue;
        g.beginPath();
        g.arc(x, y, r, 0, 6.2832);
        g.fill();
      }
    }

    /* 访客点跟同一个视图走，但本身大小不变 —— 放大后，
       原先挤成一团的点（东亚、美东）才会被拉开、各自看清。 */
    /* 点的大小参照 chenyanzhe.page：半径 = 3 + min(4, 2.4·log10(n+1))，按 900 宽的坐标算，
       访问量到 ~45 次封顶 —— 对数而非开方，一个热门城市不会大到压住周围。
       换算比例随地图宽度：620px（对方地图的最大宽度）时直径 5–9.6px，更窄时等比缩小，
       手机上的点才不会相对地图大出一倍、挤成一团。只在宽度变化时重设 */
    if (w !== sizedFor) {
      sizedFor = w;
      var k = Math.min(w, 620) / 900;
      [].forEach.call(pins.children, function (b) {
        var r = 3 + Math.min(4, 2.4 * Math.log(b._n + 1) / Math.LN10);
        b.style.setProperty('--s', Math.max(3, 2 * r * k).toFixed(1) + 'px');
      });
    }
    [].forEach.call(pins.children, function (b) {
      var x = toX(b._u), y = toY(b._v);
      b.style.left = x + 'px';
      b.style.top  = y + 'px';
      b.hidden = x < -12 || y < -12 || x > w + 12 || y > h + 12;
    });
    if (!tip.hidden && tip._pin) {
      tip.style.left = tip._pin.style.left;
      tip.style.top  = tip._pin.style.top;
    }
  }

  /* 缩放动画：用 easeOutCubic 在 380ms 内过渡倍数与中心点。
     开了"减少动态效果"时直接跳到终点。 */
  var anim = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function zoomTo(z1, u1, v1) {
    var c = clampCenter(z1, u1, v1), z0 = z, u0 = ux, v0 = uy, t0 = null, D = reduce ? 0 : 380;
    zt = z1;
    cancelAnimationFrame(anim);
    function step(t) {
      if (t0 === null) t0 = t;
      var k = D ? Math.min(1, (t - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3);
      z = z0 + (z1 - z0) * e; ux = u0 + (c[0] - u0) * e; uy = v0 + (c[1] - v0) * e;
      draw();
      if (k < 1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
    el.classList.toggle('zoomed', z1 > 1);
    out.hidden = z1 === 1;
    tip.hidden = true;
  }

  /* 交互：点一下以该处为中心放大；放大后拖动平移，再点一下或按"−"、Esc 缩回。
     不用滚轮缩放 —— 地图嵌在长页面里，滚轮一经过地图就被劫持，页面反而滚不动。
     拖动不足 4px 当作点击，否则手一抖就会误触发缩放。 */
  var down = null, panned = false;
  view.addEventListener('pointerdown', function (e) {
    down = { x: e.clientX, y: e.clientY, u: ux, v: uy };
    panned = false;
  });
  view.addEventListener('pointermove', function (e) {
    if (!down || zt === 1) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!panned && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!panned) {
      panned = true;
      el.classList.add('panning');
      tip.hidden = true;
      try { view.setPointerCapture(e.pointerId); } catch (_) {}
    }
    var c = clampCenter(z, down.u - dx / (w * z), down.v - dy / (h * z));
    ux = c[0]; uy = c[1];
    draw();
  });
  function endPointer() { down = null; panned = false; el.classList.remove('panning'); }
  view.addEventListener('pointerup', function (e) {
    if (!down) return;
    var wasPan = panned;
    endPointer();
    if (wasPan) return;
    if (zt > 1) { zoomTo(1, 0.5, 0.5); return; }
    var r = view.getBoundingClientRect();
    zoomTo(ZOOM, ux + (e.clientX - r.left - w / 2) / (w * z),
                 uy + (e.clientY - r.top  - h / 2) / (h * z));
  });
  view.addEventListener('pointercancel', endPointer);
  out.addEventListener('click', function () { zoomTo(1, 0.5, 0.5); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && zt > 1) zoomTo(1, 0.5, 0.5);
  });

  /* 按"多久前访问"着色：本周内是页面的主蓝，一个月淡成浅蓝，此后渐隐，半年及以上完全透明。
     三个锚点把刻度分成两臂，每臂内部按对数插值 —— 一周到一个月、
     一个月到半年，跨度差了好几倍，线性的话前一臂几乎看不出过渡。 */
  var WEEK = 168, MONTH = 720, HALF_YEAR = 4320;   // 小时
  function heat(ago) {
    if (ago <= WEEK) return 0;
    if (ago >= HALF_YEAR) return 1;
    return ago <= MONTH
      ? 0.5 * Math.log(ago / WEEK) / Math.log(MONTH / WEEK)
      : 0.5 + 0.5 * Math.log(ago / MONTH) / Math.log(HALF_YEAR / MONTH);
  }
  /* 前一臂（0–0.5）用 color-mix 从主蓝过渡到浅蓝；颜色本身留在 CSS 变量里，JS 只算比例。
     浏览器不支持 color-mix 时这条内联样式整条作废，退回样式表里的单色 --vmap-pin。
     后一臂（0.5–1）不再变色，而是整体淡出（fadeOf → --fade）：
     若把颜色混向 transparent，点是透明了，外面那圈描边却还在，会剩一个空心圆。 */
  function heatColor(t) {
    return 'color-mix(in oklab, var(--vmap-mid) ' + (Math.min(t, 0.5) * 200).toFixed(1) + '%, var(--vmap-hot))';
  }
  function fadeOf(t) { return t <= 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) * 2); }
  function agoText(h) {
    if (document.documentElement.lang === 'zh-CN') {
      if (h < 1) return '一小时内';
      if (h < 24) return h + ' 小时前';
      if (h < 720) return Math.round(h / 24) + ' 天前';
      return Math.round(h / 720) + ' 个月前';
    }
    if (h < 1)   return 'within the hour';
    if (h < 24)  return h + ' h ago';
    if (h < 720) return Math.round(h / 24) + ' d ago';
    return Math.round(h / 720) + ' mo ago';
  }

  function visitLabel(d) {
    var chinese = document.documentElement.lang === 'zh-CN';
    return d.city + ', ' + d.cc + ' \u00b7 ' + d.n + (chinese ? ' 次访问' : ' visits') +
      (typeof d.ago === 'number' ? ' \u00b7 ' + agoText(d.ago) : '');
  }
  function updateLanguage() {
    out.setAttribute('aria-label', document.documentElement.lang === 'zh-CN' ? '缩回全图' : 'Zoom out');
    pins.querySelectorAll('.vmap-pin').forEach(function (pin) {
      pin.setAttribute('aria-label', visitLabel(pin._visit));
    });
    if (tip._pin) tip.textContent = visitLabel(tip._pin._visit);
  }
  document.addEventListener('languagechange', updateLanguage);
  updateLanguage();

  function showTip(pin, d) {
    tip.textContent = visitLabel(d);
    tip._pin = pin;
    tip.style.left = pin.style.left;
    tip.style.top  = pin.style.top;
    tip.hidden = false;
  }

  function build() {
    DATA.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vmap-pin';
      var pt = place(d.lat, d.lon);
      b._u = pt.x;                 // 在整张图上的相对位置；像素坐标由 draw() 按视图换算
      b._v = pt.y;
      b._n = d.n;                  // 点的大小随地图宽度变，由 draw() 设定
      b._visit = d;
      b.setAttribute('aria-label', visitLabel(d));
      // 旧版接口没有 ago 字段时不着色，保持单色，页面不会坏
      if (typeof d.ago === 'number') {
        var t = heat(d.ago), fade = fadeOf(t);
        b.style.color = heatColor(t);               // 圆点取 currentColor
        b.style.setProperty('--fade', fade.toFixed(3));
        // 淡到看不见的点不能还是一个摸得到的按钮：不响应指针，也不进 Tab 顺序
        if (fade < 0.03) { b.style.pointerEvents = 'none'; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
      }
      b.addEventListener('mouseenter', function () { showTip(b, d); });
      b.addEventListener('focus',      function () { showTip(b, d); });
      b.addEventListener('mouseleave', function () { tip.hidden = true; });
      b.addEventListener('blur',       function () { tip.hidden = true; });
      pins.appendChild(b);
    });

    el.classList.add('is-ready');
    var sec = document.getElementById('visitors');
    if (sec) sec.removeAttribute('hidden');
  }

  function start(rows) {
    if (!rows || !rows.length) return;     // 没数据就整块不出现
    DATA = rows;
    build();
    draw();

    if (window.ResizeObserver) new ResizeObserver(draw).observe(el);
    else window.addEventListener('resize', draw);

  }

  if (USE_MOCK) {
    start(MOCK);
  } else {
    fetch(API_READ, { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(start)
      .catch(function () { /* 接口挂了就当没这一节 */ });
  }
})();
