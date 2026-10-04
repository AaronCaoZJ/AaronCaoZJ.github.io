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
    // 导航的上边距不能穿出 body：真实页面里它被视口拦住，SVG 的 foreignObject 里（Safari）却会
    // 一路合并出去，整张截图比页面高出 14px
    '.lg-cap body{display:flow-root}' +
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
    // 原件与克隆按文档顺序一一对应。
    // 先把直接装着文字的块（段落、标题、列表项……）的高度照原件钉死：截图里的字未必和页面在
    // 同一处折行（字体晚一步生效、各家手机浏览器对字号的处理不同……），多折一行，它下面的内容
    // 就全低一行，一路累加，玻璃里的背景越往下滚错得越远。钉住之后，折行不同只影响那一块内部。
    // 普通的块容器不动：给它写死高度，它最后一个子元素的下边距就不再穿出去与外面合并，
    // 后面的内容反而会上移。SVG（地图）、跑马灯里的照片本来就有固定尺寸，跳过
    var oAll = document.body.querySelectorAll('*'), cAll = body.querySelectorAll('*'), boxes = new Map(), q, el;
    for (q = 0; q < oAll.length; q++) {
      el = oAll[q];
      if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || nav.contains(el) || el.closest('[data-lg-live]')) continue;
      var es = getComputedStyle(el);
      boxes.set(el, { d: es.display, h: es.height, out: es.position === 'absolute' || es.position === 'fixed' });
    }
    for (q = 0; q < oAll.length; q++) {
      var bx = boxes.get(oAll[q]);
      if (!bx || bx.d === 'none' || bx.d === 'inline' || bx.d === 'contents' || bx.d.indexOf('table') === 0) continue;
      var hasInline = false, hasBlock = false;
      for (var kid = oAll[q].firstChild; kid; kid = kid.nextSibling) {
        if (kid.nodeType === 3) { if (/\S/.test(kid.nodeValue)) hasInline = true; continue; }
        if (kid.nodeType !== 1) continue;
        var kb = boxes.get(kid);
        if (!kb) hasInline = true;                                   // 内嵌的 SVG 等：按行内替换元素算
        else if (kb.d === 'none' || kb.d === 'contents' || kb.out) continue;
        else if (kb.d.indexOf('inline') === 0) hasInline = true;
        else hasBlock = true;
      }
      // 弹性 / 网格容器也钉：里面的条目变宽了会多折一排（联系方式那排小胶囊），
      // 而它们的子元素边距本来就不往外合并，写死高度没有上面说的副作用
      if (/flex|grid/.test(bx.d) || (hasInline && !hasBlock)) cAll[q].style.height = bx.h;
    }
    // 再配对处理图片、视频、画布，最后删掉导航等
    var sel = 'img, video, canvas', oList = document.body.querySelectorAll(sel), cList = body.querySelectorAll(sel);
    for (var i = 0; i < oList.length; i++) (function (o, c) {
      if (nav.contains(o) || o.hasAttribute('data-lg-skip')) return;   // 纯装饰的动画画布（如头像的去噪动效）不截
      if (o.tagName === 'IMG') {
        c.removeAttribute('srcset'); c.removeAttribute('loading');
        // 尺寸照原件钉死。截图是一张把图片都嵌进去的 SVG：手机上它定版的那一刻，嵌着的图片
        // 往往还没解码完，没写宽高的 <img> 就按 0 高排版，下面的内容整体上移 —— 每过一张图
        // 多错一截，玻璃里的背景越往下滚错得越远
        var cs = getComputedStyle(o);
        if (cs.display !== 'none' && cs.width !== 'auto') { c.style.width = cs.width; c.style.height = cs.height; }
        o._lgBox = cs.width + ' ' + cs.height;        // 记下这次钉的尺寸：图片晚到时尺寸没变就不必重截
        // 跑马灯里的照片在截图里本来就是隐藏的（render() 每帧按实时位置画），不必内联成
        // data URL —— 否则每次截图都要把整个相册读一遍、编码进 SVG，懒加载也形同虚设
        if (o.closest('[data-lg-live]')) { c.removeAttribute('src'); return; }
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
     原库把玻璃画在整页大小的画布上，这里一张画布上画一块或几块玻璃（u_at 是这一块在画布里的位置），
     背景取自一张已经备好的纹理：u_org 是这块玻璃左上角在纹理里的位置，u_k 是每个画布像素合几个
     纹理像素，u_tsize 是纹理尺寸。
     所有长度都是物理像素（原库同样把尺寸、圆角、弯边深度乘 devicePixelRatio 传进来）。 */
  var VS = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
  var FS = [
    'precision highp float;',
    'uniform sampler2D u_tex;',
    'uniform vec2 u_size;', 'uniform vec2 u_tsize;', 'uniform vec2 u_org;', 'uniform float u_k;', 'uniform vec2 u_at;', 'uniform float u_radius;',
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
    '  vec2 lp = vec2(gl_FragCoord.x - u_at.x - half_.x, u_at.y - gl_FragCoord.y - half_.y);',   // 以这块玻璃的中心为原点、y 向下
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
    '  vec2 caD = N.xy * caS * u_k / u_tsize;',
    '  vec2 base = (u_org + (lp + half_ + refrPx) * u_k) / u_tsize;',
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
       Regular Glass 那样完全不模糊，背后的字和导航文字互相打架。
     - 色散：原库默认 0.05，这里取 0.08 —— 弯边上的彩色镶边再明显一点。 */
  var G = { refraction: .69, zRadius: 40, zRatio: .32, chroma: .08, edgeHL: .05, fresnel: 1, pad: 20,
            frost: 3.1, loupeMag: 2, loupeZ: 24,
            shade: .015, rimTop: .7, rimBot: .35 };   // 本站加的光照：弯边明暗与轮廓高光，不影响折射

  /* 磨砂：对背景纹理做一次高斯模糊（横、竖各一趟）。只在纹理换了内容时做，不是每帧 ——
     以前用 2D 画布的 filter，每帧一次，而且 Safari 不支持，导航在那边一直没有磨砂 */
  var BLUR_R = 7;
  var FS_BLUR = [
    'precision highp float;',
    'uniform sampler2D u_tex;', 'uniform vec2 u_tsize;', 'uniform vec2 u_dir;', 'uniform float u_w[' + (BLUR_R + 1) + '];',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / u_tsize;',
    '  vec4 c = texture2D(u_tex, uv) * u_w[0];',
    '  for (int i = 1; i <= ' + BLUR_R + '; i++) {',
    '    vec2 o = u_dir * float(i) / u_tsize;',
    '    c += (texture2D(u_tex, uv + o) + texture2D(u_tex, uv - o)) * u_w[i];',
    '  }',
    '  gl_FragColor = c;',
    '}'
  ].join('\n');

  function makeGL(canvas) {
    var gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    function sh(type, src) {
      var o = gl.createShader(type);
      gl.shaderSource(o, src); gl.compileShader(o);
      return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null;
    }
    function program(fsSrc, names) {
      var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      var prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'a');                  // 两个程序共用同一组顶点
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
      var u = {};
      names.forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
      return { prog: prog, u: u };
    }
    var glass = program(FS, ['u_tex', 'u_size', 'u_tsize', 'u_org', 'u_k', 'u_at', 'u_radius', 'u_refract', 'u_chroma', 'u_edgeHL',
                             'u_fresnel', 'u_zRadius', 'u_alpha', 'u_shade', 'u_rimTop', 'u_rimBot', 'u_px']);
    var blur = program(FS_BLUR, ['u_tex', 'u_tsize', 'u_dir', 'u_w']);
    if (!glass || !blur) return null;
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    function texture() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);     // 双线性：效果的关键
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    // src：上传进来的原图；a、b：模糊的两趟各画进一张（b 是最终结果）
    var o = { gl: gl, glass: glass, blur: blur, src: texture(), a: texture(), b: texture(), fa: gl.createFramebuffer(), fb: gl.createFramebuffer(), tw: 0, th: 0 };
    return o;
  }

  /* 把一张 2D 画布送进显卡，要磨砂就顺手模糊好。sigma 是纹理像素。返回玻璃该取样的那张纹理 */
  function upload(g, canvas, sigma) {
    var gl = g.gl, x = g.ctx, W = canvas.width, H = canvas.height;
    gl.bindTexture(gl.TEXTURE_2D, x.src);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);      // 画布被污染时会抛错，由调用处接住
    if (!(sigma > 0)) return x.src;
    if (x.tw !== W || x.th !== H) {
      x.tw = W; x.th = H;
      [[x.a, x.fa], [x.b, x.fb]].forEach(function (p) {
        gl.bindTexture(gl.TEXTURE_2D, p[0]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, p[1]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p[0], 0);
      });
    }
    var w = [], sum = 0, i;
    for (i = 0; i <= BLUR_R; i++) { w[i] = Math.exp(-i * i / (2 * sigma * sigma)); sum += i ? 2 * w[i] : w[i]; }
    for (i = 0; i <= BLUR_R; i++) w[i] /= sum;
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(x.blur.prog);
    gl.viewport(0, 0, W, H);
    gl.uniform1i(x.blur.u.u_tex, 0);
    gl.uniform2f(x.blur.u.u_tsize, W, H);
    gl.uniform1fv(x.blur.u.u_w, new Float32Array(w));
    [[x.src, x.fa, 1, 0], [x.a, x.fb, 0, 1]].forEach(function (p) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, p[1]);
      gl.bindTexture(gl.TEXTURE_2D, p[0]);
      gl.uniform2f(x.blur.u.u_dir, p[2], p[3]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return x.b;
  }

  /* ---------- 每块玻璃 ---------- */

  /* 一组玻璃共用一张画布、一个 WebGL 环境、一张背景纹理。导航的几块是一组：以前各有各的画布，
     显卡进程每帧要在几个环境之间来回切，光切换就占了它将近一半的时间，滚动时整页跟着掉帧。
     host：画布放进这个元素。只有一块玻璃、而且它自己就是 host 时（放大镜），画布铺满它、随它一起
     被 CSS 缩放；否则画布垫在几块玻璃下面，各块按自己当前的包围盒（含悬停缩放）画进去。
     opt.mag：放大倍数（取样范围缩小为玻璃的 1/mag，底图按相应的分辨率画 —— 放大的内容是清楚的）；
     opt.frost：背景模糊 σ（物理像素）；opt.band：底图在取样范围之外多画多宽（CSS 像素），
     ahead 是滚动方向上的那一侧。 */
  var groups = [], views = [];
  function addGroup(host, opt) {
    var cv = document.createElement('canvas');
    cv.className = 'lg-refract';
    cv.setAttribute('aria-hidden', 'true');
    var ctx = makeGL(cv);
    if (!ctx) return null;
    var raw = document.createElement('canvas'), band = document.createElement('canvas');
    var g = { host: host, cv: cv, gl: ctx.gl, ctx: ctx, views: [], mag: opt.mag || 1, frost: opt.frost || 0, band: opt.band,
              raw: raw, r2: raw.getContext('2d'), st: { cv: band, c: band.getContext('2d') }, dir: 1 };
    groups.push(g);
    return g;
  }
  /* opt.zRadius：弯边深度；opt.active()：false 时不画 */
  function addView(g, pane, opt) {
    var v = { g: g, pane: pane, zRadius: opt && opt.zRadius, active: opt && opt.active };
    g.views.push(v); views.push(v);
    return v;
  }
  // 导航的两块，加上页面里标了 data-lg-pane 的（相册页导航里的放大镜开关）
  var panes = [wrap, nav.querySelector('.language-toggle')].filter(Boolean)
    .concat([].slice.call(document.querySelectorAll('[data-lg-pane]')));
  var navGroup = addGroup(nav, { frost: G.frost, band: { x: 8, ahead: 900, behind: 300 } });
  if (!navGroup) return;                                    // 没有 WebGL：保持 CSS 模糊玻璃
  panes.forEach(function (p) { addView(navGroup, p); });

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
      var ok = function () { if (hiImgs[url] === h) { h._ok = true; refresh(); } };
      if (h.decode) h.decode().then(ok, function () { if (h.naturalWidth) ok(); });
      else h.onload = ok;
      if (hiOrder.length > 6) delete hiImgs[hiOrder.shift()];
    }
    return h._ok ? h : im;
  }

  /* 导航玻璃里画照片用的小图。直接把 <img> 画进画布的话，浏览器要在主线程上解码整张图
     （一张十几到几十毫秒，img.decode() 预解码对画布无效）：相册的列表模式里，每滚过一行就有
     三张新照片经过导航，滚动跟着一顿一顿。所以照片一加载完，就在后台给它做一张缩小的位图
     （createImageBitmap 的解码不占主线程），玻璃里画这张 —— 导航玻璃带磨砂，用不着原图的
     分辨率，每帧画起来也更省。按图片地址存，原件和循环用的副本共用一张；
     做好之前这一格只画底色。放大镜不走这里，它要的是大图（sharper） */
  var THUMB_H = 360, thumbs = {};
  function thumb(im) {
    var key = im.currentSrc || im.src, t = thumbs[key];
    if (t) return t.b || null;
    t = thumbs[key] = {};
    var h = Math.min(im.naturalHeight, THUMB_H), w = Math.max(1, Math.round(im.naturalWidth * h / im.naturalHeight));
    var done = function (b) { t.b = b; refresh(); };
    if (!window.createImageBitmap) { done(im); return im; }       // 老浏览器：照旧直接画 <img>
    try {
      createImageBitmap(im, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' }).then(function (b) {
        if (b.height <= h * 1.2) return done(b);
        // 没理会缩放参数（旧版 Safari）：位图已经解码好了，再画进小画布很便宜；原尺寸的那张随即释放
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(b, 0, 0, w, h);
        if (b.close) b.close();
        done(c);
      }, function () { done(im); });
    } catch (e) { done(im); }
    return null;
  }

  /* 把一张照片（跑马灯 / 列表里的 <figure>）画进 2D 画布：圆角、底色、图片。
     x、y、w、h 是它在页面上的位置（CSS 像素），ox、oy 是画布左上角对应的页面位置，s 是画布的分辨率 */
  function drawPhoto(c, el, x, y, w, h, ox, oy, s, hi) {
    if (!el._lg) {
      var cs = getComputedStyle(el);
      el._lg = { r: parseFloat(cs.borderTopLeftRadius) || 0, bg: cs.backgroundColor, img: el.querySelector('img') };
    }
    var X = (x - ox) * s, Y = (y - oy) * s, W = w * s, H = h * s;
    c.save();
    c.beginPath();
    if (c.roundRect) c.roundRect(X, Y, W, H, el._lg.r * s);
    else c.rect(X, Y, W, H);
    c.clip();
    c.fillStyle = el._lg.bg;
    c.fillRect(X, Y, W, H);
    var im = el._lg.img;
    var pic = im && im.complete && im.naturalWidth ? (hi ? sharper(im) : thumb(im)) : null;
    if (pic) c.drawImage(pic, X, Y, W, H);
    c.restore();
  }
  videos.forEach(function (vd) {
    vd.addEventListener('play', function () { views.forEach(function (v) { v.rescan = true; }); schedule(); });
  });

  /* sceneVer：页面截图换了；liveVer：烘进底图的照片变了（排版变了、照片的小图备好了）；
     layoutVer：元素的排版位置要重新量 */
  var sceneVer = 0, liveVer = 0, layoutVer = 0, liveTracks = [].slice.call(document.querySelectorAll('[data-lg-live]'));
  function isStill(track) { return track.getAttribute('data-lg-live') === 'still'; }
  /* 元素在页面上的排版位置（不含 transform：跑马灯的平移、入场动画、悬停放大都不算）。量一次记着 */
  function layoutBox(el) {
    if (el._lv !== layoutVer) {
      var x = 0, y = 0, n = el;
      while (n) {
        x += n.offsetLeft; y += n.offsetTop;
        n = n.offsetParent;
        if (n) { x += n.clientLeft; y += n.clientTop; }
      }
      el._lv = layoutVer; el._lx = x; el._ly = y; el._lw = el.offsetWidth; el._lh = el.offsetHeight;
    }
    return el;
  }
  // 照片的图备好了：各块玻璃重新看一遍；有烘在底图里的照片（列表模式），底图也要重画
  function refresh() {
    if (liveTracks.some(isStill)) liveVer++;
    views.forEach(function (v) { v.rescan = true; });
    schedule();
  }
  // 窗口尺寸、排版变了：照片的位置重新量，底图重画
  function remeasure() {
    layoutVer++; liveVer++;
    views.forEach(function (v) { v.rescan = true; });
  }
  window.addEventListener('resize', remeasure);

  function goLive() {
    if (live) return;
    live = true;
    groups.forEach(function (g) { g.host.insertBefore(g.cv, g.host.firstChild); });
    views.forEach(function (v) { v.pane.style.backdropFilter = v.pane.style.webkitBackdropFilter = 'none'; });
    nav.classList.add('lg-webgl');
    if (loupe) loupe.ready();
  }
  function giveUp() {                       // 截图不可用（如画布被污染）：退回 CSS 模糊
    live = false; scene = null;
    groups.forEach(function (g) { if (g.cv.parentNode) g.cv.parentNode.removeChild(g.cv); });
    views.forEach(function (v) { v.pane.style.backdropFilter = v.pane.style.webkitBackdropFilter = ''; });
    nav.classList.remove('lg-webgl');
  }

  /* 渲染。玻璃拖慢滚动，慢的不是脚本，是显卡进程：每帧往显卡送的东西越少越好。
     - 底图：页面截图（SVG）里玻璃下面那一条，连同列表模式下不动的照片，栅格化成一张 2D 画布，
       上传成纹理、在显卡里模糊好。它比玻璃的取样范围大一圈，滚动方向上多留得最多（导航 900px）。
       滚动时每帧只改着色器里取样的位置，不拷贝、不模糊、不上传；滚出这一圈才往前补画一条。
       带磨砂的玻璃，底图只按一半分辨率存：反正要模糊，看不出差别，像素少四分之三。
     - 压在下面、正在动的内容（在播的视频、跑马灯的照片、正在悬停放大的照片）没法预先备好：
       这样的帧把底图里对应的一块拷出来，把它们按实时位置画上去，再上传、模糊。
     - 玻璃没动、下面也没有在动的内容，这一帧就不画；只有内容在动时按 30fps 画：跑马灯一帧才走
       1.4px，视频本身多是 30fps；滚动、拖动放大镜仍然逐帧跟上。 */
  var hot = [];                                             // 列表模式下正在过渡 / 悬停放大的照片：与底图里烘的不一样，要实时画
  function overlap(r, x0, y0, x1, y1) {                     // r：视口坐标的包围盒；其余：页面坐标的范围
    var x = r.left + window.scrollX, y = r.top + window.scrollY;
    return r.width && !(x > x1 || x + r.width < x0 || y > y1 || y + r.height < y0);
  }
  function renderGroup(g, now) {
    if (!scene) return false;
    var gl = g.gl, cv = g.cv, d = window.devicePixelRatio || 1, pad = G.pad, mag = g.mag;
    var sX = window.scrollX, sY = window.scrollY, i, j;
    var inner = g.views.length === 1 && g.views[0].pane === g.host;
    var cr = inner ? null : cv.getBoundingClientRect();
    if (cr && (!cr.width || !cr.height)) return false;

    // 各块玻璃在画布里的位置、在页面上的取样范围；bx0…by1 是整组取样范围的并集
    var list = [], bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9, key = '';
    for (i = 0; i < g.views.length; i++) {
      var v = g.views[i], pane = v.pane;
      if (v.active && !v.active()) continue;
      var ow = pane.offsetWidth, oh = pane.offsetHeight, rc = pane.getBoundingClientRect();
      if (!ow || !oh || rc.width < 1 || rc.height < 1) continue;
      // 画布铺在玻璃里面：用布局尺寸（悬停缩放由 CSS 作用在画布上）；垫在下面：用当前的包围盒
      var w = inner ? ow : rc.width, h = inner ? oh : rc.height;
      var cx = rc.left + rc.width / 2 + sX, cy = rc.top + rc.height / 2 + sY;   // 缩放以中心为原点，中心不变
      var cw = (w + 2 * pad) / mag, ch = (h + 2 * pad) / mag;
      if (v.rw !== ow || v.rh !== oh) {                     // 圆角只在尺寸变了时重新读
        v.rw = ow; v.rh = oh;
        v.radius = Math.min(parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0, ow / 2, oh / 2);
      }
      // 正在展开 / 收起的那块（相册页的放大镜开关）跟着自己的透明度淡入淡出
      if (!inner && (easing || v.rescan || v.alpha == null)) v.alpha = +getComputedStyle(pane).opacity;
      var it = { v: v, w: w, h: h, x0: cx - cw / 2, y0: cy - ch / 2, sc: w / ow, a: inner ? 1 : v.alpha,
                 px: inner ? 0 : rc.left - cr.left, py: inner ? 0 : rc.top - cr.top };
      list.push(it);
      bx0 = Math.min(bx0, it.x0); by0 = Math.min(by0, it.y0); bx1 = Math.max(bx1, it.x0 + cw); by1 = Math.max(by1, it.y0 + ch);
      key += [it.x0, it.y0, w, h, it.px, it.py, it.a].join() + ';';
    }
    if (!list.length) return false;
    key += [sceneVer, liveVer, d, cr ? cr.width : 0, cr ? cr.height : 0].join();

    // 先决定要不要画，再去找下面动的内容 —— 找的那一步要逐张读照片位置。
    // 玻璃没动、也没人要求重看：上一帧下面没东西在动，这一帧也不会有；有就按 30fps 看
    var moved = g.at !== key, rescan = false;
    g.views.forEach(function (vv) { if (vv.rescan) { rescan = true; vv.rescan = false; } });
    if (!moved && !rescan) {
      if (!g.anim) return false;
      if (now - g.t < 33) return true;
    }

    // 这一帧压在下面、要实时画的内容。不动的照片（列表模式）烘在底图里，不算 —— 放大镜除外：它要的是
    // 大图，而大图只留最近几张（见 sharper），烘一整圈会把正用着的挤掉；它仍旧只画镜片下面那几张
    var dyn = [], animating = false, bake = mag === 1;
    for (j = 0; j < videos.length; j++) {
      var vid = videos[j];
      if (vid.readyState >= 2 && overlap(vid.getBoundingClientRect(), bx0, by0, bx1, by1)) {
        dyn.push(vid);
        if (!vid.paused) animating = true;
      }
    }
    for (j = 0; j < liveTracks.length; j++) {
      var track = liveTracks[j], tr = track.getBoundingClientRect();
      var still = isStill(track);
      if ((bake && still) || !overlap(tr, bx0 - 60, by0 - 60, bx1 + 60, by1 + 60)) continue;   // 整条不沾边就不逐张看
      // 照片在条内的位置是固定的，只有整条在平移：用各张的排版位置加上整条的位移粗筛（放宽 60px
      // 盖住错落的 translateY 与悬停放大），沾边的才读精确位置
      layoutBox(track);
      var shx = tr.left + sX - track._lx, shy = tr.top + sY - track._ly, kids = track.children;
      for (var li = 0; li < kids.length; li++) {
        var kid = layoutBox(kids[li]);
        if (!kid._lw) continue;
        var ax = kid._lx + shx, ay = kid._ly + shy;
        if (ax - 60 > bx1 || ax + kid._lw + 60 < bx0 || ay - 60 > by1 || ay + kid._lh + 60 < by0) continue;
        if (overlap(kid.getBoundingClientRect(), bx0, by0, bx1, by1)) { dyn.push(kid); if (!still) animating = true; }
      }
    }
    for (j = hot.length - 1; j >= 0; j--) {
      var he = hot[j], hr = he.getBoundingClientRect();
      if (!he._lgRun && Math.abs(hr.width - he.offsetWidth) < .6) { hot.splice(j, 1); continue; }   // 过渡走完、也没在放大：回到底图里那样了
      if (bake && he.parentNode && isStill(he.parentNode) && overlap(hr, bx0, by0, bx1, by1)) dyn.push(he);
    }
    g.anim = animating;

    // 底图还够不够用：内容没变，取样范围（模糊时再留出模糊半径）也还在里面
    var st = g.st, s = mag * d * (g.frost >= 2 ? .5 : 1), ver = sceneVer + ':' + liveVer + ':' + s;
    var guard = g.frost ? (BLUR_R + 1) / s : 0;
    var stale = st.ver !== ver || bx0 < st.x0 + guard || by0 < st.y0 + guard ||
                bx1 > st.x0 + st.w - guard || by1 > st.y0 + st.h - guard;
    if (g.lastY != null && by0 !== g.lastY) g.dir = by0 > g.lastY ? 1 : -1;
    g.lastY = by0;
    if (!moved && !dyn.length && !g.wasDyn && !stale) return false;   // 重新看了一遍，没什么要画的
    g.at = key;
    g.t = now;

    if (stale) {
      var mx = g.band.x + guard, up = (g.dir > 0 ? g.band.behind : g.band.ahead) + guard,
          dn = (g.dir > 0 ? g.band.ahead : g.band.behind) + guard;
      var SW = Math.ceil((bx1 - bx0 + 2 * mx) * s) + 1, SH = Math.ceil((by1 - by0 + up + dn) * s) + 1, sc = st.c;
      // 带磨砂的（半分辨率）：左上角对齐到纹理像素的整数格，每次重画都落在同一套格子上，结果与怎么
      // 滚过来的无关。不磨砂的（放大镜）照取样范围原样起算：刚画好时一个纹理像素正对一个屏幕像素，字是利的
      var snap = function (n) { return g.frost ? Math.floor(n * s) / s : n; }, nx0 = snap(bx0 - mx);
      // 只是滚出去了（内容、宽度都没变）：整张往滚动方向挪半圈，还用得上的部分原样留着，只补画新露出来
      // 的那一条 —— 整张重画一次要十几毫秒（手机上更久），玻璃会顿一下；分成小条就不觉得了。
      // 挪的距离取整到纹理像素，留下的部分不必重新取样。p0…p1 是要画的那几行（纹理像素）
      var step = Math.round(g.band.ahead / 2 * s) * (by1 > st.y0 + st.h - guard ? 1 : -1), ny = st.y0 + step / s, p0 = 0, p1 = SH;
      if (st.ver === ver && st.cv.width === SW && st.cv.height === SH && st.x0 === nx0 &&
          by0 >= ny + guard && by1 <= ny + st.h - guard) {
        sc.globalCompositeOperation = 'copy';
        sc.drawImage(st.cv, 0, -step);
        sc.globalCompositeOperation = 'source-over';
        st.y0 = ny;
        if (step > 0) p0 = SH - step; else p1 = -step;
      } else {
        st.ver = ver; st.x0 = nx0; st.y0 = snap(by0 - up); st.w = SW / s; st.h = SH / s;
        if (st.cv.width !== SW || st.cv.height !== SH) { st.cv.width = SW; st.cv.height = SH; }
      }
      var s0 = st.y0 + p0 / s, s1 = st.y0 + p1 / s;         // 同一段，页面坐标
      sc.save();
      sc.beginPath(); sc.rect(0, p0, SW, p1 - p0); sc.clip();
      sc.fillStyle = pageBg;                                // 超出页面的部分填底色
      sc.fillRect(0, p0, SW, p1 - p0);
      var qx = Math.max(st.x0, 0), qy = Math.max(s0, 0);
      var ex = Math.min(st.x0 + st.w, scene.W), ey = Math.min(s1, scene.H);
      if (ex > qx && ey > qy) {
        sc.drawImage(scene.img, qx, qy, ex - qx, ey - qy, (qx - st.x0) * s, (qy - st.y0) * s, (ex - qx) * s, (ey - qy) * s);
      }
      for (j = 0; j < liveTracks.length; j++) {             // 不动的照片（列表模式）按排版位置烘进来
        if (!bake || !isStill(liveTracks[j])) continue;
        var ks = liveTracks[j].children;
        for (var q = 0; q < ks.length; q++) {
          var kk = layoutBox(ks[q]);
          if (!kk._lw || kk._lx > st.x0 + st.w || kk._lx + kk._lw < st.x0 || kk._ly > s1 || kk._ly + kk._lh < s0) continue;
          drawPhoto(sc, kk, kk._lx, kk._ly, kk._lw, kk._lh, st.x0, st.y0, s, mag > 1);
        }
      }
      sc.restore();
      st.up = false;
      if (!healing && !healT) healT = heal(400);
    }

    // 纹理：没有实时内容就用整张底图（只在它重画后上传一次）；有就拷出取样范围、把实时内容画上去再上传
    var sigma = g.frost * s / (d * mag), tx0, ty0, TW, TH;
    try {
      if (dyn.length) {
        TW = Math.max(1, Math.ceil((bx1 - bx0) * s)); TH = Math.max(1, Math.ceil((by1 - by0) * s));
        var raw = g.raw, r2 = g.r2;
        if (raw.width !== TW || raw.height !== TH) { raw.width = TW; raw.height = TH; }
        r2.drawImage(st.cv, (bx0 - st.x0) * s, (by0 - st.y0) * s, TW, TH, 0, 0, TW, TH);
        for (j = 0; j < dyn.length; j++) {
          var el = dyn[j], er = el.getBoundingClientRect();
          if (el.tagName === 'VIDEO') {
            try { r2.drawImage(el, (er.left + sX - bx0) * s, (er.top + sY - by0) * s, er.width * s, er.height * s); } catch (e) {}
          } else {
            // 正在进场的照片（相册列表，轨道标着 enter）是淡入的：照它此刻的透明度画，还没露面的不画
            var al = el.parentNode.getAttribute('data-lg-live') === 'enter' ? +getComputedStyle(el).opacity : 1;
            if (al < .02) continue;
            r2.globalAlpha = al;
            drawPhoto(r2, el, er.left + sX, er.top + sY, er.width, er.height, bx0, by0, s, mag > 1);
            r2.globalAlpha = 1;
          }
        }
        g.tex = upload(g, raw, sigma);
        st.up = false; tx0 = bx0; ty0 = by0;
      } else {
        if (!st.up) { g.tex = upload(g, st.cv, sigma); st.up = true; }
        tx0 = st.x0; ty0 = st.y0; TW = st.cv.width; TH = st.cv.height;
      }
    } catch (e2) { giveUp(); return false; }
    g.wasDyn = dyn.length > 0;

    // 画：整张画布清掉，每块玻璃在自己的位置画一次
    var PW = Math.round((inner ? list[0].w : cr.width) * d), PH = Math.round((inner ? list[0].h : cr.height) * d);
    if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
    var fx = PW / (inner ? list[0].w : cr.width), fy = PH / (inner ? list[0].h : cr.height), u = g.ctx.glass.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, PW, PH);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(g.ctx.glass.prog);
    gl.bindTexture(gl.TEXTURE_2D, g.tex);
    gl.uniform1i(u.u_tex, 0);
    gl.uniform2f(u.u_tsize, TW, TH);
    gl.uniform1f(u.u_k, s / (fx * mag));
    gl.uniform1f(u.u_refract, G.refraction);
    gl.uniform1f(u.u_chroma, G.chroma);
    gl.uniform1f(u.u_edgeHL, G.edgeHL);
    gl.uniform1f(u.u_fresnel, G.fresnel);
    gl.uniform1f(u.u_shade, G.shade);
    gl.uniform1f(u.u_rimTop, G.rimTop);
    gl.uniform1f(u.u_rimBot, G.rimBot);
    gl.uniform1f(u.u_px, fx);
    gl.enable(gl.SCISSOR_TEST);
    for (i = 0; i < list.length; i++) {
      var t = list[i], X = t.px * fx, Y = t.py * fy, W2 = t.w * fx, H2 = t.h * fy;
      gl.scissor(Math.floor(X) - 1, PH - Math.ceil(Y + H2) - 1, Math.ceil(W2) + 3, Math.ceil(H2) + 3);
      gl.uniform2f(u.u_size, W2, H2);
      gl.uniform2f(u.u_at, X, PH - Y);
      gl.uniform2f(u.u_org, (t.x0 + pad / mag - tx0) * s, (t.y0 + pad / mag - ty0) * s);
      gl.uniform1f(u.u_radius, t.v.radius * t.sc * fx);
      gl.uniform1f(u.u_zRadius, (t.v.zRadius || Math.min(G.zRadius, G.zRatio * Math.min(t.w, t.h))) * fx);
      gl.uniform1f(u.u_alpha, t.a);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return animating;
  }

  var raf = 0, keepUntil = 0, easing = 0, easeCap = 0;
  function frame(now) {
    raf = 0;
    if (!live) return;
    if (easing && now > easeCap) { easing = 0; hot.forEach(function (el) { el._lgRun = 0; }); }
    if (easing) views.forEach(function (v) { v.rescan = true; });
    var moving = loupe ? loupe.step() : false;
    groups.forEach(function (g) { if (renderGroup(g, now)) moving = true; });
    healing = false;
    // 还有在动的、有过渡没走完、或刚滚动 / 触摸过（见 follow）：下一帧接着看
    if (moving || easing || now < keepUntil) schedule();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  /* 底图画好以后会用很久。Safari 把截图（SVG）画进画布时，嵌在里面的图片要是还没载入、解码完，那一处就是
     空的，等它好了也不会自己补上 —— 玻璃下的图片就「透不出来」。所以每次画过底图，等滚动停下来再整张
     重画一次（这一次不再触发下一次）；刚截完图时图片最容易没到齐，runCapture 那边再多补两次 */
  var healT = 0, healing = false;
  function heal(ms) {
    return setTimeout(function again() {
      if (performance.now() < keepUntil) { healT = setTimeout(again, 200); return; }
      healT = 0; healing = true; liveVer++;
      views.forEach(function (v) { v.rescan = true; });
      schedule();
    }, ms);
  }
  /* 不动的照片（相册的列表模式）烘在底图里，玻璃不逐帧重画。但照片悬停（触屏上是点一下）会在原位
     放大，切换显示模式时也要挪一下位置，都带一小段过渡 —— 这样的照片记进 hot，改为实时画，
     过渡期间逐帧重画，玻璃里的照片跟着变。逐帧重画只管挨着玻璃的照片（放宽 60px，盖住放大与错落
     的位移），别处的照片悬停不必重画。过渡事件每个属性各发一次，开始与结束（或取消）成对，数着就
     知道还有没有在走的；结束时不论远近都再看一次收尾。万一漏了结束事件，2 秒后不再等。
     导航里的玻璃自己也会变（圆钮悬停放大、放大镜开关展开 / 收起），同样在过渡期间逐帧重画 */
  function nearGlass(el) {
    var r = el.getBoundingClientRect(), m = 60;
    return views.some(function (v) {
      if (v.active && !v.active()) return false;
      var p = v.pane.getBoundingClientRect();
      return r.width && !(r.left - m > p.right || r.right + m < p.left || r.top - m > p.bottom || r.bottom + m < p.top);
    });
  }
  function easeStart(el) {
    el._lgEase = (el._lgEase || 0) + 1;
    easing++; easeCap = performance.now() + 2000;
    schedule();
  }
  function easeEnd(el) {
    if (el._lgEase) { el._lgEase--; if (easing) easing--; }
    views.forEach(function (v) { v.rescan = true; });
    schedule();
  }
  liveTracks.forEach(function (t) {
    t.addEventListener('transitionrun', function (e) {
      var el = e.target;
      if (el.parentNode !== t) return;
      el._lgRun = (el._lgRun || 0) + 1;
      if (hot.indexOf(el) < 0) hot.push(el);
      if (nearGlass(el)) easeStart(el);
    });
    ['transitionend', 'transitioncancel'].forEach(function (n) {
      t.addEventListener(n, function (e) {
        var el = e.target;
        if (el.parentNode !== t) return;
        if (el._lgRun) el._lgRun--;
        easeEnd(el);
      });
    });
  });
  nav.addEventListener('transitionrun', function (e) { if (panes.indexOf(e.target) >= 0) easeStart(e.target); });
  ['transitionend', 'transitioncancel'].forEach(function (n) {
    nav.addEventListener(n, function (e) { if (panes.indexOf(e.target) >= 0) easeEnd(e.target); });
  });
  /* 手机上地址栏 / 工具栏随滚动收起、展开时，固定在视口里的玻璃（如贴着底边的按钮、放大镜）会跟着视口
     挪位置，页面却没有滚动、也不发 scroll 事件，收放完才来一个 resize —— 玻璃里的背景停在旧位置，
     等下一次滚动才突然跳过去。所以滚动、触摸、视口变化之后再连着看半秒：位置没变的帧只是读一下
     包围盒、不重画；视口一变也马上重画，不等下一次滚动 */
  function follow() { keepUntil = performance.now() + 500; schedule(); }
  window.addEventListener('scroll', follow, { passive: true });
  window.addEventListener('touchmove', follow, { passive: true });
  window.addEventListener('touchend', follow, { passive: true });
  window.addEventListener('resize', follow);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', follow);
    window.visualViewport.addEventListener('scroll', follow);
  }
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(schedule);
    ro.observe(nav);
    views.forEach(function (v) { ro.observe(v.pane); });
  }

  /* ---------- 放大镜（相册页） ----------
     仿 macOS 预览的放大镜：一块圆形液态玻璃，里面是 2 倍放大的画面（按照片原图与页面矢量重新
     画，不是把纹理拉大，所以是清楚的）。由导航里的开关（data-lg-loupe-toggle）打开，打开后常驻：
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
    var lg = addGroup(el, { mag: G.loupeMag, band: { x: 60 / G.loupeMag, ahead: 60 / G.loupeMag, behind: 60 / G.loupeMag } });
    if (!lg) { el.parentNode.removeChild(el); return null; }
    var v = addView(lg, el, { zRadius: G.loupeZ, active: function () { return el.classList.contains('on'); } });

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
      if (on && !el.classList.contains('on')) { clamp(); x = tx; y = ty; last = 0; place(); lg.at = null; }   // 出现时直接落位、重画
      el.classList.toggle('on', on);
      schedule();
    }
    btn.addEventListener('click', function () {
      enabled = !enabled;
      sync();
    });
    var hinted = false;
    btn.addEventListener('animationend', function () { btn.classList.remove('hint'); });

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
      // 玻璃就绪：露出开关。再提示一下这里有个放大镜 —— 打开页面满 1 秒后（至少等圆钮展开完），
      // 外圈像呼吸灯那样亮暗两次（样式见 .nav-loupe.hint），只做这一次；已经点开了就不必提示
      ready: function () {
        btn.hidden = false; sync();
        if (hinted) return;
        hinted = true;
        setTimeout(function () { if (!enabled) btn.classList.add('hint'); }, Math.max(1000 - performance.now(), 450));
      },
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

  var capTimer = 0, capturing = false, again = false, capWaitFrom = 0;
  function recapture(delay) {
    clearTimeout(capTimer);
    capTimer = setTimeout(runCapture, delay == null ? 300 : delay);
  }
  function runCapture() {
    if (capturing) { again = true; return; }
    /* 一次截图连同它的首次绘制要占住主线程一两百毫秒（手机上更久），正在滚动、触摸时做，页面会顿一下。
       已经有一张截图可用的话，等手停下来再截（keepUntil 由 follow 在每次滚动 / 触摸时往后推）；
       最多等 4 秒，免得一直滚就一直不更新 */
    var now = performance.now();
    if (scene && now < keepUntil && now - (capWaitFrom || (capWaitFrom = now)) < 4000) {
      capTimer = setTimeout(runCapture, 200);
      return;
    }
    capWaitFrom = 0;
    capturing = true;
    capturePage().then(function (cap) {
      scene = cap; sceneVer++; layoutVer++;
      goLive();
      schedule();
      [1500, 4000].forEach(function (ms) { setTimeout(function () { if (scene === cap && !healT) healT = heal(0); }, ms); });
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
  // 页面自己换了排版（相册切换滚动 / 列表）：照片位置重新量、先按新位置画，背景随后重截
  document.addEventListener('lg:relayout', function () { remeasure(); schedule(); recapture(60); });
  // 排版没变，只是哪些照片算「不动的」变了（相册列表的进场动画落完）：照片位置重新量、底图重画，不必重截
  document.addEventListener('lg:relive', function () { remeasure(); schedule(); });
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
  // 图片、视频晚到：自身尺寸变了，页面总高却不一定变（并排布局里行高由旁边的文字决定，
  // 比如论文卡片的视频从封面换成画面），下面按总高判断的那条察觉不到。跑马灯里的照片是实时画的，不算
  function mediaChanged() { if (scene || capturing) recapture(); }
  document.addEventListener('load', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || nav.contains(t)) return;
    if (t.closest('[data-lg-live]')) { thumb(t); return; }   // 实时画的照片：后台备好小图，好了会重画
    // 写了宽高属性的图片，加载前后占的位置一样，截图里也早就有它的像素（截图自己去读了图片文件），
    // 不必为它重截；尺寸真变了的才重截
    var bs = getComputedStyle(t);
    if (t._lgBox !== bs.width + ' ' + bs.height) mediaChanged();
  }, true);
  videos.forEach(function (vd) { vd.addEventListener('loadedmetadata', mediaChanged); });
  // 页面高度变化（如图片晚到、折叠展开）。正在截的时候长高也要算：截图用的是开始那一刻的排版，
  // 手机上第一次截图要好几秒，图片恰好在这期间陆续到齐 —— 漏掉的话那张旧截图会一直用下去，
  // 玻璃里的背景越往下滚错得越远。（还没开始截时不必管，首次截图自己会来）
  if (window.ResizeObserver) {
    var lastH = 0;
    new ResizeObserver(function () {
      var hh = document.body.scrollHeight;
      if (Math.abs(hh - lastH) > 2) { lastH = hh; if (scene || capturing) recapture(); }
    }).observe(document.body);
  }

})();
