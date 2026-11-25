#!/usr/bin/env bash
# 主页访客：过去一段时间里有访问的城市，以及各城市的网络（nets）和来源（refs）。
#
#   worker/visits.sh            过去 24 小时
#   worker/visits.sh 6h         也可以 30m / 3d
#
# 需要先 npx wrangler login；只跑 SELECT。
# D1 每个城市（以及城市+网络、城市+来源）只存一行累计，所以列出的是"最近一次访问落在时段内"的行：
# 时间是该行最近一次访问，次数是累计总数，不是时段内的次数。
# 逐次访问的明细（设备、浏览器）只在 Cloudflare 后台的 Worker 日志里，保留 3 天。
set -eu
cd "$(dirname "$0")"

span=${1:-24h}
if ! [[ $span =~ ^[0-9]+[mhd]$ ]]; then
  echo "时长格式：30m / 6h / 3d" >&2
  exit 1
fi
n=${span%?}
case $span in
  *m) sec=$((n * 60)) ;;
  *h) sec=$((n * 3600)) ;;
  *d) sec=$((n * 86400)) ;;
esac

since="unixepoch() - $sec"
sql="SELECT city, country, city_zh, n, last_seen FROM visits WHERE last_seen >= $since ORDER BY last_seen DESC;
SELECT city, country, asn, org, n, last_seen FROM nets WHERE last_seen >= $since ORDER BY last_seen DESC;
SELECT city, country, ref, n, last_seen FROM refs WHERE last_seen >= $since ORDER BY last_seen DESC;"

if ! out=$(npx --yes wrangler d1 execute visitors --remote --json --command "$sql" 2>/dev/null); then
  echo "查询失败。没登录的话先运行：npx wrangler login" >&2
  exit 1
fi

OUT="$out" python3 -I - "$span" "$sec" <<'PY'
import json, os, sys, time, unicodedata

span, sec = sys.argv[1], int(sys.argv[2])
visits, nets, refs = (r["results"] for r in json.loads(os.environ["OUT"]))

def width(s):
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)

def cut(s, w):
    # shorten to display width w with an ellipsis
    if width(s) <= w:
        return s
    while width(s) > w - 1:
        s = s[:-1]
    return s.rstrip(" ,.") + "…"

def hm(t):
    return time.strftime("%m-%d %H:%M", time.localtime(t))

color = sys.stdout.isatty() and "NO_COLOR" not in os.environ
def style(s, code):
    return f"\033[{code}m{s}\033[0m" if color and code else s
BOLD, DIM = "1", "2"
APPS = {"weixin": "微信", "wxwork": "企业微信", "feishu": "飞书", "dingtalk": "钉钉", "qq": "QQ"}  # in-app browsers, see refs in schema.sql

start = time.strftime("%m-%d %H:%M", time.localtime(time.time() - sec))
print(style(f"过去 {span}（{start} 起）· {len(visits)} 个城市有访问", BOLD))
if not visits:
    sys.exit()

# One row per city; a cell is a list of (text, style) lines.
# Network / referrer lines carry their own time only when it differs from the city's.
rows = []
for v in visits:
    key, last = (v["city"], v["country"]), v["last_seen"]
    def when(x):
        return "" if hm(x["last_seen"]) == hm(last) else f" · {hm(x['last_seen'])}"
    city = [(f"{v['city_zh'] or v['city']} {v['country']}", "")]
    if v["city_zh"] and v["city_zh"] != v["city"]:
        city.append((v["city"], DIM))
    net = [(f"{'AS' + str(x['asn']) + ' ' + cut(x['org'], 30) if x['asn'] else '未知网络'} ×{x['n']}{when(x)}", "")
           for x in nets if (x["city"], x["country"]) == key]
    ref = [(f"{APPS.get(x['ref'], x['ref']) or '直接打开'} ×{x['n']}{when(x)}", "")
           for x in refs if (x["city"], x["country"]) == key]
    rows.append([[(hm(last), "")], city, [(str(v["n"]), "")], net or [("—", DIM)], ref or [("—", DIM)]])

head = ["最近访问", "城市", "累计", "网络", "来源"]
right = {2}
W = [max(width(head[i]), *(width(t) for r in rows for t, _ in r[i])) for i in range(len(head))]

def line(l, m, r):
    return style(l + m.join("─" * (w + 2) for w in W) + r, DIM)

def cell(i, text, code):
    gap = " " * (W[i] - width(text))
    return " " + (gap + style(text, code) if i in right else style(text, code) + gap) + " "

bar = style("│", DIM)
print(line("╭", "┬", "╮"))
print(bar + bar.join(cell(i, h, BOLD) for i, h in enumerate(head)) + bar)
for r in rows:
    print(line("├", "┼", "┤"))
    for k in range(max(len(c) for c in r)):
        print(bar + bar.join(cell(i, *(c[k] if k < len(c) else ("", ""))) for i, c in enumerate(r)) + bar)
print(line("╰", "┴", "╯"))
print(style("累计 = 该城市总次数；网络、来源后的时间只在和城市最近访问不同时标出", DIM))
PY
