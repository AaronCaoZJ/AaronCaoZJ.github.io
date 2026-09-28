/* 访客世界地图 —— 点阵 Equal Earth 投影，零外部依赖。

   陆地用一张 180x78 的位掩码画成圆点：每行 45 个十六进制字符，
   一个字符管四格，整张图 3.5 KB，不需要任何地图库或瓦片服务。

   为什么是 Equal Earth 而不是等距圆柱：后者把每度经纬都画成等长，
   纬度越高东西方向被拉得越宽，俄罗斯、加拿大、格陵兰显得又胖又大。
   Equal Earth 是等面积投影，各洲按真实面积比例显示，两侧是弧形轮廓。

   掩码由 Natural Earth 110m 陆地边界离线生成：网格在投影平面上均匀排布，
   每一行对应同一纬度，逐行反解出经度后做扫描线判定，所以不存在接缝问题。
   纬度裁到 83N~56S，去掉南极洲和北冰洋的空行；中央经线 150°E（太平洋居中）。 */
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

  var W = 180, H = 78, CH = 45;
  var LON_C = 150;        // 中央经线：太平洋居中，切口落在西经 30 度的大西洋上
  // Equal Earth 投影平面上的裁切范围，与生成掩码时完全一致
  var XMAX = 2.706630, YT = 1.302912, YB = -1.032428;

  /* Equal Earth 正向投影：经纬度 → 在地图上的相对位置（0–1）。
     访客点必须走和陆地点阵同一套公式，否则会落到海里。 */
  var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, S3 = Math.sqrt(3);
  function place(lat, lon) {
    var lam = ((((lon - LON_C + 180) % 360) + 360) % 360 - 180) * Math.PI / 180;
    var th = Math.asin(S3 / 2 * Math.sin(lat * Math.PI / 180));
    var t2 = th * th, t6 = t2 * t2 * t2;
    var x = 2 * S3 * lam * Math.cos(th) / (3 * (A1 + 3 * A2 * t2 + 7 * A3 * t6 + 9 * A4 * t6 * t2));
    var y = th * (A1 + A2 * t2 + A3 * t6 + A4 * t6 * t2);
    return { x: (x + XMAX) / (2 * XMAX), y: (YT - y) / (YT - YB) };
  }
  var MASK =
    '000000003c00f00000c0000000000007fbffc00000000' +
    '00000000f000000c01fc0300000000e4a03ff00000000' +
    '00000003000000613fffe3c0000003fb3e07fc0000000' +
    '0000000c0007e01affffffff703fff9aa4e0ff0000000' +
    '00000001003fa7fdffffffffff1ffffffe3c7f0000000' +
    '0000000c01effffffffffffff00ffffff98e1e0000000' +
    '000000000fbffffffffffffbe03ffffff818030000000' +
    '000000001f3fffffffffff72000e07fffc0e400000000' +
    '0000000214fffffffffffc0e000300ffff03f00000000' +
    '0000000431fffffffffff00e0008007ffff3fc0000000' +
    '0000002cfffffffffffffe0c0000003ffff9ff0000000' +
    '0000001bfffffffffffffc000000000fffffff0000000' +
    '0000001ffffffffffffffd0000000007fffff96000000' +
    '0000003ffffffffffffff80000000003fffffe0000000' +
    '0000007efebc7ffffffff80000000001ffffffc000000' +
    '000000f2f83dfffffffff30000000001fffffe8000000' +
    '00000fce791dffffffff800000000000fffffe0000000' +
    '00000f13cffdfffffffb800000000000fffffc0000000' +
    '00001e009ff9fffffff10400000000007ffffc0000000' +
    '000018609ffbfffffff98c00000000003ffffe0000000' +
    '000017e043fffffffff1bc00000000001ffffe0000000' +
    '00007fc007fffffffff03000000000000ffffc0000000' +
    '0000fff307fffffffff800000000000007fffc0000000' +
    '0001fffffffffffffff800000000000003ffec0000000' +
    '0003ffffffdffffffff800000000000000ff020000000' +
    '0007ffffefcffffffff0000000000000017e020000000' +
    '001fffffefc3ffffffe0000000000000003f010000000' +
    '001fffffeffc3fffffe0000000000000005f000000000' +
    '003fffffe7fe1ffbff80000000000000000f008000000' +
    '007fffffeffc17f3fa0000000000000000078c2000000' +
    '007fffffe7f80fc1f20000000000080000078c0400000' +
    '007ffffff7f00fc1f8000000000000000001f80000000' +
    '00fffffff7c00f81f81000000000000000007c0000000' +
    '00fffffff7800700fc1000000000000000000f0000000' +
    '00fffffffe000700bc180000000000000000030000000' +
    '00fffffff80006001c000000000000000000010200000' +
    '00ffffffff800600980400000000000000000087a0000' +
    '007fffffff80010080040000000000000000007ff0000' +
    '007fffffff00010000040000000000000000002ff8000' +
    '003f3fffff00000040440000000000000000000ffc000' +
    '00103ffffe00000160c00000000000000000000fff800' +
    '00000ffffc000000a1c00000000000000000000fffc00' +
    '00000ffff8000000c3c40000000000000000000fffc00' +
    '00000ffff000000063c00000000000000000001fffc00' +
    '00000ffff000000063904000000000000000001ffff00' +
    '00000fffe000000033b15c00000000000000001ffffe0' +
    '000007ffe000000030001f10000000000000003fffff0' +
    '000007ffe000000000000fe8000000000000003fffff8' +
    '000003ffe00000000f000f80000000000000001fffff8' +
    '000003ffe000000000100681000000000000001fffff8' +
    '000003fff000000000000000000000000000001fffff0' +
    '000001fff000000000004200000000000000000ffffe0' +
    '000003fff08000000000e200000000000000000ffffe0' +
    '000003fff08000000002e300000000000000000ffffc0' +
    '000003fff38000000007f3002080000000000007fffc0' +
    '000003ffe3800000000fff000100000000000003fff80' +
    '000001ffc1800000000fff800000000000000003fff80' +
    '000000ffc1800000003fffc04000000000000003fff00' +
    '0000007fe1800000007fffc00000000000000007ffe00' +
    '0000007fe180000000ffffe00000000000000007ff800' +
    '0000003fc0000000007fffe0000000000000000ffe000' +
    '0000003fc0000000007fffe0000000000000000ffc000' +
    '0000001fe0000000007ffff0000000000000001ffc000' +
    '0000000fc0000000003fffe0000000000000001ff8000' +
    '00000007c0000000003f3fe0000000000000003fe0000' +
    '0000000780000000003c1fe0000000000000003fc0000' +
    '0000000000000000000007c0080000000000007f00000' +
    '0000000000000000000007c004000000000000fe00000' +
    '00000000000000000000008006000000000001fc00000' +
    '00000000000000000000000004000000000003e000000' +
    '000000000000000000000080180000000000038000000' +
    '000000000000000000000000300000000000078000000' +
    '0000000000000000000000006000000000000e0000000' +
    '0000000000000000000000000000000000001e0000000' +
    '000000000000008000000000000000000000380000000' +
    '000000000000000000000000000000000000700000000' +
    '000000000000000000000000000000000000600000000' +
    '000000000000000000000000000000000000400000000'
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

  var cvs  = document.createElement('canvas');
  var pins = document.createElement('div');
  var tip  = document.createElement('div');
  cvs.className = 'vmap-land';
  pins.className = 'vmap-pins';
  tip.className = 'vmap-tip';
  tip.hidden = true;
  el.appendChild(cvs); el.appendChild(pins); el.appendChild(tip);

  /* 取第 gy 行第 gx 格的位。一个十六进制字符压四格，
     所以先定位到 gx>>2 那个字符，再取它的第 gx&3 位。 */
  function bitAt(gx, gy) {
    var c = MASK.charCodeAt(gy * CH + (gx >> 2));
    var v = c <= 57 ? c - 48 : c - 87;
    return (v >> (3 - (gx & 3))) & 1;
  }

  function draw() {
    var w = el.clientWidth;
    if (!w) return;
    var cw  = w / W;
    var h   = cw * H;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width  = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';

    var g = cvs.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = getComputedStyle(el).getPropertyValue('--vmap-dot').trim() || '#cec9c6';
    var r = Math.max(0.55, cw * 0.30);
    for (var gy = 0; gy < H; gy++) {
      for (var gx = 0; gx < W; gx++) {
        if (!bitAt(gx, gy)) continue;
        g.beginPath();
        g.arc((gx + 0.5) * cw, (gy + 0.5) * cw, r, 0, 6.2832);
        g.fill();
      }
    }
  }

  /* 按"多久前访问"着色：本周内红，一个月白，半年及以上蓝。
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
  /* 两段 color-mix：0–0.5 是红→白，0.5–1 是白→蓝。
     颜色本身留在 CSS 变量里，JS 只算比例 —— 切换明暗主题时不用重算，
     点的颜色会跟着变量自动换。浏览器不支持 color-mix 时这条内联样式
     整条作废，退回样式表里的单色 --vmap-pin。 */
  function heatColor(t) {
    return t <= 0.5
      ? 'color-mix(in oklab, var(--vmap-mid) ' + (t * 200).toFixed(1) + '%, var(--vmap-hot))'
      : 'color-mix(in oklab, var(--vmap-cold) ' + ((t - 0.5) * 200).toFixed(1) + '%, var(--vmap-mid))';
  }
  function agoText(h) {
    if (h < 1)   return 'within the hour';
    if (h < 24)  return h + ' h ago';
    if (h < 720) return Math.round(h / 24) + ' d ago';
    return Math.round(h / 720) + ' mo ago';
  }

  function showTip(pin, d) {
    tip.textContent = d.city + ', ' + d.cc + ' \u00b7 ' + d.n + ' visits' +
                      (typeof d.ago === 'number' ? ' \u00b7 ' + agoText(d.ago) : '');
    tip.style.left = pin.style.left;
    tip.style.top  = pin.style.top;
    tip.hidden = false;
  }

  function build() {
    var max = 0;
    DATA.forEach(function (d) { if (d.n > max) max = d.n; });

    DATA.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vmap-pin';
      var pt = place(d.lat, d.lon);
      b.style.left = (pt.x * 100) + '%';
      b.style.top  = (pt.y * 100) + '%';
      /* 面积正比于访问量 => 半径开方，否则大城市会大得离谱 */
      b.style.setProperty('--s', (5 + 8 * Math.sqrt(d.n / max)).toFixed(1) + 'px');
      b.setAttribute('aria-label', d.city + ', ' + d.cc + ', ' + d.n + ' visits' +
                     (typeof d.ago === 'number' ? ', last ' + agoText(d.ago) : ''));
      // 旧版接口没有 ago 字段时不着色，保持单色，页面不会坏
      if (typeof d.ago === 'number') b.style.background = heatColor(heat(d.ago));
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

    /* 主题切换时 --vmap-dot 变了，但 canvas 是位图、不会自己重绘 */
    new MutationObserver(draw).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-theme'] });
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
