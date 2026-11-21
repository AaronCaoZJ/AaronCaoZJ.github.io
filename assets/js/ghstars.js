/* GitHub star counts. Links with data-gh-stars="owner/name" get "★ 127" appended, fetched from same-origin
   /api/stars (proxied and cached for 1 h by the Worker).

   On any failure (no Worker in local preview, API down, repo not allow-listed) the link is left as is:
   better nothing than an empty star or "★ NaN". */
(function () {
  var links = document.querySelectorAll('[data-gh-stars]');
  if (!links.length || !window.fetch) return;

  function fmt(n) {
    if (n < 1000) return String(n);
    return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k';
  }

  // one request per repo, however many links point to it
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
      function updateTitle() {
        a.title = document.documentElement.lang === 'zh-CN'
          ? 'GitHub 上获得 ' + n + ' 颗星标' : n + ' stars on GitHub';
      }
      updateTitle();
      document.addEventListener('languagechange', updateTitle);
    });
  });
})();
