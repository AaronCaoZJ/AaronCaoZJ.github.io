/* GitHub star 数。给链接加 data-gh-stars="owner/name"，这里去同源的
   /api/stars 取数（由 Cloudflare Worker 代理并缓存一小时），拿到后在链接
   文字后面追加 "★ 127"。

   取不到 —— 本地预览没有 Worker、接口挂了、仓库不在白名单 —— 就什么都
   不做，链接保持原样。宁可不显示，也不要出现空星号或 "★ NaN"。 */
(function () {
  var links = document.querySelectorAll('[data-gh-stars]');
  if (!links.length || !window.fetch) return;

  function fmt(n) {
    if (n < 1000) return String(n);
    return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k';
  }

  // 同一个仓库在页面上出现多次时只请求一次
  var pending = {};
  function stars(repo) {
    if (!pending[repo]) {
      pending[repo] = fetch('/api/stars?repo=' + encodeURIComponent(repo))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d && typeof d.stars === 'number' ? d.stars : null; })
        .catch(function () { return null; });
    }
    return pending[repo];
  }

  [].forEach.call(links, function (a) {
    stars(a.getAttribute('data-gh-stars')).then(function (n) {
      if (n === null) return;
      var s = document.createElement('span');
      s.className = 'gh-stars';
      s.textContent = '★ ' + fmt(n);
      a.appendChild(s);
      a.title = n + ' stars on GitHub';
    });
  });
})();
