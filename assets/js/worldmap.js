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
  var MASK =
    '00000000000ffffffffa0000000000000000000000000' +
    '00000000007ffeffffffc0007f00400000f0000000000' +
    '0000000061e3f7ffffff8000fc0000000018000000000' +
    '0000000fd3d8001fffff8000000000f000ffe00180000' +
    '0000001f00300007ffff00000000070007ffc00000000' +
    '0000001ffdeff803fffe000000001c0fffffffe1f8000' +
    '00ffe0f1fff9ff83fffe00000fc0001fffffffffffc10' +
    'c1ffffff9cffdf81ffe000007ffcdffffffffffffffff' +
    'fbfffffffffe0fe1ff83e000fffffffffffffffffffff' +
    '007fffffffffc7c1fc03e003fffffffffffffffffffff' +
    '01fffffffff07c807800000fefffffffffffffffffffc' +
    '03ff7fffffe01f401800000ff6ffffffffffffffff3f0' +
    '001803fffff01fe000000185e3ffffffffffffff80700' +
    '006001fffffe1ff000000183cffffffffffffffe01f00' +
    '000000ffffffbffc000007c3ffffffffffffffff41e00' +
    '000000bffffffffe000007efffffffffffffffffc0c00' +
    '0000007fffffffb4000001bfffffffffffffffffc0000' +
    '0000001fffffffcf000001ffffffffffffffffffc0000' +
    '0000000ffffffff00000007ffff7efffffffffff40000' +
    '0000001fffffffc00000007fff87dffffffffffce0000' +
    '0000001ffffffe00000007f3df03effffffffff1c0000' +
    '0000001ffffffc00000007e27fffffffffffffe180000' +
    '0000000ffffff800000007c06dffeffffffff8e180000' +
    '00000007fffff8000000033f00fffffffffffe6380000' +
    '00000003fffff000000003ff001ffffffffffe1e00000' +
    '00000001ffffc000000007ffcc1ffffffffffe1000000' +
    '00000000ffffc000000007fffffffffffffffe0000000' +
    '00000000ffc0c00000000ffffffffffffffffe0000000' +
    '000000007fc0d00000003fffffeff3fffffffc0000000' +
    '000000002fc0300000003ffffffff61ffffffe0000000' +
    '0000000007c1e00000007fffffffff0ffffff20000000' +
    '0000000007ce180000007fffffffff03fcffc00000000' +
    '0000000003fe3fc000007ffffffbfe03f87f830000000' +
    '0000000000fc000000007ffffffdf803f07f030000000' +
    '00000000001f800000007fffffffe001e03f820000000' +
    '000000000003800000007fffffff0001e01f828000000' +
    '0000000000018ff000003ffffffff000c013078000000' +
    '000000000000fff000001ffffffff000e01809c000000' +
    '0000000000001ffc00000fffffffe000201808c000000' +
    '0000000000001fff8000060fffffe000007c1c0000000' +
    '0000000000003fff80000003ffffc000003c780000000' +
    '0000000000007fff80000003ffff0000001cfbe000000' +
    '0000000000007ffff0000003fffe0000000eff1c00000' +
    '0000000000007ffffe000001fffe0000000f7f7fc6000' +
    '0000000000007fffff800000fffc000000020703ef000' +
    '0000000000003fffff800000fffc00000001e001f0c00' +
    '0000000000003fffff800000fffc00000000018018600' +
    '0000000000001fffff000000fffe00000000001840000' +
    '0000000000001ffffe000000fffe20000000001ec0000' +
    '0000000000000ffffe000001fffe7000000000fce0040' +
    '00000000000003fffe000001fffce000000001fff0000' +
    '00000000000003fffe000000fff0e000000003fff0000' +
    '00000000000003fffc000000fff1e00000001ffff80c0' +
    '00000000000003fff00000007ff1c00000003ffffc000' +
    '00000000000003ffe00000007fe0c00000003ffffe000' +
    '00000000000003ffc00000007fe0000000003ffffe000' +
    '00000000000003ffc00000003fc0000000001ffffe000' +
    '00000000000003ff800000003fc0000000001ffffe000' +
    '00000000000003ff000000001f00000000001f87fc000' +
    '00000000000007fc000000000000000000000003fc008' +
    '00000000000007fc000000000000000000000001f8004' +
    '00000000000007e00000000000000000000000000000e' +
    '00000000000007e00000000000000000000000003800e' +
    '0000000000000fc000000000000000000000000030018' +
    '0000000000000f8000000000000000000000000000070' +
    '0000000000000f8000000000000000000000000000000' +
    '0000000000000f80000000000000000c0000000000000' +
    '0000000000000f0000000000000000000000000000000' +
    '0000000000000f0000000000000000000000000000000' +
    '00000000000003c000000000000000000000000000000';

  /* 部署好 Worker 之后把 USE_MOCK 改成 false，这是唯一需要动的开关。
     为 false 时若接口取不到数据，整块保持隐藏 —— 宁可什么都不显示，
     也不能把编出来的数字当成真实访问量摆在页面上。 */
  var USE_MOCK = true;
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
    var max = 0, cities = DATA.length, total = 0, cc = {};
    DATA.forEach(function (d) {
      if (d.n > max) max = d.n;
      total += d.n; cc[d.cc] = 1;
    });

    DATA.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vmap-pin';
      b.style.left = ((d.lon + 180) / 360 * 100) + '%';
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

    var meta = document.getElementById('visitorMeta');
    if (meta) {
      meta.textContent = total.toLocaleString() + ' visits from ' + cities +
                         ' cities in ' + Object.keys(cc).length + ' countries.';
    }
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
