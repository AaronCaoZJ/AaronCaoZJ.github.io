/* Visitor-map backend: Cloudflare Worker + D1 on caozhijun.top/api/*, in front of GitHub Pages.
   Location comes from Cloudflare's request.cf: no IP database, and visitor IPs never leave Cloudflare.

   Privacy: store only city + country, coordinates rounded to 0.1° (~11 km); no IP, User-Agent,
   cookies or per-visit log, just one cumulative row per city. Owner-only tables add one cumulative row
   per city and referring host (refs, no path) and per city and network (nets: AS number and operator
   name from request.cf, no IP).

   /api/stars is an unrelated GitHub star-count proxy/cache for assets/js/ghstars.js. */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

// Repos /api/stars will serve. To show stars for a new repo, add it here and
// put data-gh-stars="owner/name" on its link.
const STAR_REPOS = new Set([
  'showlab/Show-Harness',
  'showlab/RUIBench',
  'showlab/MRBench',
  'showlab/Awesome-Multimodal-Embodied-Agent',
  'AaronCaoZJ/julia-diffusion',
]);

function json(body, extra) {
  return new Response(JSON.stringify(body), {
    headers: Object.assign({}, JSON_HEADERS, extra || {}),
  });
}

/* ---------- External lookup services ----------
   Chinese names and areas below are looked up once per city and stored. Lookups run in ctx.waitUntil
   so the response goes out first. Only the Cloudflare city name and rounded coordinates are sent, no
   visitor data. The services may be unreachable from mainland China, but the calls run on Cloudflare. */
const UA = 'caozhijun.top visitor map (https://caozhijun.top)';   // Wikidata and OSM require an identifying UA
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function km(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos((lat1 + lat2) / 2 * r), y = (lat2 - lat1) * r;
  return 6371 * Math.hypot(x, y);
}

async function sparql(query) {
  const r = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(query), {
    headers: { 'user-agent': UA, accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(15000),       // admin-chain queries take 5–6 s for obscure places
  });
  if (!r.ok) throw new Error('wikidata ' + r.status);
  return r.json();
}

/* Find a place on Wikidata by English name: settlements or admin regions within `radius` km, picking the
   one with the most sitelinks (namesake stations, bays, abolished counties have far fewer).
   Returns { item, zh } (zh from zh-cn or zh-hans, may be null), or null if nothing matches. */
async function wikidataPlace(name, lat, lon, radius) {
  const { results } = await sparql(`SELECT DISTINCT ?item ?links ?coord ?cn ?hans WHERE {
    SERVICE wikibase:mwapi {
      bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "EntitySearch";
                      mwapi:search ${JSON.stringify(name)}; mwapi:language "en"; mwapi:limit "20".
      ?item wikibase:apiOutputItem mwapi:item.
    }
    ?item wdt:P31/wdt:P279* ?kind. VALUES ?kind { wd:Q486972 wd:Q56061 }
    ?item wdt:P625 ?coord; wikibase:sitelinks ?links.
    OPTIONAL { ?item rdfs:label ?cn FILTER(LANG(?cn) = "zh-cn") }
    OPTIONAL { ?item rdfs:label ?hans FILTER(LANG(?hans) = "zh-hans") }
  }`);
  let best = null;
  for (const b of results.bindings) {
    const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(b.coord.value);   // WKT order is lon lat
    const links = Number(b.links.value);
    if (m && km(lat, lon, +m[2], +m[1]) < radius && (!best || links > best.links)) {
      best = { links, item: b.item.value.split('/').pop(), zh: tidy((b.cn || b.hans || {}).value) };
    }
  }
  return best;
}

/* ---------- Chinese city names (toChinese) ----------
   Cloudflare gives English names only; the zh-CN map stores a translation in city_zh.
   Wikidata first (wikidataPlace, 50 km); places without a Simplified Chinese label (US data-center towns,
   tiny districts) go to Workers AI for transliteration (needs the AI binding, see docs/VISITOR-MAP.md).
   On Wikidata errors (rate limit, timeout) skip instead of falling back to AI, since a stored name is
   never re-queried. Misses stay NULL and retry on the next visit from that city or the next map load. */

// Strip trailing disambiguation in parentheses and stray quotes; drop the "city" suffix (Nagoya-shi -> Nagoya)
// to match Shanghai/Tokyo on the map, keeping district/county suffixes. Accept pure CJK (plus middle dot) only.
function tidy(name) {
  name = String(name || '').trim()
    .replace(/\s*[（(][^）)]*[）)]\s*$/, '')
    .replace(/^["'“”「」]+|["'“”「」。.]+$/g, '');
  if (name.length >= 3 && name.endsWith('市')) name = name.slice(0, -1);
  return /^[\u3400-\u9fff·]{1,12}$/.test(name) ? name : null;
}

async function fromAI(env, name, cc) {
  if (!env.AI) return null;
  const out = await env.AI.run(AI_MODEL, {
    messages: [
      { role: 'system', content: '把地名翻译成简体中文。只输出译名本身：用中文地图和新闻里通行的写法，没有通行译名就按新华社的规则音译；不要国家名、不要括号、不要解释。' },
      { role: 'user', content: name + '（国家代码 ' + cc + '）' },
    ],
    max_tokens: 20,
    temperature: 0,
  });
  const text = out && (out.response || (out.choices && out.choices[0] && out.choices[0].message.content));
  return tidy(text);
}

// Wikidata errors propagate (retry later); only a miss or a hit without a Chinese label goes to AI
async function toChinese(env, name, cc, lat, lon, radius) {
  const place = await wikidataPlace(name, lat, lon, radius);
  if (place && place.zh) return place.zh;
  try { return await fromAI(env, name, cc); } catch (e) { return null; }
}

/* ---------- City-level areas (AREA) ----------
   Cloudflare's `city` granularity is uneven: a Shenzhen district, each Bay Area town, a Tokyo ward.
   The map groups at Chinese prefecture level: each city gets one more lookup, English name into `area`
   (the front end merges by it), Chinese name into `area_zh`. Per country:
     CN  Walk Wikidata P131 up to a prefecture-level division or municipality; names Wikidata can't
         find (small communities) fall back to OSM reverse geocoding, whose admin level 5 is the prefecture.
     US  Census CBSA (core city plus surrounding counties), named after its first principal city;
         towns outside any CBSA keep their own name.
     JP  Municipalities already are prefecture-level; only Tokyo metropolis is merged into one city.
     Other countries are not looked up.
   Prefer lookups by name: stored coordinates are rounded to 0.1°, which pushes border cities into
   neighbours (a Shenzhen row lands in Hong Kong, Fujisawa in Kamakura).
   area = city: checked, nothing to merge. NULL: not checked yet, or the last lookup failed. */

// Walk P131 from the item itself up to a prefecture-level division (Q9316670) or municipality (Q1208802).
// If several match, a municipality wins (Pudong is prefecture-class but belongs to Shanghai); otherwise
// the lowest one (Ili prefecture contains Tacheng and Altay, which are prefectures themselves).
async function chinaPrefecture(item) {
  const { results } = await sparql(`SELECT ?a ?kind ?up ?en ?cn ?hans WHERE {
    wd:${item} wdt:P131* ?a. ?a wdt:P31/wdt:P279* ?kind. VALUES ?kind { wd:Q9316670 wd:Q1208802 }
    OPTIONAL { ?a wdt:P131 ?up }
    ?a rdfs:label ?en FILTER(LANG(?en) = "en")
    OPTIONAL { ?a rdfs:label ?cn FILTER(LANG(?cn) = "zh-cn") }
    OPTIONAL { ?a rdfs:label ?hans FILTER(LANG(?hans) = "zh-hans") }
  }`);
  const id = (b) => b && b.value.split('/').pop();
  const rows = results.bindings.map((b) => ({ a: id(b.a), up: id(b.up), kind: id(b.kind), area: b.en.value,
                                               zh: tidy((b.cn || b.hans || {}).value) }));
  const above = new Set(rows.map((r) => r.up));
  const pick = rows.find((r) => r.kind === 'Q1208802') || rows.find((r) => !above.has(r.a)) || rows[0];
  return pick ? { area: pick.area, zh: pick.zh } : null;
}

// Reverse-geocode on OSM: prefectures are admin level 5; municipalities have no level 5 and sit at level 4
const MUNICIPALITIES = new Set(['Beijing', 'Shanghai', 'Tianjin', 'Chongqing']);
async function osmPrefecture(r) {
  const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=geocodejson&zoom=10&accept-language=en' +
    '&lat=' + r.lat + '&lon=' + r.lon, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) });
  const body = res.ok ? await res.json() : null;
  await sleep(1000);                                      // Nominatim usage policy: max 1 request/s
  if (!body) throw new Error('nominatim ' + res.status);
  const f = body.features && body.features[0];
  const a = (f && f.properties.geocoding.admin) || {};
  const name = (a.level5 || (MUNICIPALITIES.has(a.level4) ? a.level4 : '')).replace(/\s+(City|Prefecture)$/, '');
  return name && !/[\u3400-\u9fff]/.test(name) ? { area: name } : null;   // skip CJK-only names so the English page stays CJK-free
}

const AREA = {
  async CN(r) {
    const place = await wikidataPlace(r.city, r.lat, r.lon, 50);
    return (place && await chinaPrefecture(place.item)) || osmPrefecture(r);
  },

  async US(r) {
    const layers = 'Metropolitan Statistical Areas,Micropolitan Statistical Areas';
    const res = await fetch('https://geocoding.geo.census.gov/geocoder/geographies/coordinates' +
      '?benchmark=Public_AR_Current&vintage=Current_Current&format=json&layers=' + encodeURIComponent(layers) +
      '&x=' + r.lon + '&y=' + r.lat, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('census ' + res.status);
    const g = ((await res.json()).result || {}).geographies || {};
    const m = (g['Metropolitan Statistical Areas'] || [])[0] || (g['Micropolitan Statistical Areas'] || [])[0];
    // Keep what precedes the first hyphen (Chicago-Naperville-Elgin, IL-IN -> Chicago).
    // Caveat: a single principal city with a hyphenated name (Winston-Salem) becomes Winston
    return m ? { area: m.BASENAME.split(',')[0].split('-')[0].split('/')[0].trim() } : null;
  },

  // By name: is it inside Tokyo metropolis (Q1490)?
  async JP(r) {
    const place = await wikidataPlace(r.city, r.lat, r.lon, 50);
    const inTokyo = place && (await sparql(`ASK { wd:${place.item} wdt:P131* wd:Q1490 }`)).boolean;
    return inTokyo ? { area: 'Tokyo' } : null;
  },
};

// Reuse a Chinese area name already in the table: Ashburn, merged into Washington, takes Washington's city_zh
async function knownZh(env, name, cc) {
  const row = await env.DB.prepare(
    `SELECT city_zh AS zh FROM visits WHERE city = ?1 AND country = ?2 AND city_zh IS NOT NULL
     UNION ALL
     SELECT area_zh FROM visits WHERE area = ?1 AND country = ?2 AND area_zh IS NOT NULL
     LIMIT 1`
  ).bind(name, cc).first();
  return row && row.zh;
}

// Missing any of: Chinese name; area (only for countries in AREA); the area's Chinese name
function incomplete(r) {
  return r.zh == null || (AREA[r.cc] && r.area == null) ||
         (r.area != null && r.area !== r.city && r.area_zh == null);
}

// Fill in what's missing. A step whose service errors is skipped and left NULL for a later retry
async function enrich(env, r) {
  const set = (col, value) => env.DB.prepare('UPDATE visits SET ' + col + ' = ?1 WHERE city = ?2 AND country = ?3')
    .bind(value, r.city, r.cc).run();
  if (r.zh == null) {
    try {
      r.zh = await toChinese(env, r.city, r.cc, r.lat, r.lon, 50);
      if (r.zh) await set('city_zh', r.zh);
    } catch (e) {}
  }
  if (r.area == null && AREA[r.cc]) {
    try {
      const found = await AREA[r.cc](r);
      r.area = (found && found.area) || r.city;
      await set('area', r.area);
      if (found && found.zh && r.area !== r.city) await set('area_zh', r.area_zh = found.zh);
    } catch (e) {}
  }
  if (r.area != null && r.area !== r.city && r.area_zh == null) {
    try {
      // The area's centre can be far from this point (DeKalb to Chicago is ~100 km), so widen to 200 km
      r.area_zh = (await knownZh(env, r.area, r.cc)) || (await toChinese(env, r.area, r.cc, r.lat, r.lon, 200));
      if (r.area_zh) await set('area_zh', r.area_zh);
    } catch (e) {}
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---------- Record a visit ----------
    if (pathname === '/api/visit') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      const cf = request.cf || {};
      const city = cf.city;
      const country = cf.country;
      const lat = Math.round(parseFloat(cf.latitude) * 10) / 10;
      const lon = Math.round(parseFloat(cf.longitude) * 10) / 10;

      // No location (some IPs, private networks, bots): skip quietly rather than store junk
      if (!city || !country || !isFinite(lat) || !isFinite(lon)) {
        return json({ ok: true, recorded: false });
      }

      const row = await env.DB.prepare(
        `INSERT INTO visits (city, country, lat, lon, n, last_seen)
         VALUES (?1, ?2, ?3, ?4, 1, unixepoch())
         ON CONFLICT(city, country)
         DO UPDATE SET n = n + 1, last_seen = unixepoch()
         RETURNING city_zh AS zh, area, area_zh`
      ).bind(city, country, lat, lon).first();

      // New (or incomplete) city: fill in after the response is sent
      const r = row && Object.assign({ city, cc: country, lat, lon }, row);
      if (r && incomplete(r)) ctx.waitUntil(enrich(env, r));

      // Referring site per city (table refs): host only, or an app name (weixin, feishu...), '' = direct.
      // Owner-only: /api/visitors never reads it.
      // The catch keeps visits working if this Worker is deployed before refs is created.
      let ref = (url.searchParams.get('ref') || '').toLowerCase().replace(/^www\./, '');
      if (!/^[a-z0-9.-]{1,100}$/.test(ref)) ref = '';
      ctx.waitUntil(env.DB.prepare(
        `INSERT INTO refs (city, country, ref, n, last_seen)
         VALUES (?1, ?2, ?3, 1, unixepoch())
         ON CONFLICT(city, country, ref)
         DO UPDATE SET n = n + 1, last_seen = unixepoch()`
      ).bind(city, country, ref).run().catch(() => {}));

      // Network per city (table nets): AS number + operator name, asn 0 = unknown. Shows whether a city was
      // really located or is a default: Shanghai Mobile (AS24400) vs China Mobile group-wide (AS9808), which
      // Cloudflare also places in Shanghai. Owner-only and fail-safe like refs.
      const asn = Number.isInteger(cf.asn) ? cf.asn : 0;
      const org = String(cf.asOrganization || '').slice(0, 100);
      ctx.waitUntil(env.DB.prepare(
        `INSERT INTO nets (city, country, asn, org, n, last_seen)
         VALUES (?1, ?2, ?3, ?4, 1, unixepoch())
         ON CONFLICT(city, country, asn)
         DO UPDATE SET n = n + 1, org = excluded.org, last_seen = unixepoch()`
      ).bind(city, country, asn, org).run().catch(() => {}));

      return json({ ok: true, recorded: true });
    }

    // ---------- Read aggregates ----------
    if (pathname === '/api/visitors') {
      // ago = whole hours since the last visit, for recency colouring. Not a timestamp: for a town with
      // one visitor, an exact time would reveal when that person opened the page. Computed server-side,
      // so visitors' clock skew doesn't matter.
      const { results } = await env.DB.prepare(
        `SELECT city, country AS cc, city_zh AS zh, area, area_zh, lat, lon, n,
                CAST((unixepoch() - last_seen) / 3600 AS INTEGER) AS ago
         FROM visits ORDER BY n DESC LIMIT 300`
      ).all();

      // Backfill incomplete rows on map load, 3 random ones per request: in a fixed order, a few
      // never-resolvable rows would hog the slots forever. Sequential, since Wikidata rate-limits bursts
      const todo = results.filter(incomplete).sort(() => Math.random() - 0.5).slice(0, 3);
      if (todo.length) {
        ctx.waitUntil((async () => {
          const t0 = Date.now();      // waitUntil is capped at 30 s; start no new lookup after 15 s
          for (const r of todo) {
            if (Date.now() - t0 > 15000) break;
            await enrich(env, Object.assign({}, r));
          }
        })());
      }

      // Browser cache only (5 min). Worker responses don't enter the edge cache on their own (see
      // /api/stars below), so this doesn't stop anyone hammering the API
      return json(results, { 'cache-control': 'public, max-age=300' });
    }

    // ---------- GitHub stars ----------
    // Allow-listed repos only; otherwise this is an open proxy spending GitHub API quota for anyone.
    if (pathname === '/api/stars') {
      const repo = url.searchParams.get('repo') || '';
      if (!STAR_REPOS.has(repo)) {
        return new Response('Not found', { status: 404 });
      }

      // Two entries: fresh (1 h) is the normal path; stale (30 days) is served only when GitHub refuses.
      // Worker responses don't enter the CDN cache on their own, so store them explicitly.
      const cache = caches.default;
      const freshKey = new Request(url.origin + '/api/stars?repo=' + repo);
      const staleKey = new Request(url.origin + '/api/stars?repo=' + repo + '&stale=1');

      const hit = await cache.match(freshKey);
      if (hit) return hit;

      const headers = {
        'user-agent': 'caozhijun.top',            // required by the GitHub API
        accept: 'application/vnd.github+json',
      };
      // Strongly recommended: unauthenticated quota is 60/h per egress IP, and Workers share egress IPs,
      // so it's often already used up (403). With a token it's 5000/h, independent of IP.
      if (env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + env.GITHUB_TOKEN;
      // Presence only, never the value: the first thing to check when debugging a 403
      const auth = env.GITHUB_TOKEN ? 'token' : 'none';

      let stars = null, upstream = 0;
      try {
        const r = await fetch('https://api.github.com/repos/' + repo, { headers });
        upstream = r.status;
        if (r.ok) stars = (await r.json()).stargazers_count;
      } catch (e) { upstream = -1; }

      let res;
      if (typeof stars === 'number') {
        res = json({ stars }, { 'cache-control': 'public, max-age=3600',
                              'x-upstream': String(upstream), 'x-auth': auth });
        const keep = json({ stars }, { 'cache-control': 'public, max-age=2592000' });
        ctx.waitUntil(Promise.all([cache.put(freshKey, res.clone()), cache.put(staleKey, keep)]));
        return res;
      }

      // GitHub failed: serve the last good count and retry in 10 min; null only if it never succeeded
      const stale = await cache.match(staleKey);
      const last = stale ? (await stale.json()).stars : null;
      res = json({ stars: last, stale: last !== null },
                 { 'cache-control': 'public, max-age=' + (last !== null ? 600 : 60),
                   'x-upstream': String(upstream), 'x-auth': auth });
      ctx.waitUntil(cache.put(freshKey, res.clone()));
      return res;
    }

    return new Response('Not found', { status: 404 });
  },
};
