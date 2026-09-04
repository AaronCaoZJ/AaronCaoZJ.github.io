/* 每个城市一行累计计数，不保留逐条访问日志。
   主键是 (city, country)，所以 ON CONFLICT 能原地累加。

   全文用块注释而非 SQL 行注释：D1 的网页 Console 会把多行输入压成一行，
   行注释一旦被折叠，就会把它后面的整条语句一并吃掉，
   报 "Requests without any query are not supported"。
   即便如此，粘进 Console 时仍建议一次只贴一条语句。 */

CREATE TABLE IF NOT EXISTS visits (city TEXT NOT NULL, country TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, n INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, PRIMARY KEY (city, country));

CREATE INDEX IF NOT EXISTS idx_visits_n ON visits (n DESC);
