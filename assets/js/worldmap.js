/* 访客世界地图 —— 错位点阵的平面地图，零外部依赖。

   陆地用一张 180x80 的位掩码画成圆点：每行 45 个十六进制字符，
   一个字符管四格，整张图 3.6 KB，不需要任何地图库或瓦片服务。

   点阵是错位（六边形）排布：奇数行右移半格，行距取列距的 √3/2，
   每个点与周围六个点等距。比横平竖直的方格细腻，也不会在斜向海岸线
   上出现锯齿台阶。投影是等距圆柱（每行对应一条纬线）：长方形世界地图
   都会把高纬度横向拉宽，这是保留直边的代价。

   掩码由 Natural Earth 110m 陆地边界离线生成，逐行按该纬线做扫描线判定。
   纬度裁到 83N~56S，去掉南极洲和北冰洋的空行；中央经线 0°（大西洋居中）。 */
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

  var W = 180, H = 80, CH = 45;
  var LAT_T = 83, LAT_B = -56;
  var LON_C = 0;          // 中央经线：大西洋居中，切口落在 180° 经线的太平洋上，不切到任何大陆
  var ROWK = Math.sqrt(3) / 2;   // 六边形排布的行距 / 列距

  /* 经纬度 → 在地图上的相对位置（0–1），与生成掩码时的映射一致 */
  function place(lat, lon) {
    return { x: ((((lon - LON_C + 180) % 360) + 360) % 360) / 360,
             y: (LAT_T - lat) / (LAT_T - LAT_B) };
  }
  var MASK =
    '000000000003ffc6dfc00000000000000000000000000' +
    '000000000078feffffff80001400400001e0000000000' +
    '00000000235ff3ffffff0000f0000000000e000000000' +
    '000000060047e3fffffe000040000010000e000000000' +
    '00000001f8afc007ffff00000000038003ffe001d8000' +
    '0000001f09f5e003fffe0000000004003ffff98080000' +
    '0000001ffce7f803fffe000000000c0dffffffc0f8000' +
    '00ffc0c1fef1ff03fffc00001f80001fffffffffff800' +
    '81ffffff8c5d8701ffe000003ffc8bfffffffffffffff' +
    'f1ffffffffff07c1ff004000ffdcfffbffffffffffffe' +
    '31bffffffffd9f80fc03e001fbebfffffffffffffffff' +
    '01fffffffff00380f0000007efffffffffffffffffffe' +
    '01ffffffffe01c0078000007e7ffffffffffffffff2f0' +
    '00780fffffc01e400000000fe2fffffffffffffff6200' +
    '001401fffff01fe000000100c3ffffffffffffff00e00' +
    '004001fffffc1fe0000001028ffffffffffffffc01e00' +
    '0000007fffffbff8000002c23ffffffffffffffc00c00' +
    '0000017fffffbffc000005cfffffffffffffffff80800' +
    '0000003ffffffff4000000dfffffffffffffffff40000' +
    '0000000ffffffeae0000007fffffffffffffffff80000' +
    '0000000fffffffc30000007ffffffffffffffffe40000' +
    '0000000fffffffe00000007fff2f8ffffffffffc00000' +
    '0000000ffffffe400000007d3f03dffffffffffc60000' +
    '0000001ffffffc00000007e19e03cfffffffffe100000' +
    '0000000ffffff800000003c26cffeffffffffdc080000' +
    '0000000ffffff000000007c049ffcffffffff0c100000' +
    '00000007fffff0000000018740ffe7fffffffe6300000' +
    '00000007ffffe000000003fe061ffffffffff84f00000' +
    '00000001ffffc000000003ff000ffffffffffc1800000' +
    '00000001ffff8000000007ff9c1ffffffffffc0000000' +
    '00000000bff98000000007ffffffdffffffffe0000000' +
    '00000000bf80800000000fffffffdffffffffc0000000' +
    '000000005f80400000001fffffefe1fffffffc0000000' +
    '000000005f80200000003fffffefe41ffffff80000000' +
    '000000000780400000003ffffff7ff07fffff20000000' +
    '002000000784200000007ffffff7fe0ff8fe800000000' +
    '0008000007c4060000003ffffffbfe03f87e800000000' +
    '0000000001f8000000007ffffffbf803e07e020000000' +
    '00000000005c000000003ffffffdf001e05f020000000' +
    '00000000001f000000007ffffffdc001c03f000000000' +
    '000000000003000000003fffffff0001c01f820000000' +
    '0000000000010e0000003ffffffe60018007030000000' +
    '000000000000aff000001fffffffe0008012010000000' +
    '0000000000003ff000001fffffffc0004010008000000' +
    '0000000000001ffe000007cfffffc0000008080000000' +
    '0000000000001fff00000003ffff80000028300000000' +
    '0000000000001fff80000001ffff80000014380000000' +
    '0000000000007fff00000003fffe00000018f74000000' +
    '0000000000003fffe0000003fffe0000000c701800000' +
    '0000000000007ffffc000001fffc0000000e762f80000' +
    '0000000000007ffffe000000fffc000000020103e0000' +
    '0000000000007fffff000000fff8000000030001e0000' +
    '0000000000003fffff8000007ffc000000003001d0000' +
    '0000000000003fffff000000fff800000000050010000' +
    '0000000000001ffffe0000007ffc00000000000800000' +
    '0000000000001ffffc000000fffc20000000001880000' +
    '0000000000000ffffe000000fffc6000000000fc60040' +
    '00000000000007fffc000001fff8c000000001fec0000' +
    '00000000000001fffc000000fff0e000000001ffe0000' +
    '00000000000003fff8000000ffe0c000000007fff0000' +
    '00000000000001fff80000007ff0c00000001ffff8040' +
    '00000000000003ffe00000007fe1800000003ffff8000' +
    '00000000000001ffc00000007fc0000000001ffffc000' +
    '00000000000003ff800000007fc0000000001ffffc000' +
    '00000000000003ff800000003fc0000000001ffffe000' +
    '00000000000003ff000000003f80000000001ffffc000' +
    '00000000000003ff000000001f00000000000f87fc000' +
    '00000000000007fe000000001000000000001807f8000' +
    '00000000000003f8000000000000000000000000f8000' +
    '00000000000007f8000000000000000000000000f0006' +
    '00000000000007e000000000000000000000000000004' +
    '00000000000007800000000000000000000000003000c' +
    '00000000000003c000000000000000000000000010018' +
    '0000000000000f8000000000000000000000000000060' +
    '0000000000000f0000000000000000000000000000020' +
    '0000000000000f0000000000000000000000000000000' +
    '0000000000000f0000000000000000000000000000000' +
    '0000000000000e1800000000000000000000000000000' +
    '000000000000030000000000000000000000000000000' +
    '000000000000038000000000000000000000000000000'
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
    var ch  = cw * ROWK;         // 行距
    var h   = ch * H;
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
      var off = (gy & 1) ? 0.5 : 0;   // 奇数行右移半格
      for (var gx = 0; gx < W; gx++) {
        if (!bitAt(gx, gy)) continue;
        g.beginPath();
        g.arc((gx + 0.5 + off) * cw, (gy + 0.5) * ch, r, 0, 6.2832);
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
      if (typeof d.ago === 'number') b.style.color = heatColor(heat(d.ago));  // 圆点取 currentColor
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
