/* 访客世界地图 —— 点阵等距圆柱投影，零外部依赖。

   陆地用一张 180x70 的位掩码画成圆点：每行 45 个十六进制字符，
   一个字符管四格，整张图 3.1 KB，不需要任何地图库或瓦片服务。
   掩码由 Natural Earth 110m 陆地边界离线扫描线光栅化生成
   （纬度裁到 83N~56S，去掉南极洲和北冰洋的空行）。 */
(function () {
  var el = document.getElementById('visitorMap');
  if (!el) return;

  var W = 180, H = 70, CH = 45;
  var LAT_T = 83, LAT_B = -56;
  var LON_C = 150;        // 中央经线：太平洋居中，切口落在西经 30 度的大西洋上
  var MASK =
    'd0000000000000000000000000000000000007fffffff' +
    'fe0003f802000007800000000000000000003fff7ffff' +
    'fc0007e000000000c0000000000000000030f1fbfffff' +
    'fc00000000078007ff000c000000000007e9ec000ffff' +
    'f80000000038003ffe000000000000000f80180003fff' +
    'f000000000e07fffffff0fc0000000000ffef7fc01fff' +
    'f000007e0000fffffffffffe08007ff078fffcffc1fff' +
    '000003ffe6ffffffffffffffffe0ffffffce7fefc0fff' +
    '1f0007fffffffffffffffffffffdffffffffff07f0ffc' +
    '1f001fffffffffffffffffffff803fffffffffe3e0fe0' +
    '00007f7ffffffffffffffffffe00fffffffff83e403c0' +
    '00007fb7fffffffffffffff9f801ffbffffff00fa00c0' +
    '000c2f1ffffffffffffffc0380000c01fffff80ff0000' +
    '000c1e7ffffffffffffff00f80003000ffffff0ff8000' +
    '003e1ffffffffffffffffa0f000000007fffffdffe000' +
    '003f7ffffffffffffffffe06000000005fffffffff000' +
    '000dfffffffffffffffffe00000000003fffffffda000' +
    '000ffffffffffffffffffe00000000000fffffffe7800' +
    '0003ffffbf7ffffffffffa000000000007fffffff8000' +
    '0003fffc3effffffffffe700000000000fffffffe0000' +
    '003f9ef81f7fffffffff8e00000000000fffffff00000' +
    '003f13ffffffffffffff0c00000000000ffffffe00000' +
    '003e036fff7fffffffc70c000000000007fffffc00000' +
    '0019f807fffffffffff31c000000000003fffffc00000' +
    '001ff800fffffffffff0f0000000000001fffff800000' +
    '003ffe60fffffffffff080000000000000ffffe000000' +
    '003ffffffffffffffff0000000000000007fffe000000' +
    '007ffffffffffffffff0000000000000007fe06000000' +
    '01ffffff7f9fffffffe0000000000000003fe06800000' +
    '01ffffffffb0fffffff00000000000000017e01800000' +
    '03fffffffff87fffff900000000000000003e0f000000' +
    '03fffffffff81fe7fe000000000000000003e70c00000' +
    '03ffffffdff01fc3fc180000000000000001ff1fe0000' +
    '03ffffffefc01f83f81800000000000000007e0000000' +
    '03ffffffff000f01fc1000000000000000000fc000000' +
    '03fffffff8000f00fc14000000000000000001c000000' +
    '01ffffffff800600983c000000000000000000c7f8000' +
    '00ffffffff800700c04e0000000000000000007ff8000' +
    '007fffffff000100c0460000000000000000000ffe000' +
    '00307fffff000003e0e00000000000000000000fffc00' +
    '00001ffffe000001e3c00000000000000000001fffc00' +
    '00001ffff8000000e7df0000000000000000003fffc00' +
    '00001ffff000000077f8e000000000000000003ffff80' +
    '00000ffff00000007bfbfe30000000000000003fffff0' +
    '000007ffe000000010381f78000000000000003fffffc' +
    '000007ffe00000000f000f86000000000000001fffffc' +
    '000007ffe0000000000c00c3000000000000001fffffc' +
    '000007fff00000000000c200000000000000000fffff8' +
    '000007fff10000000000f600000000000000000fffff0' +
    '00000ffff38000000007e7002000000000000007ffff0' +
    '00000fffe7000000000fff800000000000000001ffff0' +
    '000007ff87000000001fff800000000000000001ffff0' +
    '000007ff8f00000000ffffc06000000000000001fffe0' +
    '000003ff8e00000001ffffe00000000000000001fff80' +
    '000003ff0600000001fffff00000000000000001fff00' +
    '000003ff0000000001fffff00000000000000001ffe00' +
    '000001fe0000000000fffff00000000000000001ffe00' +
    '000001fe0000000000fffff00000000000000001ffc00' +
    '000000f80000000000fc3fe00000000000000001ff800' +
    '000000000000000000001fe00400000000000003fe000' +
    '000000000000000000000fc00200000000000003fe000' +
    '0000000000000000000000000700000000000003f0000' +
    '0000000000000000000001c00700000000000003f0000' +
    '0000000000000000000001800c00000000000007e0000' +
    '0000000000000000000000003800000000000007c0000' +
    '0000000000000000000000000000000000000007c0000' +
    '0000000000006000000000000000000000000007c0000' +
    '000000000000000000000000000000000000000780000' +
    '000000000000000000000000000000000000000780000' +
    '0000000000000000000000000000000000000001e0000'
;

  /* 部署好 Worker 之后把 USE_MOCK 改成 false，这是唯一需要动的开关。
     为 false 时若接口取不到数据，整块保持隐藏 —— 宁可什么都不显示，
     也不能把编出来的数字当成真实访问量摆在页面上。 */
  var USE_MOCK = false;
  var API_READ  = '/api/visitors';
  var API_WRITE = '/api/visit';

  var DATA = [];

  /* ⚠️ 原型数据，非真实访问，仅供 USE_MOCK 时预览版式。 */
  var MOCK = [
    { city: 'Singapore',     cc: 'SG', lat:   1.29, lon:  103.85, n: 486 },
    { city: 'Hangzhou',      cc: 'CN', lat:  30.27, lon:  120.15, n: 341 },
    { city: 'Shanghai',      cc: 'CN', lat:  31.23, lon:  121.47, n: 208 },
    { city: 'Beijing',       cc: 'CN', lat:  39.90, lon:  116.40, n: 152 },
    { city: 'Shenzhen',      cc: 'CN', lat:  22.54, lon:  114.06, n:  97 },
    { city: 'Hong Kong',     cc: 'HK', lat:  22.32, lon:  114.17, n:  84 },
    { city: 'Tokyo',         cc: 'JP', lat:  35.68, lon:  139.69, n:  73 },
    { city: 'Seoul',         cc: 'KR', lat:  37.57, lon:  126.98, n:  51 },
    { city: 'Bengaluru',     cc: 'IN', lat:  12.97, lon:   77.59, n:  44 },
    { city: 'Sydney',        cc: 'AU', lat: -33.87, lon:  151.21, n:  38 },
    { city: 'Melbourne',     cc: 'AU', lat: -37.81, lon:  144.96, n:  22 },
    { city: 'London',        cc: 'GB', lat:  51.51, lon:   -0.13, n:  96 },
    { city: 'Zurich',        cc: 'CH', lat:  47.38, lon:    8.54, n:  61 },
    { city: 'Munich',        cc: 'DE', lat:  48.14, lon:   11.58, n:  47 },
    { city: 'Paris',         cc: 'FR', lat:  48.86, lon:    2.35, n:  35 },
    { city: 'Amsterdam',     cc: 'NL', lat:  52.37, lon:    4.90, n:  29 },
    { city: 'Stockholm',     cc: 'SE', lat:  59.33, lon:   18.07, n:  17 },
    { city: 'Tel Aviv',      cc: 'IL', lat:  32.09, lon:   34.78, n:  14 },
    { city: 'New York',      cc: 'US', lat:  40.71, lon:  -74.01, n: 174 },
    { city: 'Boston',        cc: 'US', lat:  42.36, lon:  -71.06, n: 118 },
    { city: 'San Francisco', cc: 'US', lat:  37.77, lon: -122.42, n: 142 },
    { city: 'Seattle',       cc: 'US', lat:  47.61, lon: -122.33, n:  66 },
    { city: 'Pittsburgh',    cc: 'US', lat:  40.44, lon:  -79.996, n: 31 },
    { city: 'Toronto',       cc: 'CA', lat:  43.65, lon:  -79.38, n:  58 },
    { city: 'Sao Paulo',     cc: 'BR', lat: -23.55, lon:  -46.63, n:  19 },
    { city: 'Nairobi',       cc: 'KE', lat:  -1.29, lon:   36.82, n:   8 }
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

  function showTip(pin, d) {
    tip.textContent = d.city + ', ' + d.cc + ' \u00b7 ' + d.n + ' visits';
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
      b.style.left = (((((d.lon - LON_C + 180) % 360) + 360) % 360) / 360 * 100) + '%';
      b.style.top  = ((LAT_T - d.lat) / (LAT_T - LAT_B) * 100) + '%';
      /* 面积正比于访问量 => 半径开方，否则大城市会大得离谱 */
      b.style.setProperty('--s', (5 + 8 * Math.sqrt(d.n / max)).toFixed(1) + 'px');
      b.setAttribute('aria-label', d.city + ', ' + d.cc + ', ' + d.n + ' visits');
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

  /* 记一次访问。同一浏览器 24 小时内只记一次 —— 判断在客户端，
     能被绕过，但对个人主页足够，也免得自己刷新几次就把本地点顶大。
     隐私模式下 localStorage 会直接抛异常，所以整段包 try/catch。 */
  function record() {
    var KEY = 'vmap:seen', now = Date.now();
    try {
      if (now - (+localStorage.getItem(KEY) || 0) < 864e5) return;
      localStorage.setItem(KEY, now);
    } catch (e) { /* 存不了就每次都记，无所谓 */ }
    fetch(API_WRITE, { method: 'POST', keepalive: true }).catch(function () {});
  }

  if (USE_MOCK) {
    start(MOCK);
  } else {
    record();
    fetch(API_READ, { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(start)
      .catch(function () { /* 接口挂了就当没这一节 */ });
  }
})();
