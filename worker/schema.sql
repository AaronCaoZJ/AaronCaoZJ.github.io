/* 每个城市一行累计计数，不保留逐条访问日志。
   主键是 (city, country)，所以 ON CONFLICT 能原地累加。

   注释用 /* *​/ 块注释而非 --：D1 的网页 Console 会把多行压成一行，
   行注释一旦被折叠就会把后面的整条语句吃掉。块注释不受影响。
   粘进 Console 时仍建议一次一条语句。 */

CREATE TABLE IF NOT EXISTS visits (city TEXT NOT NULL, country TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, n INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, PRIMARY KEY (city, country));

CREATE INDEX IF NOT EXISTS idx_visits_n ON visits (n DESC);
