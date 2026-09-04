/* 主题色选择：只换强调色，不换明暗。
   五档都取自莫兰迪色系，保证换到哪一档都和照片、正文相处得住。

   与 reveal.js 一样同步加载于 <head>：读取存档并立刻写入 CSS 变量，
   若等到 DOMContentLoaded 再改，页面会先用默认色渲染一帧再跳色。 */
(function () {
  var KEY = 'accent-theme';
  var THEMES = [
    { id: 'mist',  name: '雾霾蓝', accent: '#4d6e8a', link: '#5c8299' },
    { id: 'olive', name: '橄榄',   accent: '#6c7d58', link: '#7b8d66' },
    { id: 'clay',  name: '赤陶',   accent: '#b0705a', link: '#bd8068' },
    { id: 'plum',  name: '藕紫',   accent: '#7b6889', link: '#8a7798' },
    { id: 'slate', name: '黛石',   accent: '#52605f', link: '#63716f' }
  ];

  function get(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }
  function apply(id) {
    var th = get(id), s = document.documentElement.style;
    s.setProperty('--accent', th.accent);
    s.setProperty('--link', th.link);
  }

  var current = 'mist';
  try { current = localStorage.getItem(KEY) || 'mist'; } catch (e) {}
  apply(current);

  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.querySelector('.nav .wrap');
    if (!wrap) return;

    var box = document.createElement('div');
    box.className = 'tint';
    var btn = document.createElement('button');
    btn.className = 'tint-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Accent colour');
    btn.title = '主题色';
    // 面板挂到 body 而非 nav 内：.nav .wrap 有 overflow-x:auto，
    // 任何溢出它的绝对定位子元素都会被裁掉
    var pop = document.createElement('div');
    pop.className = 'tint-pop';
    document.body.appendChild(pop);

    THEMES.forEach(function (th) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'tint-dot' + (th.id === current ? ' on' : '');
      d.style.background = th.accent;
      d.title = th.name;
      d.setAttribute('aria-label', th.name);
      d.addEventListener('click', function (e) {
        e.stopPropagation();
        current = th.id;
        apply(current);
        try { localStorage.setItem(KEY, current); } catch (err) {}
        [].forEach.call(pop.children, function (n) { n.classList.remove('on'); });
        d.classList.add('on');
        pop.classList.remove('open');
      });
      pop.appendChild(d);
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var r = btn.getBoundingClientRect();
      pop.style.top = (r.bottom + 12) + 'px';
      pop.style.left = (r.right - 96) + 'px';   // 右缘对齐按钮
      pop.classList.toggle('open');
    });
    document.addEventListener('click', function () { pop.classList.remove('open'); });
    window.addEventListener('scroll', function () { pop.classList.remove('open'); });

    box.appendChild(btn);
    wrap.appendChild(box);
  });
})();
