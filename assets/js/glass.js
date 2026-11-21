/* ---------- liquid glass (WebGL) ----------
   Port of ybouane/liquidglass (github.com/ybouane/liquidglass, MIT): rasterize the page behind the
   glass, then refract it in a fragment shader with bilinear sampling. Not an SVG displacement filter:
   Chrome's feDisplacementMap samples nearest-neighbor (aliased bevels) and it is Chromium-only.
   The capture is a page clone rendered via SVG foreignObject with assets inlined as data URLs, redone
   when content changes. Without a capture or WebGL, do nothing (the loupe toggle stays hidden). */
function liquidGlass() {
  // Only the gallery loupe is glass now (the nav isn't; see `.nav` in style.css).
  // The nav is still hidden in captures, and mutations inside it are ignored.
  var nav = document.querySelector('.nav');
  var loupeBtn = document.querySelector('[data-lg-loupe-toggle]');
  if (!nav || !loupeBtn || !window.Promise || !window.fetch) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-transparency: reduce)').matches) return;

  /* ---------- capture ---------- */

  var CAPTURE_CSS =
    // Stop the nav's top margin collapsing through <body> (Safari foreignObject makes the capture taller)
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

  // Drop @font-face rules the page never loaded, so captures don't inline them. Run after document.fonts.ready.
  function dropUnusedFaces(text) {
    if (!document.fonts || !document.fonts.forEach) return text;
    var loaded = {};
    document.fonts.forEach(function (f) {
      if (f.status === 'loaded') loaded[f.family.replace(/["']/g, '') + '|' + f.style] = 1;
    });
    return text.replace(/@font-face\s*\{[^}]*\}/g, function (rule) {
      var fam = /font-family\s*:\s*["']?([^;"']+)/i.exec(rule), st = /font-style\s*:\s*(\w+)/i.exec(rule);
      if (!fam || !/url\(/.test(rule)) return rule;          // local()-only faces cost nothing
      return loaded[fam[1].trim() + '|' + (st ? st[1] : 'normal')] ? rule : '';
    });
  }

  /* All stylesheet text with url(...) inlined as data URLs; fetched once */
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
        sh.text = dropUnusedFaces(sh.text);
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

  /* The whole page as an SVG image: { img, W, H } */
  function capturePage() {
    var root = document.documentElement;
    var W = root.clientWidth, H = Math.max(root.scrollHeight, document.body.scrollHeight);
    var body = document.body.cloneNode(true), jobs = [];
    // Originals and clones match one-to-one in document order. Pin text blocks to their original height
    // so a different line wrap in the capture (late fonts, mobile font sizing) can't push everything below
    // down. Not plain block containers: a fixed height stops the last child's margin collapsing through.
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
        if (!kb) hasInline = true;                                   // inline SVG etc.: counts as inline replaced
        else if (kb.d === 'none' || kb.d === 'contents' || kb.out) continue;
        else if (kb.d.indexOf('inline') === 0) hasInline = true;
        else hasBlock = true;
      }
      // Flex/grid too: items may wrap to an extra row, and their children's margins never collapse out
      if (/flex|grid/.test(bx.d) || (hasInline && !hasBlock)) cAll[q].style.height = bx.h;
    }
    // Images, videos and canvases, matched by index
    var sel = 'img, video, canvas', oList = document.body.querySelectorAll(sel), cList = body.querySelectorAll(sel);
    for (var i = 0; i < oList.length; i++) (function (o, c) {
      if (nav.contains(o) || o.hasAttribute('data-lg-skip')) return;   // skip decorative animated canvases
      if (o.tagName === 'IMG') {
        c.removeAttribute('srcset'); c.removeAttribute('loading');
        // Pin size: on mobile the SVG may lay out before images decode, collapsing unsized <img> to 0 height
        var cs = getComputedStyle(o);
        if (cs.display !== 'none' && cs.width !== 'auto') { c.style.width = cs.width; c.style.height = cs.height; }
        o._lgBox = cs.width + ' ' + cs.height;        // a late load at this size needs no recapture
        // Live-track photos are drawn by renderGroup(); inlining them would encode the whole gallery
        if (o.closest('[data-lg-live]')) { c.removeAttribute('src'); return; }
        var src = o.currentSrc || o.src;
        if (!src) return;
        jobs.push(dataURL(src).then(function (d) { if (d) c.setAttribute('src', d); }));
        return;
      }
      // Videos/canvases: swap for a still of the current frame
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
      } catch (e) { /* frame unavailable: leave blank */ }
      c.parentNode.replaceChild(img, c);
    })(oList[i], cList[i]);
    [].forEach.call(body.querySelectorAll('script, [data-lg-skip]'), function (n) { n.parentNode.removeChild(n); });
    // Keep the sticky nav in flow (removing it shifts the page). Use opacity, not visibility: the
    // bilingual labels set visibility: visible and would leak into the capture
    [].forEach.call(body.querySelectorAll('.nav'), function (n) { n.setAttribute('style', 'opacity:0!important'); });
    // Hide [data-lg-live] photos; renderGroup() draws them
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

  /* FS_GLASS from ybouane/liquidglass, except: several panes per canvas sampling a prepared texture
     (u_at: pane in canvas, u_org: pane in texture, u_k: texels per canvas px), density-scaled pixel
     constants (dp), and added lighting. Lengths are device px. */
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
    '  vec2 lp = vec2(gl_FragCoord.x - u_at.x - half_.x, u_at.y - gl_FragCoord.y - half_.y);',   // origin at the pane center, y down
    '  float r = min(u_radius, min(half_.x, half_.y));',
    '  float sdf = rrSDF(lp, half_, r);',
    '  if (sdf > 0.5) { gl_FragColor = vec4(0.0); return; }',
    '  float mask = 1.0 - smoothstep(-1.5, 0.5, sdf);',
    '  float maxD = min(half_.x, half_.y);',
    '  float inside = -sdf;',
    '  float edge = smoothstep(maxD * 0.35, 0.0, inside);',
    '  float zR = u_zRadius;',
    // The original's pixel constants are device px (strong at 1x, faint at 3x); dp rescales them relative to 2x
    '  float dp = u_px * 0.5;',
    '  float e = 2.0 * dp;',
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
    '  vec2 refrPx = (entryRefr + entryRefr + entryRefr * thickNorm * 0.5) * u_refract * 30.0 * dp;',
    '  refrPx += -lp / max(half_, vec2(1.0)) * u_refract * 4.0 * depth * dp;',
    '  float caS = u_chroma * 18.0 * (edge * 0.7 + 0.3) * 2.0 * dp;',
    '  vec2 caD = N.xy * caS * u_k / u_tsize;',
    '  vec2 base = (u_org + (lp + half_ + refrPx) * u_k) / u_tsize;',
    '  vec3 col = vec3(texture2D(u_tex, base + caD).r, texture2D(u_tex, base).g, texture2D(u_tex, base - caD).b);',
    '  col *= 1.0 + 0.06 * depth;',
    // Added lighting, since refraction shows nothing over flat color. Light from above (-y), normal-only,
    // so refraction is untouched; N·L == L.z on flat areas, leaving them unchanged.
    '  vec3 Ld = normalize(vec3(0.0, -0.75, 1.0));',
    '  col *= 1.0 + u_shade * (dot(N, Ld) - Ld.z);',
    // Rim highlight: outer edge only, by how much the outline faces the light; inside it reads as haze
    '  vec2 outN = length(N.xy) > 1e-4 ? normalize(N.xy) : vec2(0.0);',
    '  float facing = dot(outN, vec2(0.0, -1.0));',
    '  float band = 1.0 - smoothstep(0.8 * u_px, 2.0 * u_px, inside);',   // full within 0.8px of the edge, zero at 2px
    '  float rimHL = band * (u_rimTop * pow(max(facing, 0.0), 1.5) + u_rimBot * pow(max(-facing, 0.0), 1.5));',
    '  float fres = pow(1.0 - abs(N.z), 4.0) * u_fresnel;',
    '  float bw = 1.5 * dp;',
    '  float stroke = smoothstep(-bw - 1.0, -bw, sdf) * (1.0 - smoothstep(-1.0, 0.0, sdf));',
    '  stroke *= 0.4 + 0.6 * (0.5 + 0.5 * (-lp.y / half_.y));',
    '  float rim = edge * u_edgeHL * 0.22;',
    '  float innerGlow = smoothstep(5.0 * dp, 0.0, -sdf) * u_edgeHL * 0.15;',
    '  float envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;',
    '  vec3 fin = col + vec3(rim + innerGlow + stroke * u_edgeHL * 0.55 + envRefl);',
    '  fin = mix(fin, vec3(1.0), fres * 0.2);',
    // Screen blend: lifts darks, leaves lights
    '  fin = fin + (1.0 - fin) * rimHL;',
    '  gl_FragColor = vec4(fin, mask * u_alpha);',
    '}'
  ].join('\n');

  /* Original defaults, except: zRadius 40px suits large panels, but on small panes it exceeds half the
     height and folds the backdrop into two copies, so they use zRatio of the short side; chroma 0.08
     (vs 0.05) for a more visible fringe. refraction stays 0.69 so the loupe's edge band stays narrow. */
  var G = { refraction: .69, zRadius: 40, zRatio: .32, chroma: .08, edgeHL: .05, fresnel: 1, pad: 20,
            loupeMag: 2, loupeZ: 24,
            shade: .015, rimTop: .7, rimBot: .35 };   // added lighting

  /* Frost: separable Gaussian, run only when the texture changes (canvas `filter` would run per frame; Safari lacks it) */
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
      gl.bindAttribLocation(prog, 0, 'a');                  // both programs share one vertex buffer
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);     // bilinear: the key to the effect
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    // src: upload; a, b: blur pass targets (b is the result)
    var o = { gl: gl, glass: glass, blur: blur, src: texture(), a: texture(), b: texture(), fa: gl.createFramebuffer(), fb: gl.createFramebuffer(), tw: 0, th: 0 };
    return o;
  }

  /* Upload a 2D canvas, blurred if sigma (texels) > 0; returns the texture to sample */
  function upload(g, canvas, sigma) {
    var gl = g.gl, x = g.ctx, W = canvas.width, H = canvas.height;
    gl.bindTexture(gl.TEXTURE_2D, x.src);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);      // throws if tainted; caller catches
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

  /* ---------- panes ---------- */

  /* One canvas, context and texture per group of panes: per-frame context switches stall the GPU process.
     If the only pane is the host (the loupe), the canvas fills it and scales with it; otherwise it sits
     beneath the panes. opt: mag (rendered at matching resolution, so it stays sharp), frost (blur σ in
     device px at 2x), refraction, band (backdrop margin in CSS px; `ahead` = scroll-direction side). */
  var groups = [], views = [];
  function addGroup(host, opt) {
    var cv = document.createElement('canvas');
    cv.className = 'lg-refract';
    cv.setAttribute('aria-hidden', 'true');
    var ctx = makeGL(cv);
    if (!ctx) return null;
    var raw = document.createElement('canvas'), band = document.createElement('canvas');
    var g = { host: host, cv: cv, gl: ctx.gl, ctx: ctx, views: [], mag: opt.mag || 1, frost: opt.frost || 0, band: opt.band,
              refraction: opt.refraction || G.refraction,
              raw: raw, r2: raw.getContext('2d'), st: { cv: band, c: band.getContext('2d') }, dir: 1 };
    groups.push(g);
    return g;
  }
  /* opt.zRadius: bevel depth; opt.active(): skip drawing when false */
  function addView(g, pane, opt) {
    var v = { g: g, pane: pane, zRadius: opt && opt.zRadius, active: opt && opt.active };
    g.views.push(v); views.push(v);
    return v;
  }
  var loupe = makeLoupe(loupeBtn);                          // see makeLoupe()
  if (!loupe) return;                                       // no WebGL: the loupe toggle stays hidden

  var scene = null, live = false, pageBg = getComputedStyle(document.body).backgroundColor;
  var videos = [].filter.call(document.querySelectorAll('video'), function (vd) { return !nav.contains(vd); });
  /* The loupe draws <img data-lg-hi> once decoded, so 2x isn't a stretch. Keep only the 6 most recent: the
     marquee drags the whole gallery past it, and decoded bitmaps (~7MB each) exhaust mobile memory. */
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

  /* Small bitmaps for unmagnified glass (the loupe uses sharper()). Drawing an <img> into a canvas decodes
     on the main thread (img.decode() doesn't help). createImageBitmap from an <img> does too, in Chrome and
     WebKit (3-16ms each on a Mac), so builds on load are queued: one per idle slot, none while live photos
     are animating in (the gallery's list switch loads ~20 at once, mid-entrance). drawPhoto builds on demand.
     Keyed by URL. */
  var THUMB_H = 360, thumbs = {}, thumbQ = [], thumbT = 0;
  var idle = window.requestIdleCallback ? function (f) { return requestIdleCallback(f, { timeout: 2000 }); }
                                        : function (f) { return setTimeout(f, 200); };
  function entering() {
    return liveTracks.some(function (t) {
      return t.getAttribute('data-lg-live') === 'enter' && t.getAnimations && t.getAnimations({ subtree: true }).length > 0;
    });
  }
  function queueThumb(im) { thumbQ.push(im); pumpThumbs(); }
  function pumpThumbs() {
    if (thumbT || !thumbQ.length) return;
    thumbT = idle(function (dl) {
      thumbT = 0;
      if (entering()) { thumbT = setTimeout(function () { thumbT = 0; pumpThumbs(); }, 250); return; }
      if (dl && !dl.didTimeout && dl.timeRemaining() < 8) { pumpThumbs(); return; }   // too short for a decode
      var im = thumbQ.shift();
      if (im.complete && im.naturalWidth) thumb(im);
      pumpThumbs();
    });
  }
  function thumb(im) {
    var key = im.currentSrc || im.src, t = thumbs[key];
    if (t) return t.b || null;
    t = thumbs[key] = {};
    var h = Math.min(im.naturalHeight, THUMB_H), w = Math.max(1, Math.round(im.naturalWidth * h / im.naturalHeight));
    var done = function (b) { t.b = b; refresh(); };
    if (!window.createImageBitmap) { done(im); return im; }       // old browsers: draw the <img> directly
    try {
      createImageBitmap(im, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' }).then(function (b) {
        if (b.height <= h * 1.2) return done(b);
        // Resize ignored (old Safari): downscale via canvas, free the big bitmap
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(b, 0, 0, w, h);
        if (b.close) b.close();
        done(c);
      }, function () { done(im); });
    } catch (e) { done(im); }
    return null;
  }

  /* Draw a live-track photo into a 2D canvas. x, y, w, h: page box; ox, oy: canvas origin on the page; s: scale */
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

  /* [data-lg-live] tracks: renderGroup draws their photos (marquee: live each frame; "enter": live with
     opacity; "still": baked into the backdrop), far cheaper than re-rasterizing like the original's data-dynamic. */
  /* sceneVer: new capture; liveVer: baked photos changed; layoutVer: re-measure layout */
  var sceneVer = 0, liveVer = 0, layoutVer = 0, liveTracks = [].slice.call(document.querySelectorAll('[data-lg-live]'));
  function isStill(track) { return track.getAttribute('data-lg-live') === 'still'; }
  /* Page layout position, ignoring transforms; cached per layoutVer */
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
  // A photo bitmap is ready: rescan, and redraw the backdrop if photos are baked into it
  function refresh() {
    if (liveTracks.some(isStill)) liveVer++;
    views.forEach(function (v) { v.rescan = true; });
    schedule();
  }
  // Layout changed: re-measure photos, redraw the backdrop
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
    if (loupe) loupe.ready();
  }
  function giveUp() {                       // capture unusable (e.g. tainted canvas): fall back to CSS blur
    live = false; scene = null;
    groups.forEach(function (g) { if (g.cv.parentNode) g.cv.parentNode.removeChild(g.cv); });
    views.forEach(function (v) { v.pane.style.backdropFilter = v.pane.style.webkitBackdropFilter = ''; });
  }

  /* Rendering. The cost is in the GPU process, so minimize per-frame uploads:
     - Backdrop: the capture strip under the glass plus still photos, with an opt.band margin; scrolling
       only moves the sample offset until it leaves the margin. Frosted ones are stored at half resolution.
     - Moving content (video, marquee, hover-scaling photos): copy the region, draw it live, upload.
     - Idle frames are skipped; content-only motion runs at 30fps (the marquee moves ~1.4px/frame). */
  var hot = [];                                             // still photos mid-transition: draw live
  function overlap(r, x0, y0, x1, y1) {                     // r: viewport box; x0…y1: page range
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

    // Each pane's canvas position and page sample range; bx0…by1: their union
    var list = [], bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9, key = '';
    for (i = 0; i < g.views.length; i++) {
      var v = g.views[i], pane = v.pane;
      if (v.active && !v.active()) continue;
      var ow = pane.offsetWidth, oh = pane.offsetHeight, rc = pane.getBoundingClientRect();
      if (!ow || !oh || rc.width < 1 || rc.height < 1) continue;
      // Inner canvas: layout size (CSS applies hover scale); beneath: current box
      var w = inner ? ow : rc.width, h = inner ? oh : rc.height;
      var cx = rc.left + rc.width / 2 + sX, cy = rc.top + rc.height / 2 + sY;   // scale is centered
      var cw = (w + 2 * pad) / mag, ch = (h + 2 * pad) / mag;
      if (v.rw !== ow || v.rh !== oh) {                     // re-read radius on resize only
        v.rw = ow; v.rh = oh;
        v.radius = Math.min(parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0, ow / 2, oh / 2);
      }
      // Panes fade with their own opacity
      if (!inner && (easing || v.rescan || v.alpha == null)) v.alpha = +getComputedStyle(pane).opacity;
      var it = { v: v, w: w, h: h, x0: cx - cw / 2, y0: cy - ch / 2, sc: w / ow, a: inner ? 1 : v.alpha,
                 px: inner ? 0 : rc.left - cr.left, py: inner ? 0 : rc.top - cr.top };
      list.push(it);
      bx0 = Math.min(bx0, it.x0); by0 = Math.min(by0, it.y0); bx1 = Math.max(bx1, it.x0 + cw); by1 = Math.max(by1, it.y0 + ch);
      key += [it.x0, it.y0, w, h, it.px, it.py, it.a].join() + ';';
    }
    if (!list.length) return false;
    key += [sceneVer, liveVer, d, cr ? cr.width : 0, cr ? cr.height : 0].join();

    // Cheap check before the per-photo scan: if unchanged, recheck only while animating, at 30fps
    var moved = g.at !== key, rescan = false;
    g.views.forEach(function (vv) { if (vv.rescan) { rescan = true; vv.rescan = false; } });
    if (!moved && !rescan) {
      if (!g.anim) return false;
      if (now - g.t < 33) return true;
    }

    // Live content under the glass. Still photos are baked, except for the loupe: baking its whole margin
    // would evict the few cached large images in use (see sharper)
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
      if ((bake && still) || !overlap(tr, bx0 - 60, by0 - 60, bx1 + 60, by1 + 60)) continue;   // track nowhere near
      // Photos are fixed within a moving track: coarse-filter by layout box plus track offset
      // (60px slack for stagger and hover scale) before reading exact boxes
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
      if (!he._lgRun && Math.abs(hr.width - he.offsetWidth) < .6) { hot.splice(j, 1); continue; }   // settled: matches the baked backdrop
      if (bake && he.parentNode && isStill(he.parentNode) && overlap(hr, bx0, by0, bx1, by1)) dyn.push(he);
    }
    g.anim = animating;

    // Stale if content changed or the range (plus blur radius) left it. fr: frost in CSS px;
    // half resolution only if the blur is ≥ 2.4 device px
    var fr = g.frost / 2, st = g.st, s = mag * d * (fr * d >= 2.4 ? .5 : 1), ver = sceneVer + ':' + liveVer + ':' + s;
    var guard = g.frost ? (BLUR_R + 1) / s : 0;
    var stale = st.ver !== ver || bx0 < st.x0 + guard || by0 < st.y0 + guard ||
                bx1 > st.x0 + st.w - guard || by1 > st.y0 + st.h - guard;
    if (g.lastY != null && by0 !== g.lastY) g.dir = by0 > g.lastY ? 1 : -1;
    g.lastY = by0;
    if (!moved && !dyn.length && !g.wasDyn && !stale) return false;   // rescanned, nothing to draw
    g.at = key;
    g.t = now;

    if (stale) {
      var mx = g.band.x + guard, up = (g.dir > 0 ? g.band.behind : g.band.ahead) + guard,
          dn = (g.dir > 0 ? g.band.ahead : g.band.behind) + guard;
      var SW = Math.ceil((bx1 - bx0 + 2 * mx) * s) + 1, SH = Math.ceil((by1 - by0 + up + dn) * s) + 1, sc = st.c;
      // Frosted: snap to the texel grid so redraws don't depend on the scroll path.
      // Unfrosted (loupe): no snap, so texels map 1:1 to screen pixels and text is crisp
      var snap = function (n) { return g.frost ? Math.floor(n * s) / s : n; }, nx0 = snap(bx0 - mx);
      // Only scrolled out: shift by half the margin (whole texels, no resampling) and draw just the exposed
      // strip, since a full redraw stutters. p0…p1: texel rows to draw
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
      var s0 = st.y0 + p0 / s, s1 = st.y0 + p1 / s;         // same rows, page coords
      sc.save();
      sc.beginPath(); sc.rect(0, p0, SW, p1 - p0); sc.clip();
      sc.fillStyle = pageBg;                                // beyond the page edges
      sc.fillRect(0, p0, SW, p1 - p0);
      var qx = Math.max(st.x0, 0), qy = Math.max(s0, 0);
      var ex = Math.min(st.x0 + st.w, scene.W), ey = Math.min(s1, scene.H);
      if (ex > qx && ey > qy) {
        sc.drawImage(scene.img, qx, qy, ex - qx, ey - qy, (qx - st.x0) * s, (qy - st.y0) * s, (ex - qx) * s, (ey - qy) * s);
      }
      for (j = 0; j < liveTracks.length; j++) {             // bake still photos
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

    // No live content: the whole backdrop, uploaded once per redraw; otherwise a copy with live content drawn in
    var sigma = fr * s / mag, tx0, ty0, TW, TH;
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
            // "enter" photos fade in: use their current opacity
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
    gl.uniform1f(u.u_refract, g.refraction);
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
    // Keep going while anything moves, a transition runs, or just after scroll/touch (see follow)
    if (moving || easing || now < keepUntil) schedule();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  /* Safari draws not-yet-decoded images in the SVG capture as blank and never fills them in, so redraw the
     backdrop once more after scrolling stops (without chaining); runCapture adds two more after a capture. */
  var healT = 0, healing = false;
  function heal(ms) {
    return setTimeout(function again() {
      if (performance.now() < keepUntil) { healT = setTimeout(again, 200); return; }
      healT = 0; healing = true; liveVer++;
      views.forEach(function (v) { v.rescan = true; });
      schedule();
    }, ms);
  }
  /* Still photos transition on hover and view-mode switches; those go into `hot` and are drawn live, with
     per-frame redraws only near the glass (60px slack). run/end events pair up per property, so count them;
     give up after 2s in case an end event is lost. */
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
  /* Mobile toolbars collapsing move viewport-fixed glass without a scroll event (resize comes only after),
     so keep checking for 500ms after scroll, touch or viewport changes. */
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
    views.forEach(function (v) { ro.observe(v.pane); });
  }

  /* ---------- loupe (gallery) ----------
     Round 2x lens like macOS Preview's, toggled by [data-lg-loupe-toggle]. Follows the mouse with slight lag
     (pointer-events: none keeps clicks working); dragged on touch. Always starts closed. */
  function makeLoupe(btn) {
    var el = document.createElement('div');
    el.className = 'lg-loupe';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-lg-skip', '');           // excluded from captures
    document.body.appendChild(el);
    var lg = addGroup(el, { mag: G.loupeMag, band: { x: 60 / G.loupeMag, ahead: 60 / G.loupeMag, behind: 60 / G.loupeMag } });
    if (!lg) { el.parentNode.removeChild(el); return null; }
    var v = addView(lg, el, { zRadius: G.loupeZ, active: function () { return el.classList.contains('on'); } });

    var mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var enabled = false, tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, last = 0, drag = null;
    if (!mouse) el.classList.add('drag');
    try { localStorage.removeItem('lg:loupe'); } catch (e) {}   // clear state saved by older versions

    function clamp() {                              // keep it inside the window
      var r = el.offsetWidth / 2;
      tx = Math.min(Math.max(tx, r), innerWidth - r);
      ty = Math.min(Math.max(ty, r), innerHeight - r);
    }
    /* Use `translate`, not `transform`: `scale` composes outside `transform`, so the entry scale would shrink
       a transform offset and the first frame would sample the wrong spot (stuck there on touch). */
    var useTranslate = 'translate' in el.style;
    function place() {
      var px = (x - el.offsetWidth / 2) + 'px', py = (y - el.offsetHeight / 2) + 'px';
      if (useTranslate) el.style.translate = px + ' ' + py;
      else el.style.transform = 'translate3d(' + px + ',' + py + ',0)';
    }
    function sync() {
      var on = enabled && live;                     // no empty glass before the capture
      btn.setAttribute('aria-pressed', String(enabled));
      if (on && !el.classList.contains('on')) { clamp(); x = tx; y = ty; last = 0; place(); lg.at = null; }   // jump into place, redraw
      el.classList.toggle('on', on);
      schedule();
    }
    btn.addEventListener('click', function () {
      enabled = !enabled;
      sync();
    });
    var hinted = false;
    btn.addEventListener('animationend', function (e) { if (e.target === btn) btn.classList.remove('hint'); });   // ignore the icon's own animations

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
      // Reveal the toggle; hint once (.nav-loupe.hint) ≥1s after load, after the button expands
      ready: function () {
        btn.hidden = false; sync();
        if (hinted) return;
        hinted = true;
        setTimeout(function () { if (!enabled) btn.classList.add('hint'); }, Math.max(1000 - performance.now(), 450));
      },
      // Exponential follow (τ = 70ms); true while still catching up
      step: function () {
        if (!el.classList.contains('on')) return false;
        var now = performance.now(), dt = last ? Math.min(now - last, 50) : 16;
        last = now;
        var a = still || drag ? 1 : 1 - Math.exp(-dt / 70);   // no lag while dragging
        x += (tx - x) * a; y += (ty - y) * a;
        place();
        if (Math.abs(tx - x) < .3 && Math.abs(ty - y) < .3) { last = 0; return false; }
        return true;
      }
    };
  }

  /* ---------- recapture triggers ---------- */

  var capTimer = 0, capturing = false, again = false, capWaitFrom = 0;
  function recapture(delay) {
    clearTimeout(capTimer);
    capTimer = setTimeout(runCapture, delay == null ? 300 : delay);
  }
  function runCapture() {
    if (capturing) { again = true; return; }
    /* A capture blocks the main thread enough to hitch scrolling: if one exists, wait for input to stop, up to 4s */
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

  // First capture: after fonts and page load (image sizes settled)
  var start = function () { (document.fonts && document.fonts.ready || Promise.resolve()).then(function () { recapture(0); }); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  document.addEventListener('languagechange', function () { recapture(60); });
  // Gallery marquee/list switch: draw at new positions now, recapture after
  document.addEventListener('lg:relayout', function () { remeasure(); schedule(); recapture(60); });
  // Only the set of still photos changed: redraw, no recapture
  document.addEventListener('lg:relive', function () { remeasure(); schedule(); });
  // Width changes only
  var lastW = document.documentElement.clientWidth;
  window.addEventListener('resize', function () {
    var w = document.documentElement.clientWidth;
    if (w !== lastW) { lastW = w; recapture(); }
  });
  // Content mutations, ignoring the nav, class/style changes and [data-lg-skip]
  new MutationObserver(function (list) {
    for (var j = 0; j < list.length; j++) {
      var mt = list[j].target;
      if (mt.nodeType !== 1) mt = mt.parentNode;
      if (mt && !nav.contains(mt) && !(mt.closest && mt.closest('[data-lg-skip]'))) { recapture(); return; }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true,
                              attributes: true, attributeFilter: ['hidden', 'src', 'open'] });
  // Late media can resize without changing page height (side-by-side rows), which the height observer misses
  function mediaChanged() { if (scene || capturing) recapture(); }
  document.addEventListener('load', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || nav.contains(t)) return;
    if (t.closest('[data-lg-live]')) { queueThumb(t); return; }   // live photo: just build its thumbnail, later
    // The capture fetched the pixels itself; recapture only if the box changed
    var bs = getComputedStyle(t);
    if (t._lgBox !== bs.width + ' ' + bs.height) mediaChanged();
  }, true);
  videos.forEach(function (vd) { vd.addEventListener('loadedmetadata', mediaChanged); });
  // Page height changes, including during a capture: it uses the layout from its start, and on mobile the
  // first one takes seconds while images arrive
  if (window.ResizeObserver) {
    var lastH = 0;
    new ResizeObserver(function () {
      var hh = document.body.scrollHeight;
      if (Math.abs(hh - lastH) > 2) { lastH = hh; if (scene || capturing) recapture(); }
    }).observe(document.body);
  }

}

/* Boot after entry animations: WebGL setup is synchronous and can block weak devices for hundreds of ms.
   Wait for reveal.js's rise:settled, then idle time; fall back to 4s. */
(function () {
  var started = false;
  function boot() {
    if (started) return;
    started = true;
    (window.requestIdleCallback || function (f) { return setTimeout(f, 1); })(liquidGlass, { timeout: 1000 });
  }
  if (window.__riseSettled) boot(); else document.addEventListener('rise:settled', boot);
  setTimeout(boot, 4000);
})();
