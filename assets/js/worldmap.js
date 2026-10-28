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

  /* USE_MOCK 为 true 时用下面的原型数据预览版式（本地没有 Worker 时用）；线上保持 false。
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

  var w = 0, h = 0;

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

    /* 点的大小随地图宽度变，哪些点互相压住也跟着变，所以每次重画都重新合并 */
    regroup();
    [].forEach.call(pins.children, function (b) {
      b._x = b._u * w; b._y = b._v * h;
      b.style.left = b._x + 'px';
      b.style.top  = b._y + 'px';
    });
  }

  /* 点的直径（px）参照 chenyanzhe.page：半径 = 3 + min(4, 2.4·log10(n+1))，按 900 宽的坐标算，
     访问量到 ~45 次封顶 —— 对数而非开方，一个热门城市不会大到压住周围。
     换算比例随地图宽度：620px（对方地图的最大宽度）时直径 5–9.6px，更窄时等比缩小，
     手机上的点才不会相对地图大出一倍、挤成一团。 */
  function sizeOf(n) {
    var r = 3 + Math.min(4, 2.4 * Math.log(n + 1) / Math.LN10);
    return Math.max(3, 2 * r * Math.min(w, 620) / 900);
  }

  /* 合并互相压住的点。接口按城市计数，同一片地方会有好几个名字（香港、东涌、上水；
     深圳的宝安、固戍），1° 之内挤着五六个点，在地图上还不到 2px，鼠标只摸得到最上面那个。
     所以按屏幕距离分组：两点间距小于半径之和再加 2px 就并成一个点，
     大小按合计次数，悬停时列出组里每个城市。
     贪心：按访问量从多到少，只和每组的第一个点（种子）比距离，点就落在种子上 ——
     不会 A 挨 B、B 挨 C 地连成一长串，也不会把点挪到两座城市中间的空地上。 */
  var POINTS = [];
  function regroup() {
    var groups = [];
    POINTS.forEach(function (p) {
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        if (Math.hypot((p.u - g.u) * w, (p.v - g.v) * h) < (sizeOf(g.n) + sizeOf(p.d.n)) / 2 + 2) {
          g.n += p.d.n; g.list.push(p.d);
          return;
        }
      }
      groups.push({ u: p.u, v: p.v, n: p.d.n, list: [p.d] });
    });
    pins.textContent = '';
    tip.hidden = true; tip._pin = null;
    groups.forEach(function (g) { pins.appendChild(makePin(g)); });
  }

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

  /* 中文页面上的城市名。接口给的是 Cloudflare 的英文城市名，没有译名可查，只能列在这里：
     线上已出现过的城市全部收录，另补一批常见城市；不在表里的照旧显示英文。
     国家/地区名不用列，交给浏览器自带的 Intl.DisplayNames（CLDR 简称：CN → 中国）。 */
  var CITY_ZH = {
    // 线上已出现过的
    'Singapore': '新加坡', 'Shanghai': '上海', 'Hangzhou': '杭州',
    'Jiaxing': '嘉兴', 'Nanjing': '南京', 'Hefei': '合肥', 'Beijing': '北京', 'Tianjin': '天津',
    'Taiyuan': '太原', 'Zhengzhou': '郑州', 'Shijiazhuang': '石家庄', 'Hohhot': '呼和浩特',
    'Wuhan': '武汉', 'Guangzhou': '广州', 'Dongguan': '东莞', 'Hong Kong': '香港',
    'Taichung': '台中', 'Hsinchu': '新竹', 'Tokyo': '东京', 'Seoul': '首尔',
    'Hanoi': '河内', 'Bangkok': '曼谷', 'Phagwāra': '帕格瓦拉',
    'Paris': '巴黎', 'Lille': '里尔', 'Nuremberg': '纽伦堡', 'Copenhagen': '哥本哈根',
    'Malmö': '马尔默', 'Sogndal': '松达尔', 'Kaunas': '考纳斯', 'İzmir': '伊兹密尔',
    'New York City': '纽约', 'Washington': '华盛顿', 'Ashburn': '阿什本', 'Boydton': '博伊德顿',
    'Arlington': '阿灵顿', 'Malden': '莫尔登', 'Chicago': '芝加哥', 'DeKalb': '迪卡尔布',
    'Ann Arbor': '安娜堡', 'Fitchburg': '菲奇堡', 'Dallas': '达拉斯', 'Oklahoma City': '俄克拉何马城',
    'Tulsa': '塔尔萨', 'Omaha': '奥马哈', 'Council Bluffs': '康瑟尔布拉夫斯',
    'Springfield': '斯普林菲尔德', 'Huntsville': '亨茨维尔', 'Avon Park': '埃文帕克',
    'Phoenix': '菲尼克斯', 'San Diego': '圣迭戈', 'Los Angeles': '洛杉矶', 'San Jose': '圣何塞',
    'Santa Clara': '圣克拉拉', 'Palo Alto': '帕洛阿尔托', 'Moses Lake': '摩西湖',
    'Montréal': '蒙特利尔', 'Beauharnois': '博阿尔努瓦',
    'Caracas': '加拉加斯', 'Ciudad Guayana': '圭亚那城', 'Managua': '马那瓜', 'Cali': '卡利',
    // 常见城市，备着
    'Shenzhen': '深圳', 'Foshan': '佛山', 'Zhuhai': '珠海', 'Macau': '澳门', 'Macao': '澳门',
    'Suzhou': '苏州', 'Wuxi': '无锡', 'Ningbo': '宁波', 'Shaoxing': '绍兴', 'Wenzhou': '温州',
    'Chengdu': '成都', 'Chongqing': '重庆', "Xi'an": '西安', 'Changsha': '长沙', 'Xiamen': '厦门',
    'Fuzhou': '福州', 'Jinan': '济南', 'Qingdao': '青岛', 'Dalian': '大连', 'Shenyang': '沈阳',
    'Harbin': '哈尔滨', 'Changchun': '长春', 'Kunming': '昆明', 'Nanchang': '南昌',
    'Taiwan': '台湾', 'Taipei': '台北', 'Kaohsiung': '高雄', 'Tainan': '台南', 'Taoyuan': '桃园',
    'Osaka': '大阪', 'Kyoto': '京都', 'Busan': '釜山', 'Daejeon': '大田',
    'Kuala Lumpur': '吉隆坡', 'Jakarta': '雅加达', 'Ho Chi Minh City': '胡志明市',
    'Bengaluru': '班加罗尔', 'Mumbai': '孟买', 'New Delhi': '新德里', 'Hyderabad': '海得拉巴',
    'Dubai': '迪拜', 'Tel Aviv': '特拉维夫', 'Istanbul': '伊斯坦布尔', 'Moscow': '莫斯科',
    'London': '伦敦', 'Cambridge': '剑桥', 'Oxford': '牛津', 'Edinburgh': '爱丁堡',
    'Berlin': '柏林', 'Munich': '慕尼黑', 'Frankfurt am Main': '法兰克福', 'Zurich': '苏黎世',
    'Geneva': '日内瓦', 'Amsterdam': '阿姆斯特丹', 'Vienna': '维也纳', 'Madrid': '马德里',
    'Barcelona': '巴塞罗那', 'Milan': '米兰', 'Rome': '罗马', 'Dublin': '都柏林',
    'Stockholm': '斯德哥尔摩', 'Helsinki': '赫尔辛基', 'Oslo': '奥斯陆', 'Warsaw': '华沙',
    'Prague': '布拉格', 'Toronto': '多伦多', 'Vancouver': '温哥华',
    'San Francisco': '旧金山', 'Berkeley': '伯克利', 'Mountain View': '山景城',
    'Sunnyvale': '桑尼维尔', 'Seattle': '西雅图', 'Boston': '波士顿', 'Pittsburgh': '匹兹堡',
    'Philadelphia': '费城', 'Princeton': '普林斯顿', 'Austin': '奥斯汀', 'Houston': '休斯敦',
    'Atlanta': '亚特兰大', 'Denver': '丹佛', 'Miami': '迈阿密',
    'Sydney': '悉尼', 'Melbourne': '墨尔本', 'Brisbane': '布里斯班', 'Auckland': '奥克兰',
    'São Paulo': '圣保罗', 'Mexico City': '墨西哥城'
  };
  var REGION_ZH = null;
  try { REGION_ZH = new Intl.DisplayNames(['zh-CN'], { type: 'region', style: 'short' }); } catch (e) {}

  /* 港澳台和内地一样写成中国：英文 "Hong Kong, CN"、"Taipei, CN"，中文「香港，中国」「台北，中国」。
     不能像其他国家那样写 HK、TW 或「香港」「台湾」，读起来像是与中国并列的国家。
     只改显示：Cloudflare 报的原始代码照旧用来并区（见下面的 WHOLE） */
  var IN_CN = { HK: 1, MO: 1, TW: 1 };
  /* 中文写成「广州，中国」，英文 "Guangzhou, CN"；城市与国家同名时只写一次（新加坡） */
  function placeName(d, chinese) {
    var city = chinese ? CITY_ZH[d.city] || d.city : d.city, sep = chinese ? '，' : ', ';
    var cc = IN_CN[d.cc] ? 'CN' : d.cc;
    if (!chinese) return city + sep + cc;
    var region = cc;
    try { if (REGION_ZH) region = REGION_ZH.of(cc) || cc; } catch (e) {}
    return city === region ? city : city + sep + region;
  }
  function visitLabel(d) {
    var chinese = document.documentElement.lang === 'zh-CN';
    return placeName(d, chinese) + ' \u00b7 ' + d.n + (chinese ? ' 次访问' : d.n === 1 ? ' visit' : ' visits') +
      (typeof d.ago === 'number' ? ' \u00b7 ' + agoText(d.ago) : '');
  }
  function agoOf(d) { return typeof d.ago === 'number' ? d.ago : Infinity; }   // 旧版接口没有 ago，排到最后
  /* 一组点的说明：每个城市一行，最近来过的排在最前；超过 8 个只列最近的 7 个 */
  function groupLabel(g, sep) {
    var all = g.list.slice().sort(function (a, b) { return agoOf(a) < agoOf(b) ? -1 : agoOf(a) > agoOf(b) ? 1 : 0; });
    var list = all.length > 8 ? all.slice(0, 7) : all;
    var lines = list.map(visitLabel), rest = all.length - list.length;
    if (rest) lines.push(document.documentElement.lang === 'zh-CN' ? '另有 ' + rest + ' 处' : '+' + rest + ' more');
    return lines.join(sep);
  }
  function updateLanguage() {
    pins.querySelectorAll('.vmap-pin').forEach(function (pin) {
      pin.setAttribute('aria-label', groupLabel(pin._group, '; '));
    });
    if (tip._pin && !tip.hidden) showTip(tip._pin);
  }
  document.addEventListener('languagechange', updateLanguage);
  updateLanguage();

  /* 提示框以点为中心，但左右不出地图：多行的提示比单个城市宽得多，
     落在美西、东亚边上的点会把它顶出纸面 */
  function placeTip() {
    var p = tip._pin, half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(w - half, p._x)) + 'px';
    tip.style.top  = p._y + 'px';
  }
  function showTip(pin) {
    tip.textContent = groupLabel(pin._group, '\n');
    tip._pin = pin;
    tip.hidden = false;
    placeTip();
  }

  function makePin(g) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'vmap-pin';
    b._u = g.u;                  // 在整张图上的相对位置；像素坐标由 draw() 按视图换算
    b._v = g.v;
    b._group = g;
    b.style.setProperty('--s', sizeOf(g.n).toFixed(1) + 'px');
    b.setAttribute('aria-label', groupLabel(g, '; '));
    // 按组里最近的一次访问着色；旧版接口没有 ago 字段时不着色，保持单色，页面不会坏
    var ago = Math.min.apply(null, g.list.map(agoOf));
    if (ago < Infinity) {
      var t = heat(ago);
      b.style.color = heatColor(t);               // 圆点取 currentColor
      b.style.setProperty('--fade', fadeOf(t).toFixed(3));
    }
    b.addEventListener('mouseenter', function () { showTip(b); });
    b.addEventListener('focus',      function () { showTip(b); });
    b.addEventListener('mouseleave', function () { tip.hidden = true; });
    b.addEventListener('blur',       function () { tip.hidden = true; });
    return b;
  }

  function build() {
    /* 淡到看不见的点（半年以上没来过）直接不画：既不该是一个摸得到的按钮，
       也不能被并进附近的点里，把它的城市名带进别人的提示 */
    POINTS = DATA.filter(function (d) {
      return typeof d.ago !== 'number' || fadeOf(heat(d.ago)) >= 0.03;
    }).sort(function (a, b) { return b.n - a.n; }).map(function (d) {
      var pt = place(d.lat, d.lon);
      return { u: pt.x, v: pt.y, d: d };
    });

    el.classList.add('is-ready');
    var sec = document.getElementById('visitors');
    if (sec) sec.removeAttribute('hidden');
  }

  /* 同一座城市会被拆成好几个名字：Cloudflare 按 IP 库定位，有的 IP 只精确到城市（Hong Kong），
     有的精确到区（东涌、上水；深圳的宝安、固戍）。显示前并回所属城市 ——
     次数相加，取最近一次访问，位置放在次数最多的那个区上。数据库里的原始记录不动。
     香港、澳门整个就是一座城，报的是哪个区都并成一个；台湾也整个并成一个点，不再分台中、新竹这些城市 */
  var WHOLE = { HK: 'Hong Kong', MO: 'Macau', TW: 'Taiwan' };
  var PARENT = {
    "Bao'an|CN": 'Shenzhen', 'Gushu|CN': 'Shenzhen', 'Nanshan|CN': 'Shenzhen', 'Futian|CN': 'Shenzhen',
    'Longgang|CN': 'Shenzhen', 'Longhua|CN': 'Shenzhen', 'Luohu|CN': 'Shenzhen',
    'Jurong West|SG': 'Singapore', 'Stodůlky|CZ': 'Prague'
  };
  function mergeDistricts(rows) {
    var byKey = {}, merged = [];
    rows.forEach(function (d) {
      var city = WHOLE[d.cc] || PARENT[d.city + '|' + d.cc] || d.city, k = city + '|' + d.cc, m = byKey[k];
      if (!m) { m = byKey[k] = { city: city, cc: d.cc, lat: d.lat, lon: d.lon, n: 0, top: 0 }; merged.push(m); }
      if (d.n > m.top) { m.top = d.n; m.lat = d.lat; m.lon = d.lon; }
      m.n += d.n;
      if (typeof d.ago === 'number') m.ago = typeof m.ago === 'number' ? Math.min(m.ago, d.ago) : d.ago;
    });
    return merged;
  }

  function start(rows) {
    if (!rows || !rows.length) return;     // 没数据就整块不出现
    DATA = mergeDistricts(rows);
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
