/* One cumulative row per city, no per-visit log. Primary key (city, country) lets ON CONFLICT increment in place.

   Block comments only: the D1 web console collapses input to one line, so a -- comment would swallow
   the statement after it ("Requests without any query are not supported"). Paste one statement at a time. */

/* city_zh: Chinese city name, filled in by the Worker (toChinese in src/index.js); NULL = not found yet.
   Tables created before 2026-11 lack it: ALTER TABLE visits ADD COLUMN city_zh TEXT; */

/* area / area_zh: English and Chinese name of the city-level area (CN prefecture, US metro area, Tokyo),
   filled in by the Worker (AREA in src/index.js); the front end merges by area. area = city: no merge; NULL: not checked yet.
   Tables created before 2026-11-10 lack them; run one at a time:
   ALTER TABLE visits ADD COLUMN area TEXT;
   ALTER TABLE visits ADD COLUMN area_zh TEXT; */

CREATE TABLE IF NOT EXISTS visits (city TEXT NOT NULL, country TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, n INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, city_zh TEXT, area TEXT, area_zh TEXT, PRIMARY KEY (city, country));

CREATE INDEX IF NOT EXISTS idx_visits_n ON visits (n DESC);

/* refs: referring site per city, owner-only (the public /api/visitors never reads it). ref = referrer host
   without www. and without path, or the in-app browser (weixin, wxwork, feishu, dingtalk, qq) when there is
   no referrer; '' = direct (typed URL, bookmark, PDF).
   Added 2026-11-24; on an older database just run this statement. */
CREATE TABLE IF NOT EXISTS refs (city TEXT NOT NULL, country TEXT NOT NULL, ref TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, PRIMARY KEY (city, country, ref));

/* nets: network per city, owner-only like refs. asn / org = AS number and operator name from Cloudflare's
   request.cf (asn 0 = unknown); no IP. Tells a located city from a default one, e.g. Shanghai Mobile (24400)
   vs China Mobile group-wide (9808), both placed in Shanghai.
   Added 2026-11-24; on an older database just run this statement. */
CREATE TABLE IF NOT EXISTS nets (city TEXT NOT NULL, country TEXT NOT NULL, asn INTEGER NOT NULL, org TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, PRIMARY KEY (city, country, asn));
