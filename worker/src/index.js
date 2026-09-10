/* 访客地图后端 —— Cloudflare Worker + D1。

   挂在 caozhijun.top/api/* 上，请求在到达 GitHub Pages 之前被这里截住。
   地理位置直接取 Cloudflare 边缘给的 request.cf，不调任何 IP 库，
   访客 IP 也不会离开 Cloudflare 的网络。

   隐私取舍：只落库到「城市 + 国家」这一级，经纬度取整到 0.1 度
   （约 11 公里），不存 IP、不存 User-Agent、不种 cookie，
   也不保留逐条访问日志 —— 表里每个城市只有一行累计计数。 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

// 允许查 star 数的仓库。要给新仓库加 star 显示，先把它加到这里，
// 再给页面上对应的链接加 data-gh-stars="owner/name"。
const STAR_REPOS = new Set([
  'showlab/Show-Harness',
  'showlab/Awesome-Multimodal-Embodied-Agent',
  'AaronCaoZJ/julia-diffusion',
]);

function json(body, extra) {
  return new Response(JSON.stringify(body), {
    headers: Object.assign({}, JSON_HEADERS, extra || {}),
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---------- 记一次访问 ----------
    if (pathname === '/api/visit') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      const cf = request.cf || {};
      const city = cf.city;
      const country = cf.country;
      const lat = Math.round(parseFloat(cf.latitude) * 10) / 10;
      const lon = Math.round(parseFloat(cf.longitude) * 10) / 10;

      // 定位不到（部分 IP、内网、爬虫）就安静跳过，不写脏数据
      if (!city || !country || !isFinite(lat) || !isFinite(lon)) {
        return json({ ok: true, recorded: false });
      }

      await env.DB.prepare(
        `INSERT INTO visits (city, country, lat, lon, n, last_seen)
         VALUES (?1, ?2, ?3, ?4, 1, unixepoch())
         ON CONFLICT(city, country)
         DO UPDATE SET n = n + 1, last_seen = unixepoch()`
      ).bind(city, country, lat, lon).run();

      return json({ ok: true, recorded: true });
    }

    // ---------- 读聚合结果 ----------
    if (pathname === '/api/visitors') {
      const { results } = await env.DB.prepare(
        `SELECT city, country AS cc, lat, lon, n
         FROM visits ORDER BY n DESC LIMIT 300`
      ).all();

      // 边缘缓存 5 分钟：地图不需要实时，这样也顺带挡住了刷接口
      return json(results, { 'cache-control': 'public, max-age=300' });
    }

    // ---------- GitHub star 数 ----------
    // 白名单：不接受任意仓库名，否则这个接口就成了替任何人薅 GitHub API
    // 额度的开放代理（而且用的是 Cloudflare 共享出口 IP 的那 60 次/小时）。
    if (pathname === '/api/stars') {
      const repo = url.searchParams.get('repo') || '';
      if (!STAR_REPOS.has(repo)) {
        return new Response('Not found', { status: 404 });
      }

      // Worker 的响应不会自动进 CDN 缓存，要自己用 Cache API 存取。
      // 命中就直接返回：每个边缘节点每小时最多问 GitHub 一次。
      const cache = caches.default;
      const key = new Request(url.toString(), { method: 'GET' });
      const hit = await cache.match(key);
      if (hit) return hit;

      const headers = {
        'user-agent': 'caozhijun.top',            // GitHub API 强制要求 UA
        accept: 'application/vnd.github+json',
      };
      // 可选：在 Worker 的 Settings → Variables 里配一个 GITHUB_TOKEN（只读、
      // 不需要任何权限），额度从 60/小时 提到 5000/小时。不配也能用。
      if (env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + env.GITHUB_TOKEN;

      let stars = null;
      try {
        const r = await fetch('https://api.github.com/repos/' + repo, { headers });
        if (r.ok) stars = (await r.json()).stargazers_count;
      } catch (e) { /* 取不到就返回 null，前端会只显示 "Github" */ }

      // 成功缓存 1 小时；失败只缓存 5 分钟，免得一次抖动卡住一整小时
      const ttl = typeof stars === 'number' ? 3600 : 300;
      const res = json({ stars }, { 'cache-control': 'public, max-age=' + ttl });
      ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    }

    return new Response('Not found', { status: 404 });
  },
};
