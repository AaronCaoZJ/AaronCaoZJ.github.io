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
        var src = o.currentSrc || o.src;
        if (!src) return;
        c.removeAttribute('srcset'); c.removeAttribute('loading');
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
    // 导航不能删：它是 sticky，在文档流里占着 64px，删了下面整页内容都会上移。只让它不可见
    [].forEach.call(body.querySelectorAll('.nav'), function (n) { n.setAttribute('style', 'visibility:hidden!important'); });

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
    'uniform float u_zRadius;', 'uniform float u_alpha;',
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
    '  float fres = pow(1.0 - abs(N.z), 4.0) * u_fresnel;',
    '  float bw = 1.5;',
    '  float stroke = smoothstep(-bw - 1.0, -bw, sdf) * (1.0 - smoothstep(-1.0, 0.0, sdf));',
    '  stroke *= 0.4 + 0.6 * (0.5 + 0.5 * (-lp.y / half_.y));',
    '  float rim = edge * u_edgeHL * 0.22;',
    '  float innerGlow = smoothstep(5.0, 0.0, -sdf) * u_edgeHL * 0.15;',
    '  float envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;',
    '  vec3 fin = col + vec3(rim + innerGlow + stroke * u_edgeHL * 0.55 + envRefl);',
    '  fin = mix(fin, vec3(1.0), fres * 0.2);',
    '  gl_FragColor = vec4(fin, mask * u_alpha);',
    '}'
  ].join('\n');

  /* 参数取原库默认值（它演示里的 Regular Glass：不模糊）。
     窄屏展开的菜单卡片换成原库的磨砂模式：入口文字整片压在正文上，背景太清楚会互相打架，
     所以先把背景高斯模糊（σ，CSS px）再折射 */
  var G = { refraction: .69, zRadius: 40, chroma: .05, edgeHL: .05, fresnel: 1, pad: 20, frostOpen: 6 };

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
    ['u_tex', 'u_size', 'u_crop', 'u_pad', 'u_radius', 'u_refract', 'u_chroma', 'u_edgeHL', 'u_fresnel', 'u_zRadius', 'u_alpha']
      .forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    return { gl: gl, u: u };
  }

  /* ---------- 每块玻璃 ---------- */

  var panes = [wrap, nav.querySelector('.language-toggle')].filter(Boolean);
  var views = [];
  for (var i = 0; i < panes.length; i++) {
    var cv = document.createElement('canvas');
    cv.className = 'lg-refract';
    cv.setAttribute('aria-hidden', 'true');
    var ctx = makeGL(cv);
    if (!ctx) return;                       // 没有 WebGL：保持 CSS 模糊玻璃
    var crop = document.createElement('canvas');
    views.push({ pane: panes[i], cv: cv, gl: ctx.gl, u: ctx.u, crop: crop, c2: crop.getContext('2d') });
  }

  var scene = null, live = false, pageBg = getComputedStyle(document.body).backgroundColor;

  function goLive() {
    if (live) return;
    live = true;
    views.forEach(function (v) {
      v.pane.appendChild(v.cv);
      v.pane.style.backdropFilter = v.pane.style.webkitBackdropFilter = 'none';
    });
    nav.classList.add('lg-webgl');
  }
  function giveUp() {                       // 截图不可用（如画布被污染）：退回 CSS 模糊
    live = false; scene = null;
    views.forEach(function (v) {
      if (v.cv.parentNode) v.cv.parentNode.removeChild(v.cv);
      v.pane.style.backdropFilter = v.pane.style.webkitBackdropFilter = '';
    });
    nav.classList.remove('lg-webgl');
  }

  function render(v) {
    var pane = v.pane, w = pane.offsetWidth, h = pane.offsetHeight;
    if (!scene || !w || !h) return;
    var d = window.devicePixelRatio || 1, rc = pane.getBoundingClientRect();
    // 布局尺寸取 offset*（不含悬停缩放），位置取包围盒中心（缩放以中心为原点，中心不变）
    var cx = rc.left + rc.width / 2 + window.scrollX, cy = rc.top + rc.height / 2 + window.scrollY;
    var pad = G.pad, cw = w + 2 * pad, ch = h + 2 * pad, x0 = cx - cw / 2, y0 = cy - ch / 2;
    var CW = Math.round(cw * d), CH = Math.round(ch * d), PW = Math.round(w * d), PH = Math.round(h * d);
    // 裁切：页面这一块按屏幕分辨率画出来（SVG 是矢量，按需栅格化），超出页面的部分填底色
    var crop = v.crop, c = v.c2;
    if (crop.width !== CW || crop.height !== CH) { crop.width = CW; crop.height = CH; }
    c.fillStyle = pageBg;
    c.fillRect(0, 0, CW, CH);
    var sx = Math.max(x0, 0), sy = Math.max(y0, 0);
    var ex = Math.min(x0 + cw, scene.W), ey = Math.min(y0 + ch, scene.H);
    if (ex > sx && ey > sy) {
      var k = CW / cw;
      var frost = pane === wrap && nav.classList.contains('open') ? G.frostOpen : 0;
      if ('filter' in c) c.filter = frost ? 'blur(' + frost * k + 'px)' : 'none';
      c.drawImage(scene.img, sx, sy, ex - sx, ey - sy, (sx - x0) * k, (sy - y0) * k, (ex - sx) * k, (ey - sy) * k);
      if ('filter' in c) c.filter = 'none';
    }
    var cv = v.cv, gl = v.gl, u = v.u;
    if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
    gl.viewport(0, 0, PW, PH);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, crop);
    } catch (e) { giveUp(); return; }
    var r = parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0;
    gl.uniform1i(u.u_tex, 0);
    gl.uniform2f(u.u_size, PW, PH);
    gl.uniform2f(u.u_crop, CW, CH);
    gl.uniform1f(u.u_pad, pad * d);
    gl.uniform1f(u.u_radius, Math.min(r, w / 2, h / 2) * d);
    gl.uniform1f(u.u_refract, G.refraction);
    gl.uniform1f(u.u_chroma, G.chroma);
    gl.uniform1f(u.u_edgeHL, G.edgeHL);
    gl.uniform1f(u.u_fresnel, G.fresnel);
    gl.uniform1f(u.u_zRadius, G.zRadius * d);
    gl.uniform1f(u.u_alpha, 1);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  var raf = 0;
  function frame() { raf = 0; if (live) views.forEach(render); }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  window.addEventListener('scroll', schedule, { passive: true });
  // 菜单开合会切换磨砂，尺寸不一定变（收起的那一刻），也要重画
  new MutationObserver(schedule).observe(nav, { attributes: true, attributeFilter: ['class'] });
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(schedule);
    panes.forEach(function (p) { ro.observe(p); });
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
      scene = cap;
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
