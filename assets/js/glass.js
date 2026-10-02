/* ---------- 液态玻璃（WebGL） ----------
   移植自 ybouane/liquidglass（github.com/ybouane/liquidglass，MIT）。它的效果靠两件事：
   1. 把玻璃背后的页面栅格化成一张图；
   2. 在 WebGL 里用它的片元着色器折射这张图 —— 纹理按双线性插值取样，放大、压缩处都是平滑的。
   之前用 SVG 位移滤镜（backdrop-filter: url(#…)）做折射，Chrome 的 feDisplacementMap 按最近邻
   取样，弯边一放大就出锯齿、条纹、斜纹，调参数治不好；而且只有 Chromium 支持。

   截图：克隆页面（去掉导航本身），图片、字体、样式表内联成 data URL，视频和地图画布换成当前画面，
   入场动画统一按"已浮现"处理，再交给浏览器经 SVG foreignObject 自己画出来 —— 字体、排版和页面一致。
   页面内容变了（切换语言、展开 News、地图载入、改变窗口大小）就重截一次。
   截不到图或没有 WebGL（极少数环境）时什么也不做，导航保持 CSS 的模糊玻璃。 */
(function () {
  var nav = document.querySelector('.nav');
  var wrap = nav && nav.querySelector('.wrap');
  if (!wrap || !window.Promise || !window.fetch) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-transparency: reduce)').matches) return;

  /* ---------- 截图 ---------- */

  var CAPTURE_CSS =
    '.lg-cap .rise{opacity:1!important;transform:none!important}' +
    '.lg-cap *,.lg-cap *::before,.lg-cap *::after{transition:none!important;animation:none!important}';

  var dataCache = {};
  function dataURL(url) {
    if (!dataCache[url]) {
      dataCache[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (b) {
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = function () { res(''); };
          fr.readAsDataURL(b);
        });
      }).catch(function () { return ''; });
    }
    return dataCache[url];
  }

  /* 页面所有样式表的文本，url(...)（字体等）换成 data URL。只取一次 */
  var cssPromise = null;
  function pageCss() {
    if (cssPromise) return cssPromise;
    var sheets = [].map.call(document.querySelectorAll('link[rel=stylesheet], style'), function (el) {
      if (el.tagName === 'STYLE') return Promise.resolve({ text: el.textContent, base: location.href });
      return fetch(el.href).then(function (r) { return r.text(); })
        .then(function (t) { return { text: t, base: el.href }; }, function () { return { text: '', base: el.href }; });
    });
    cssPromise = Promise.all(sheets).then(function (list) {
      return Promise.all(list.map(function (sh) {
        var re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, m, urls = [];
        while ((m = re.exec(sh.text))) if (!/^data:/.test(m[2]) && urls.indexOf(m[2]) < 0) urls.push(m[2]);
        return Promise.all(urls.map(function (u) {
          return dataURL(new URL(u, sh.base).href).then(function (d) { return [u, d]; });
        })).then(function (pairs) {
          var t = sh.text;
          pairs.forEach(function (p) { if (p[1]) t = t.split(p[0]).join(p[1]); });
          return t;
        });
      }));
    }).then(function (texts) { return texts.join('\n'); });
    return cssPromise;
  }

  /* 把整页画成一张 SVG 图（矢量，尚未栅格化）。返回 { img, W, H } */
  function capturePage() {
    var root = document.documentElement;
    var W = root.clientWidth, H = Math.max(root.scrollHeight, document.body.scrollHeight);
    var body = document.body.cloneNode(true), jobs = [];
    // 原件与克隆按文档顺序一一对应：先配对处理图片、视频、画布，再删掉导航等
    var sel = 'img, video, canvas', oList = document.body.querySelectorAll(sel), cList = body.querySelectorAll(sel);
    for (var i = 0; i < oList.length; i++) (function (o, c) {
      if (nav.contains(o) || o.hasAttribute('data-lg-skip')) return;   // 纯装饰的动画画布（如头像的去噪动效）不截
      if (o.tagName === 'IMG') {
        c.removeAttribute('srcset'); c.removeAttribute('loading');
        // 跑马灯里的照片在截图里本来就是隐藏的（render() 每帧按实时位置画），不必内联成
        // data URL —— 否则每次截图都要把整个相册读一遍、编码进 SVG，懒加载也形同虚设。
        // 只去掉地址、钉住宽度，照片框的尺寸不变
        if (o.closest('[data-lg-live]')) {
          c.removeAttribute('src');
          c.style.width = o.offsetWidth + 'px';
          return;
        }
        var src = o.currentSrc || o.src;
        if (!src) return;
        jobs.push(dataURL(src).then(function (d) { if (d) c.setAttribute('src', d); }));
        return;
      }
      // 视频、画布：换成当前画面的静态图，尺寸照原件
      var img = document.createElement('img'), r = o.getBoundingClientRect();
      img.className = c.className;
      img.setAttribute('style', (c.getAttribute('style') || '') + ';width:' + r.width + 'px;height:' + r.height + 'px');
      try {
        if (o.tagName === 'CANVAS') img.src = o.toDataURL();
        else if (o.readyState >= 2 && o.videoWidth) {
          var cv = document.createElement('canvas');
          cv.width = o.videoWidth; cv.height = o.videoHeight;
          cv.getContext('2d').drawImage(o, 0, 0);
          img.src = cv.toDataURL('image/jpeg', .85);
        } else if (o.poster) jobs.push(dataURL(o.poster).then(function (d) { img.src = d; }));
      } catch (e) { /* 画面取不到就留空 */ }
      c.parentNode.replaceChild(img, c);
    })(oList[i], cList[i]);
    [].forEach.call(body.querySelectorAll('script, [data-lg-skip]'), function (n) { n.parentNode.removeChild(n); });
    // 导航不能删：它是 sticky，在文档流里占着 64px，删了下面整页内容都会上移。只让它不可见 ——
    // 用 opacity 而不是 visibility：入口里的双语标签自己写了 visibility: visible，会盖过父级的
    // hidden，导航文字就被截进背景、再被玻璃折射出来，在空白底色上看得一清二楚
    [].forEach.call(body.querySelectorAll('.nav'), function (n) { n.setAttribute('style', 'opacity:0!important'); });
    // 一直在动的内容（如相册的跑马灯）不进静态截图，由 render() 每帧按实时位置画上去
    [].forEach.call(body.querySelectorAll('[data-lg-live] > *'), function (n) {
      n.setAttribute('style', (n.getAttribute('style') || '') + ';opacity:0!important');
    });

    return Promise.all(jobs).then(pageCss).then(function (css) {
      var cls = ((root.getAttribute('class') || '') + ' lg-cap').trim();
      var xml = new XMLSerializer().serializeToString(body);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
        '<foreignObject x="0" y="0" width="' + W + '" height="' + H + '">' +
        '<html xmlns="http://www.w3.org/1999/xhtml" lang="' + (root.lang || 'en') + '" class="' + cls + '">' +
        '<head><style><![CDATA[' + css.replace(/\]\]>/g, '') + CAPTURE_CSS + ']]></style></head>' + xml + '</html>' +
        '</foreignObject></svg>';
      var img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return (img.decode ? img.decode() : new Promise(function (r) { img.onload = r; }))
        .then(function () { return { img: img, W: W, H: H }; });
    });
  }

  /* ---------- WebGL ---------- */

  /* 着色器：ybouane/liquidglass 的 FS_GLASS，逐行照搬，只改了坐标的来源 ——
     原库把玻璃画在整页大小的画布上，这里每块玻璃一张自己的画布，背景是它下面那一块的裁切图。
     所有长度都是物理像素（原库同样把尺寸、圆角、弯边深度乘 devicePixelRatio 传进来）。 */
  var VS = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
  var FS = [
    'precision highp float;',
    'uniform sampler2D u_tex;',
    'uniform vec2 u_size;', 'uniform vec2 u_crop;', 'uniform float u_pad;', 'uniform float u_radius;',
    'uniform float u_refract;', 'uniform float u_chroma;', 'uniform float u_edgeHL;', 'uniform float u_fresnel;',
    'uniform float u_zRadius;', 'uniform float u_alpha;', 'uniform float u_shade;', 'uniform float u_rimTop;', 'uniform float u_rimBot;', 'uniform float u_px;',
    'float rrSDF(vec2 p, vec2 b, float r) {',
    '  vec2 q = abs(p) - b + vec2(r);',
    '  return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;',
    '}',
    'float bevelHeight(float d, float zR) {',
    '  if (d <= 0.0) return 0.0;',
    '  if (d >= zR) return zR;',
    '  return sqrt(d * (2.0 * zR - d));',
    '}',
    'void main() {',
    '  vec2 half_ = u_size * 0.5;',
    '  vec2 lp = vec2(gl_FragCoord.x - half_.x, half_.y - gl_FragCoord.y);',   // 以中心为原点、y 向下
    '  float r = min(u_radius, min(half_.x, half_.y));',
    '  float sdf = rrSDF(lp, half_, r);',
    '  if (sdf > 0.5) { gl_FragColor = vec4(0.0); return; }',
    '  float mask = 1.0 - smoothstep(-1.5, 0.5, sdf);',
    '  float maxD = min(half_.x, half_.y);',
    '  float inside = -sdf;',
    '  float edge = smoothstep(maxD * 0.35, 0.0, inside);',
    '  float zR = u_zRadius;',
    '  float e = 2.0;',
    '  float hC = bevelHeight(inside, zR);',
    '  float hR = bevelHeight(-rrSDF(lp + vec2(e, 0.0), half_, r), zR);',
    '  float hL = bevelHeight(-rrSDF(lp - vec2(e, 0.0), half_, r), zR);',
    '  float hU = bevelHeight(-rrSDF(lp + vec2(0.0, e), half_, r), zR);',
    '  float hD = bevelHeight(-rrSDF(lp - vec2(0.0, e), half_, r), zR);',
    '  vec2 hGrad = vec2(hR - hL, hU - hD) / (2.0 * e);',
    '  vec3 N = normalize(vec3(-hGrad, 1.0));',
    '  float depth = smoothstep(0.0, zR, inside);',
    '  float refrPow = 1.0 - 1.0 / 1.5;',
    '  float thickNorm = hC * 2.0 / max(zR * 2.0, 1.0);',
    '  vec2 entryRefr = hGrad * refrPow;',
    '  vec2 refrPx = (entryRefr + entryRefr + entryRefr * thickNorm * 0.5) * u_refract * 30.0;',
    '  refrPx += -lp / max(half_, vec2(1.0)) * u_refract * 4.0 * depth;',
    '  float caS = u_chroma * 18.0 * (edge * 0.7 + 0.3) * 2.0;',
    '  vec2 caD = N.xy * caS / u_crop;',
    '  vec2 base = (lp + half_ + vec2(u_pad) + refrPx) / u_crop;',
    '  vec3 col = vec3(texture2D(u_tex, base + caD).r, texture2D(u_tex, base).g, texture2D(u_tex, base - caD).b);',
    '  col *= 1.0 + 0.06 * depth;',
    // 以下两项是本站加的光照，原库没有：纯色底上折射什么也弯不出来，立体感只能靠光照。
    // 光从正上方来（y 向下，所以是 -y）；只用法线，左右对称，不碰折射。
    // 明暗：法线朝光处亮、背光处暗 —— 平坦区 N·L 正好等于 L.z，乘数为 1，不变
    '  vec3 Ld = normalize(vec3(0.0, -0.75, 1.0));',
    '  col *= 1.0 + u_shade * (dot(N, Ld) - Ld.z);',
    // 轮廓高光：只在最外缘约 1.5px 的一条细线上，按这段轮廓朝向光的程度定亮度 ——
    // 上沿最亮、沿两侧渐暗、下沿一道较弱的反光。内部不加白：加在面上，深色底上就成了一层白雾
    '  vec2 outN = length(N.xy) > 1e-4 ? normalize(N.xy) : vec2(0.0);',
    '  float facing = dot(outN, vec2(0.0, -1.0));',
    '  float band = 1.0 - smoothstep(0.8 * u_px, 2.0 * u_px, inside);',   // 轮廓往里 0.8px 内全亮，到 2px 归零
    '  float rimHL = band * (u_rimTop * pow(max(facing, 0.0), 1.5) + u_rimBot * pow(max(-facing, 0.0), 1.5));',
    '  float fres = pow(1.0 - abs(N.z), 4.0) * u_fresnel;',
    '  float bw = 1.5;',
    '  float stroke = smoothstep(-bw - 1.0, -bw, sdf) * (1.0 - smoothstep(-1.0, 0.0, sdf));',
    '  stroke *= 0.4 + 0.6 * (0.5 + 0.5 * (-lp.y / half_.y));',
    '  float rim = edge * u_edgeHL * 0.22;',
    '  float innerGlow = smoothstep(5.0, 0.0, -sdf) * u_edgeHL * 0.15;',
    '  float envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;',
    '  vec3 fin = col + vec3(rim + innerGlow + stroke * u_edgeHL * 0.55 + envRefl);',
    '  fin = mix(fin, vec3(1.0), fres * 0.2);',
    // 滤色叠加：暗处提亮明显、亮处几乎不变 —— 像光打在表面上，而不是贴一层白
    '  fin = fin + (1.0 - fin) * rimHL;',
    '  gl_FragColor = vec4(fin, mask * u_alpha);',
    '}'
  ].join('\n');

  /* 参数取原库默认值，两处按尺寸调整：
     - 弯边深度：原库 40px 是给大面板的。放在 50px 高的胶囊上，比半高还深，上下两段圆弧
       在中线处以夹角相接 —— 上半往下折、下半往上折，背后的内容被折成上下两截放大的副本。
       小块玻璃取短边的 32%（胶囊与圆钮 16px，中间留出平坦区），大块玻璃仍用 40px。
     - 磨砂：同原库演示里的胶囊按钮（blurAmount 0.3，σ 约 3.1 物理像素）；
       Regular Glass 那样完全不模糊，背后的字和导航文字互相打架。 */
  var G = { refraction: .69, zRadius: 40, zRatio: .32, chroma: .05, edgeHL: .05, fresnel: 1, pad: 20,
            frost: 3.1, loupeMag: 2, loupeZ: 24,
            shade: .015, rimTop: .7, rimBot: .35 };   // 本站加的光照：弯边明暗与轮廓高光，不影响折射

  function makeGL(canvas) {
    var gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    function sh(type, src) {
      var o = gl.createShader(type);
      gl.shaderSource(o, src); gl.compileShader(o);
      return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null;
    }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);     // 双线性：效果的关键
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var u = {};
    ['u_tex', 'u_size', 'u_crop', 'u_pad', 'u_radius', 'u_refract', 'u_chroma', 'u_edgeHL', 'u_fresnel', 'u_zRadius', 'u_alpha',
     'u_shade', 'u_rimTop', 'u_rimBot', 'u_px']
      .forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    return { gl: gl, u: u };
  }

  /* ---------- 每块玻璃 ---------- */

  /* opt.mag：放大倍数（取样范围缩小为玻璃的 1/mag，再按原图分辨率画满 —— 放大的内容是清楚的）；
     opt.frost(k)：返回这一帧的背景模糊 σ（裁切画布的像素）；opt.active()：false 时不画 */
  var views = [];
  function addView(pane, opt) {
    var cv = document.createElement('canvas');
    cv.className = 'lg-refract';
    cv.setAttribute('aria-hidden', 'true');
    var ctx = makeGL(cv);
    if (!ctx) return null;
    var crop = document.createElement('canvas'), raw = document.createElement('canvas');
    var v = { pane: pane, cv: cv, gl: ctx.gl, u: ctx.u, crop: crop, c2: crop.getContext('2d'),
              raw: raw, r2: raw.getContext('2d'), mag: (opt && opt.mag) || 1, zRadius: opt && opt.zRadius,
              frost: opt && opt.frost, active: opt && opt.active };
    views.push(v);
    return v;
  }
  var panes = [wrap, nav.querySelector('.language-toggle')].filter(Boolean);
  for (var i = 0; i < panes.length; i++) {
    if (!addView(panes[i], { frost: function () { return G.frost; } })) return;   // 没有 WebGL：保持 CSS 模糊玻璃
  }

  var scene = null, live = false, pageBg = getComputedStyle(document.body).backgroundColor;
  var videos = [].filter.call(document.querySelectorAll('video'), function (vd) { return !nav.contains(vd); });
  /* 一直在动的内容：标了 data-lg-live 的容器（相册的跑马灯轨道），其子元素每帧按实时位置画。
     原库对这类内容（data-dynamic）是每帧重新栅格化；这里只画图片和圆角底色，便宜得多 */
  /* 放大镜下的照片：<img data-lg-hi="大图地址"> 被放大时改画大图，否则 2 倍放大就是把原图拉伸 2 倍。
     大图只在第一次被放大镜扫到时才下载，解码好之前先画原图，好了再让各块玻璃重画一次。
     只留最近用过的 6 张：放大镜一次最多压着两三张照片，跑马灯却会把整个相册送过来，
     全留着的话解码后的位图（一张约 7MB）会把手机的内存吃满 */
  var hiImgs = {}, hiOrder = [];
  function sharper(im) {
    var url = im.getAttribute('data-lg-hi');
    if (!url) return im;
    var h = hiImgs[url], at = hiOrder.indexOf(url);
    if (at >= 0) hiOrder.splice(at, 1);
    hiOrder.push(url);
    if (!h) {
      h = hiImgs[url] = new Image();
      h.src = url;
      var ok = function () { if (hiImgs[url] === h) { h._ok = true; views.forEach(function (v) { v.rescan = true; }); schedule(); } };
      if (h.decode) h.decode().then(ok, function () { if (h.naturalWidth) ok(); });
      else h.onload = ok;
      if (hiOrder.length > 6) delete hiImgs[hiOrder.shift()];
    }
    return h._ok ? h : im;
  }

  function drawLive(ctx2, el, x0, y0, k, hi) {
    var r = el.getBoundingClientRect();
    if (!el._lg) {
      var cs = getComputedStyle(el);
      el._lg = { r: parseFloat(cs.borderTopLeftRadius) || 0, bg: cs.backgroundColor, img: el.querySelector('img') };
    }
    var x = (r.left + window.scrollX - x0) * k, y = (r.top + window.scrollY - y0) * k;
    ctx2.save();
    ctx2.beginPath();
    if (ctx2.roundRect) ctx2.roundRect(x, y, r.width * k, r.height * k, el._lg.r * k);
    else ctx2.rect(x, y, r.width * k, r.height * k);
    ctx2.clip();
    ctx2.fillStyle = el._lg.bg;
    ctx2.fillRect(x, y, r.width * k, r.height * k);
    var im = el._lg.img;
    if (im && im.complete && im.naturalWidth) {
      var ir = im.getBoundingClientRect();
      ctx2.drawImage(hi ? sharper(im) : im, (ir.left + window.scrollX - x0) * k, (ir.top + window.scrollY - y0) * k, ir.width * k, ir.height * k);
    }
    ctx2.restore();
  }
  videos.forEach(function (vd) {
    vd.addEventListener('play', function () { views.forEach(function (v) { v.rescan = true; }); schedule(); });
  });
  // 窗口尺寸变了，照片在条内的偏移也会变，下次重新量
  window.addEventListener('resize', function () {
    liveTracks.forEach(function (t) { [].forEach.call(t.children, function (k) { k._ow = null; }); });
  });

  function goLive() {
    if (live) return;
    live = true;
    views.forEach(function (v) {
      v.pane.appendChild(v.cv);
      v.pane.style.backdropFilter = v.pane.style.webkitBackdropFilter = 'none';
    });
    nav.classList.add('lg-webgl');
    if (loupe) loupe.ready();
  }
  function giveUp() {                       // 截图不可用（如画布被污染）：退回 CSS 模糊
    live = false; scene = null;
    views.forEach(function (v) {
      if (v.cv.parentNode) v.cv.parentNode.removeChild(v.cv);
      v.pane.style.backdropFilter = v.pane.style.webkitBackdropFilter = '';
    });
    nav.classList.remove('lg-webgl');
  }

  /* 渲染。性能上的几件事：
     - 每块玻璃各自判断要不要画：位置、截图版本、磨砂都没变、下面也没有动的内容，这一帧就跳过。
       以前只要有一块玻璃下面在动，所有玻璃都跟着每帧重画。
     - 静态底图缓存：页面截图（SVG）按需栅格化，代价最大的就是这一步。缓存时四周多留一圈
       （导航 120px、放大镜 60px），小幅滚动或移动只从缓存里拷一块，出了这一圈才重新栅格化。
     - 只有内容在动（视频、跑马灯）而玻璃没动时，按 30fps 更新：跑马灯一帧才走 1.4px，
       视频本身多是 30fps，60fps 重画是浪费；滚动、拖动放大镜仍然逐帧跟上。
     - 没有动的内容就直接用缓存，不再拷一遍；不磨砂（放大镜）就不做模糊那一趟。 */
  var sceneVer = 0, liveTracks = [].slice.call(document.querySelectorAll('[data-lg-live]'));
  function overlaps(r, x0, y0, cw, ch) {
    var x = r.left + window.scrollX, y = r.top + window.scrollY;
    return r.width && !(x > x0 + cw || x + r.width < x0 || y > y0 + ch || y + r.height < y0);
  }
  function render(v, now) {
    var pane = v.pane, w = pane.offsetWidth, h = pane.offsetHeight;
    if (!scene || !w || !h || (v.active && !v.active())) return false;
    var d = window.devicePixelRatio || 1, rc = pane.getBoundingClientRect();
    // 布局尺寸取 offset*（不含悬停缩放），位置取包围盒中心（缩放以中心为原点，中心不变）
    var cx = rc.left + rc.width / 2 + window.scrollX, cy = rc.top + rc.height / 2 + window.scrollY;
    // 取样范围：玻璃（含四周余量）的 1/mag，画满整张裁切画布
    var pad = G.pad, cw = (w + 2 * pad) / v.mag, ch = (h + 2 * pad) / v.mag, x0 = cx - cw / 2, y0 = cy - ch / 2;
    var CW = Math.round((w + 2 * pad) * d), CH = Math.round((h + 2 * pad) * d), PW = Math.round(w * d), PH = Math.round(h * d);
    var k = CW / cw, frost = v.frost ? v.frost(k) : 0;

    // 先决定要不要画，再去找下面动的内容 —— 找的那一步要逐张读照片位置，比画本身还贵。
    // 玻璃没动时：上一帧下面没东西在动，这一帧也不会有（跑马灯条的高度是固定的；视频开始播放
    // 时 play 事件会让各块玻璃重新找一次）；有东西在动就按 30fps 看
    var key = [x0, y0, CW, CH, PW, PH, sceneVer, frost].join(), moved = v.at !== key;
    if (!moved && !v.rescan) {
      if (!v.anim) return false;
      if (now - v.t < 33) return true;
    }
    v.rescan = false;

    // 这一帧压在下面、正在动的内容
    var under = [];
    for (var vi = 0; vi < videos.length; vi++) {
      var vid = videos[vi];
      if (vid.readyState >= 2 && overlaps(vid.getBoundingClientRect(), x0, y0, cw, ch)) under.push(vid);
    }
    for (var ti = 0; ti < liveTracks.length; ti++) {
      var track = liveTracks[ti], tr = track.getBoundingClientRect();
      if (!overlaps(tr, x0 - 60, y0 - 60, cw + 120, ch + 120)) continue;   // 整条不沾边就不逐张看
      // 照片在条内的位置是固定的，只有整条在平移：用条的当前位置加各张的偏移粗筛（放宽 60px
      // 盖住错落的 translateY 与悬停放大），沾边的才读精确位置
      var kids = track.children, tx0 = tr.left + window.scrollX, ty0 = tr.top + window.scrollY;
      for (var li = 0; li < kids.length; li++) {
        var kid = kids[li];
        if (kid._ow == null) { kid._ox = kid.offsetLeft; kid._oy = kid.offsetTop; kid._ow = kid.offsetWidth; kid._oh = kid.offsetHeight; }
        var ax = tx0 + kid._ox, ay = ty0 + kid._oy;
        if (ax - 60 > x0 + cw || ax + kid._ow + 60 < x0 || ay - 60 > y0 + ch || ay + kid._oh + 60 < y0) continue;
        if (overlaps(kid.getBoundingClientRect(), x0, y0, cw, ch)) under.push(kid);
      }
    }
    var animating = under.some(function (el) { return el.tagName !== 'VIDEO' || !el.paused; });
    v.anim = animating;
    if (!moved && !under.length) return false;              // 重新找了一遍，什么也没有
    v.at = key;
    v.t = now;

    // 静态底图：缓存覆盖 [bx0, by0] 起、四周各多 band 的一块；当前取样范围落在里面就直接拷
    var st = v.st || (v.st = { cv: document.createElement('canvas') });
    var band = 120 / v.mag;
    if (st.ver !== sceneVer || st.k !== k || x0 < st.x0 || y0 < st.y0 ||
        x0 + cw > st.x0 + st.w || y0 + ch > st.y0 + st.h) {
      st.ver = sceneVer; st.k = k; st.x0 = x0 - band; st.y0 = y0 - band; st.w = cw + 2 * band; st.h = ch + 2 * band;
      var SW = Math.ceil(st.w * k), SH = Math.ceil(st.h * k), sc = st.cv.getContext('2d');
      if (st.cv.width !== SW || st.cv.height !== SH) { st.cv.width = SW; st.cv.height = SH; }
      sc.fillStyle = pageBg;                               // 超出页面的部分填底色
      sc.fillRect(0, 0, SW, SH);
      var sx = Math.max(st.x0, 0), sy = Math.max(st.y0, 0);
      var ex = Math.min(st.x0 + st.w, scene.W), ey = Math.min(st.y0 + st.h, scene.H);
      if (ex > sx && ey > sy) {
        sc.drawImage(scene.img, sx, sy, ex - sx, ey - sy, (sx - st.x0) * k, (sy - st.y0) * k, (ex - sx) * k, (ey - sy) * k);
      }
    }
    var ox = (x0 - st.x0) * k, oy = (y0 - st.y0) * k;

    // 合成：静态底图 + 动的内容（视频当前帧、跑马灯照片）→ raw；要磨砂再整体模糊进 crop
    var raw = v.raw, rc2 = v.r2, crop = v.crop, c = v.c2, src;
    [raw, crop].forEach(function (cv2) { if (cv2.width !== CW || cv2.height !== CH) { cv2.width = CW; cv2.height = CH; } });
    rc2.clearRect(0, 0, CW, CH);
    rc2.drawImage(st.cv, ox, oy, CW, CH, 0, 0, CW, CH);
    for (var j = 0; j < under.length; j++) {
      var el = under[j];
      if (el.tagName === 'VIDEO') {
        var vr = el.getBoundingClientRect();
        try { rc2.drawImage(el, (vr.left + window.scrollX - x0) * k, (vr.top + window.scrollY - y0) * k, vr.width * k, vr.height * k); } catch (e) {}
      } else drawLive(rc2, el, x0, y0, k, v.mag > 1);
    }
    src = raw;
    if (frost) {
      c.clearRect(0, 0, CW, CH);
      if ('filter' in c) c.filter = 'blur(' + frost + 'px)';
      c.drawImage(raw, 0, 0);
      if ('filter' in c) c.filter = 'none';
      src = crop;
    }

    var cv = v.cv, gl = v.gl, u = v.u;
    if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
    gl.viewport(0, 0, PW, PH);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch (e) { giveUp(); return false; }
    if (v.rw !== w || v.rh !== h) {                         // 圆角只在尺寸变了时重新读
      v.rw = w; v.rh = h;
      v.radius = Math.min(parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0, w / 2, h / 2);
    }
    gl.uniform1i(u.u_tex, 0);
    gl.uniform2f(u.u_size, PW, PH);
    gl.uniform2f(u.u_crop, CW, CH);
    gl.uniform1f(u.u_pad, pad * d);
    gl.uniform1f(u.u_radius, v.radius * d);
    gl.uniform1f(u.u_refract, G.refraction);
    gl.uniform1f(u.u_chroma, G.chroma);
    gl.uniform1f(u.u_edgeHL, G.edgeHL);
    gl.uniform1f(u.u_fresnel, G.fresnel);
    gl.uniform1f(u.u_zRadius, (v.zRadius || Math.min(G.zRadius, G.zRatio * Math.min(w, h))) * d);
    gl.uniform1f(u.u_alpha, 1);
    gl.uniform1f(u.u_shade, G.shade);
    gl.uniform1f(u.u_rimTop, G.rimTop);
    gl.uniform1f(u.u_rimBot, G.rimBot);
    gl.uniform1f(u.u_px, d);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return animating;
  }

  var raf = 0;
  function frame(now) {
    raf = 0;
    if (!live) return;
    var moving = loupe ? loupe.step() : false;
    views.forEach(function (v) { if (render(v, now)) moving = true; });
    if (moving) schedule();                 // 还有在动的：下一帧接着看
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  window.addEventListener('scroll', schedule, { passive: true });
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(schedule);
    views.forEach(function (v) { ro.observe(v.pane); });
  }

  /* ---------- 放大镜（相册页） ----------
     仿 macOS 预览的放大镜：一块圆形液态玻璃，里面是 2 倍放大的画面（按照片原图与页面矢量重新
     画，不是把纹理拉大，所以是清楚的）。由标题旁的开关（data-lg-loupe-toggle）打开，打开后常驻：
     鼠标 / 触控板下跟着光标走（带一点滞后，pointer-events: none 不挡点击）；
     触屏上没有光标，改为用手指拖动。每次打开页面都是关闭的，不记住上次的状态。 */
  var loupe = null;
  var loupeBtn = document.querySelector('[data-lg-loupe-toggle]');
  if (loupeBtn) loupe = makeLoupe(loupeBtn);
  function makeLoupe(btn) {
    var el = document.createElement('div');
    el.className = 'lg-loupe';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-lg-skip', '');           // 不进截图
    document.body.appendChild(el);
    var v = addView(el, { mag: G.loupeMag, zRadius: G.loupeZ, active: function () { return el.classList.contains('on'); } });
    if (!v) { el.parentNode.removeChild(el); return null; }

    var mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var enabled = false, tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, last = 0, drag = null;
    if (!mouse) el.classList.add('drag');
    try { localStorage.removeItem('lg:loupe'); } catch (e) {}   // 清掉旧版本记下的状态

    function clamp() {                              // 别让它跑到窗口外面找不回来
      var r = el.offsetWidth / 2;
      tx = Math.min(Math.max(tx, r), innerWidth - r);
      ty = Math.min(Math.max(ty, r), innerHeight - r);
    }
    /* 用独立的 translate 属性定位，而不是 transform：按规范的顺序 translate → rotate → scale →
       transform，出现动画的 scale 会把 transform 里的位移一起缩小 —— 刚打开时（scale 0.82）
       放大镜实际在目标位置的 0.82 倍处，第一帧按那个位置取样，光标不动就一直错着
       （手机上尤其明显：没有光标，打开后不动）。translate 在 scale 之外，缩放只绕自身中心。 */
    var useTranslate = 'translate' in el.style;
    function place() {
      var px = (x - el.offsetWidth / 2) + 'px', py = (y - el.offsetHeight / 2) + 'px';
      if (useTranslate) el.style.translate = px + ' ' + py;
      else el.style.transform = 'translate3d(' + px + ',' + py + ',0)';
    }
    function sync() {
      var on = enabled && live;                     // 截图就绪前不出现，免得浮着一块空玻璃
      btn.setAttribute('aria-pressed', String(enabled));
      if (on && !el.classList.contains('on')) { clamp(); x = tx; y = ty; last = 0; place(); v.at = null; }   // 出现时直接落位、重画
      el.classList.toggle('on', on);
      schedule();
    }
    btn.addEventListener('click', function () {
      enabled = !enabled;
      sync();
    });

    if (mouse) {
      document.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        tx = e.clientX; ty = e.clientY;
        if (enabled) schedule();
      }, { passive: true });
    } else {
      el.addEventListener('pointerdown', function (e) {
        drag = { id: e.pointerId, dx: e.clientX - tx, dy: e.clientY - ty };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      });
      el.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        tx = e.clientX - drag.dx; ty = e.clientY - drag.dy; clamp();
        schedule();
      });
      var end = function () { drag = null; };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
    window.addEventListener('scroll', function () { if (enabled) schedule(); }, { passive: true });
    window.addEventListener('resize', function () { clamp(); if (enabled) schedule(); });

    return {
      ready: function () { btn.hidden = false; sync(); },   // 玻璃就绪：露出开关
      // 每帧调用：朝目标位置靠近（时间常数 70ms 的指数跟随），还没跟上就返回 true 要下一帧
      step: function () {
        if (!el.classList.contains('on')) return false;
        var now = performance.now(), dt = last ? Math.min(now - last, 50) : 16;
        last = now;
        var a = still || drag ? 1 : 1 - Math.exp(-dt / 70);   // 拖动时贴着手指，不滞后
        x += (tx - x) * a; y += (ty - y) * a;
        place();
        if (Math.abs(tx - x) < .3 && Math.abs(ty - y) < .3) { last = 0; return false; }
        return true;
      }
    };
  }

  /* ---------- 什么时候重截 ---------- */

  var capTimer = 0, capturing = false, again = false;
  function recapture(delay) {
    clearTimeout(capTimer);
    capTimer = setTimeout(runCapture, delay == null ? 300 : delay);
  }
  function runCapture() {
    if (capturing) { again = true; return; }
    capturing = true;
    capturePage().then(function (cap) {
      scene = cap; sceneVer++;
      goLive();
      schedule();
    }, function () {}).then(function () {
      capturing = false;
      if (again) { again = false; recapture(); }
    });
  }

  // 首次：字体就绪、页面加载完（图片尺寸定下来）之后
  var start = function () { (document.fonts && document.fonts.ready || Promise.resolve()).then(function () { recapture(0); }); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  // 切换语言、窗口变宽变窄
  document.addEventListener('languagechange', function () { recapture(60); });
  var lastW = document.documentElement.clientWidth;
  window.addEventListener('resize', function () {
    var w = document.documentElement.clientWidth;
    if (w !== lastW) { lastW = w; recapture(); }
  });
  // 页面内容的增删改（展开 News、地图载入等）。导航自身、入场动画加的类、行内样式都不算
  new MutationObserver(function (list) {
    for (var j = 0; j < list.length; j++) {
      if (!nav.contains(list[j].target)) { recapture(); return; }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true,
                              attributes: true, attributeFilter: ['hidden', 'src', 'open'] });
  // 页面高度变化（如图片晚到、折叠展开）
  if (window.ResizeObserver) {
    var lastH = 0;
    new ResizeObserver(function () {
      var hh = document.body.scrollHeight;
      if (Math.abs(hh - lastH) > 2) { lastH = hh; if (scene) recapture(); }
    }).observe(document.body);
  }

})();
