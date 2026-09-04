/* 访客地图后端 —— Cloudflare Worker + D1。

   挂在 caozhijun.top/api/* 上，请求在到达 GitHub Pages 之前被这里截住。
   地理位置直接取 Cloudflare 边缘给的 request.cf，不调任何 IP 库，
   访客 IP 也不会离开 Cloudflare 的网络。

   隐私取舍：只落库到「城市 + 国家」这一级，经纬度取整到 0.1 度
   （约 11 公里），不存 IP、不存 User-Agent、不种 cookie，
   也不保留逐条访问日志 —— 表里每个城市只有一行累计计数。 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(body, extra) {
  return new Response(JSON.stringify(body), {
    headers: Object.assign({}, JSON_HEADERS, extra || {}),
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

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

    return new Response('Not found', { status: 404 });
  },
};
