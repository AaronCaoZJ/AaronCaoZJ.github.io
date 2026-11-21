# 访客地图部署手册

首页底部那张点阵世界地图。前端和后端都已上线（`worldmap.js` 里 `USE_MOCK` 为 `false`，显示的是真实数据），
这份文档记录后端是怎么接上的，重建或换账号时照着做。

```
浏览器 ──→ Cloudflare 边缘 ──┬─ /api/visit     POST  记一次访问
                             ├─ /api/visitors  GET   读聚合结果
                             └─ 其他路径              GitHub Pages 静态文件
```

地理位置由 Cloudflare 边缘在 `request.cf` 里直接给出，不调用任何 IP 库，
访客 IP 不会离开 Cloudflare 的网络，也不会写进数据库。

## 隐私口径

数据库里**每个城市只有一行累计计数**，没有逐条访问日志：

| 存 | 不存 |
|---|---|
| 城市名、国家代码 | IP 地址 |
| 经纬度（取整到 0.1°，约 11 km） | User-Agent |
| 累计次数、最后一次时间 | Cookie / 任何标识符 |
| | 单次访问记录 |

查中文名和所属城市时（见下面两节），发给 Wikidata、OpenStreetMap、美国人口普查局的只有 Cloudflare 报的城市名和取整后的坐标，
没有任何访客信息。

想改成只到国家级，把 `worker/src/index.js` 里插入语句的 `city` 换成
`country` 并去掉城市字段即可。

## 前置条件

- 本机装了 Node.js（`node -v` 能输出版本）
- Cloudflare 账号，`caozhijun.top` 已托管在上面（已满足）
- 域名是**橙云代理**状态（已满足）—— Worker 路由只在代理开启时生效

## 两条路径：网页面板 or 命令行

后端只有一个单文件 Worker、一张表，没有依赖也没有构建步骤，所以**两条路都走得通**：

| | Cloudflare 网页面板 | 本机 wrangler |
|---|---|---|
| 需要装东西 | 不需要 | Node.js |
| 改代码 | 面板里编辑、点部署 | 改文件、`wrangler deploy` |
| 部署产物有版本管理 | 面板保留历史版本，但仓库里的副本可能与线上不一致 | 仓库即真相 |
| 适合 | 一次配好、极少改动 | 经常迭代 |

对这个项目**推荐网页面板**——一次配好基本不用再动。仓库里的
`worker/src/index.js` 保留为源码副本，改的时候以它为准、再贴回面板。

选面板就看下面一节，选命令行就跳到「命令行部署」。

## 网页面板部署

Cloudflare 的面板改版频繁，下面的菜单名可能略有出入，按意思找即可。

### 1. 建数据库

左侧 **Storage & Databases → D1**（旧版在 Workers & Pages 下面）→
**Create database**，名字填 `visitors`。

进去后有个 **Console**（或 Query）标签页，**一次粘一条**执行下面两句：

```sql
CREATE TABLE IF NOT EXISTS visits (city TEXT NOT NULL, country TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, n INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, city_zh TEXT, area TEXT, area_zh TEXT, PRIMARY KEY (city, country));
```

```sql
CREATE INDEX IF NOT EXISTS idx_visits_n ON visits (n DESC);
```

执行 `/tables` 应该能看到 `visits`。

> Console 会把多行输入折叠成一行，所以**别把带 `--` 行注释的 SQL 整段粘进去**
> —— 折叠之后注释会把整条语句吃掉，报 `Requests without any query are not supported`。
> `worker/schema.sql` 里已经改用块注释，但仍建议按上面这样一条一条来。

### 2. 建 Worker

**Compute (Workers) → Create → Worker**，名字填 `caozhijun-visitors`，
先用默认的 Hello World 模板创建，然后点 **Edit code**。

把 `worker/src/index.js` 的**全部内容**覆盖进编辑器，点 **Deploy**。
模板本身就是 `export default { fetch }` 的形式，和这份代码结构一致，
不需要改任何写法。

### 3. 绑定数据库

Worker 详情页 → **Settings → Bindings → Add → D1 database**：

- Variable name：**`DB`** —— 必须一字不差，代码里写的是 `env.DB`
- D1 database：选 `visitors`

保存后 Cloudflare 会重新部署一次。

再加一个 **Workers AI** 绑定，Variable name 填 **`AI`**（代码里是 `env.AI`）。
它只用来给 Wikidata 查不到的城市音译中文名（见下面「中文城市名」），不绑也能用，只是那几个城市在中文页面上显示英文。

### 4. 挂路由

同样在 **Settings**，找 **Domains & Routes**（或 Triggers → Routes）
→ **Add → Route**，加两条，Zone 都选 `caozhijun.top`：

```
caozhijun.top/api/*
www.caozhijun.top/api/*
```

路由只在**橙云代理**的域名上生效。你两个域名都是代理状态，没问题。

加完之后，`/api/*` 会被 Worker 截住，其余所有路径照常走 GitHub Pages。

### 5. 验证

跳到下面的「验证」小节，和命令行路径是同一套 curl。

## 命令行部署



全部在 `worker/` 目录下执行。走网页面板的话跳过本节。

### 1. 登录

```bash
cd worker
npx wrangler login
```

浏览器会弹出授权页，点同意。

### 2. 建数据库

```bash
npx wrangler d1 create visitors
```

输出里有一行 `database_id = "xxxxxxxx-..."`，把它**粘进 `wrangler.toml`**
替换掉 `PASTE_DATABASE_ID_HERE`。

### 3. 建表

```bash
npx wrangler d1 execute visitors --remote --file=./schema.sql
```

`--remote` 不能省，否则只在本地模拟库里建表。

### 4. 部署

```bash
npx wrangler deploy
```

成功后会打印出路由 `caozhijun.top/api/*`。

## 验证

```bash
curl -X POST https://caozhijun.top/api/visit     # 期望 {"ok":true,"recorded":true}
curl https://caozhijun.top/api/visitors          # 期望一个 JSON 数组
```

如果 `recorded` 是 `false`，说明 Cloudflare 没能定位你这个出口 IP ——
换个网络（手机热点）再试一次，这是正常现象而不是配置错误。

## 前端的数据开关

`assets/js/worldmap.js` 里的 `USE_MOCK` 线上保持 `false`。本地没有 Worker，想预览地图版式时临时改成 `true`，
用的是文件里的原型数据，别提交。

接口取不到数据时，整个 Visitors 一节会**保持隐藏**——
宁可什么都不显示，也不会把假数字当成真实访问量摆出来。

## 显示规则

都在前端做，数据库里的原始记录不动（`worldmap.js` 的 `mergeDistricts`、`placeName`）：

- **并到城市级**：统一到和中国地级市同一级（见「城市级单位」），宝安并进深圳、圣克拉拉并进圣何塞、新宿并进东京。香港、澳门、新加坡、台湾各并成一个点。次数相加，位置取次数最多的那条。
- **压住的点合成一个**：一个点的圆心落进另一个点里才合，悬停列出每个城市；只是挨着、边缘叠一点的照旧分开（见 `worldmap.js` 的 `regroup`）。
- **地名**：港澳台和内地一样写成中国，英文 `Taiwan, CN`、`Hong Kong, CN`，中文「台湾，中国」「香港，中国」。
- **中文城市名**：见下一节。

## 中文城市名

Cloudflare 只给英文城市名。新城市第一次被记下时，Worker 在后台（响应发出之后，访客不用等）查一次中文名，
存进 `city_zh` 列，`/api/visitors` 把它作为 `zh` 带给前端：

1. **Wikidata**：按英文名搜，只要居民点 / 行政区、离 Cloudflare 给的坐标 50 km 内的，取维基百科语言版本最多的那个
   （同名的车站、海湾、已撤销的旧县版本数少得多），用它的简体中文名。「名古屋市」这类去掉「市」。
   普通城市和区基本都能查到。Wikidata 出错（限流、超时）时不拿 AI 顶替，下次再查。
2. **Workers AI** 音译（`@cf/meta/llama-3.3-70b-instruct-fp8-fast`）：Wikidata 没有中文名的，比如美国的机房小镇。
   需要上面那个 `AI` 绑定。模型下线了就换 `worker/src/index.js` 里的 `AI_MODEL`。
3. 都没拿到就保持 NULL：下次有人从这个城市访问、或者有人打开地图（每次补最多三个）时再试。

前端 `worldmap.js` 的 `CITY_ZH` 表优先于自动译名，只用来改掉不合心意的译名（比如 Redwood City 写「红木城」），平时不用再加。
并点后显示的所属城市名（深圳、圣何塞）走同一套：Worker 查好存进 `area_zh`，`CITY_ZH` 同样可以覆盖（「东京都」写成「东京」）。

**2026-11 之前部署的，升级按这个顺序**（顺序不能反：新代码读写 `city_zh`，列还没加就部署，记访问和读地图都会报错）：

1. D1 Console 执行 `ALTER TABLE visits ADD COLUMN city_zh TEXT;`
2. Worker 加 `AI` 绑定（见「绑定数据库」一节末尾）
3. 把新的 `worker/src/index.js` 贴进面板，Deploy

已有的城市不用手动补，有人打开地图时陆续补上，一般一两天补完。

## 城市级单位

Cloudflare 报的城市粒度不齐：中国有时只报到区（宝安、固戍），美国报的是一个个市镇（湾区有圣何塞、圣克拉拉、帕洛阿尔托、雷德伍德城），
东京可能报到区。地图统一到和中国地级市同一级。新城市记下时 Worker 顺带查一次它属于哪个单位，英文名存进 `area`、中文名存进 `area_zh`，
前端按 `area` 并点：

| 国家 | 并到 | 数据来源 |
|---|---|---|
| 中国 | 地级市、自治州、地区、盟；直辖市整体一个 | Wikidata 沿「所在行政区」往上找；名字查不到的（社区一级）按坐标问 OpenStreetMap |
| 美国 | 都会区（CBSA），用第一个中心城市命名；不在都会区里的小镇保持原样 | 美国人口普查局 Geocoder |
| 日本 | 市町村保持原样，东京都整体一个 | Wikidata 查是否在东京都里 |
| 香港、澳门、新加坡、台湾 | 整体一个 | 前端 `WHOLE` |
| 其他国家 | 保持 Cloudflare 报的 | —（偶尔冒出来的区写进前端 `PARENT`） |

能按名字查的都按名字查：表里坐标取整到 0.1°，边界附近会落到隔壁（深圳那条取整后在香港新界）。
`area` 等于 `city` 表示不用并，NULL 表示还没查到；补的时机和中文名一样（新访问、或有人打开地图时随机补三个）。

已知的小毛病：只有一个中心城市、名字本身带连字符的都会区（Winston-Salem）会被切成 Winston。

**2026-11-10 之前部署的，升级按这个顺序**（顺序不能反：新代码读写这两列，列还没加就部署，记访问和读地图都会报错）：

1. D1 Console 一次一句执行 `ALTER TABLE visits ADD COLUMN area TEXT;` 和 `ALTER TABLE visits ADD COLUMN area_zh TEXT;`
2. 把新的 `worker/src/index.js` 贴进面板，Deploy
3. 再推前端（新的 `worldmap.js` 不再自带深圳各区的对照表，Worker 没升级前那两个区会单独显示）

## 日常运维

```bash
# 看前 20 个城市
npx wrangler d1 execute visitors --remote \
  --command "SELECT city, country, n FROM visits ORDER BY n DESC LIMIT 20"

# 清掉自己测试时刷出来的记录
npx wrangler d1 execute visitors --remote \
  --command "DELETE FROM visits WHERE city = 'Singapore'"

# 全部清零重来
npx wrangler d1 execute visitors --remote --command "DELETE FROM visits"
```

## 已知限制与坑

- **免费额度**：Workers 每天十万次请求量级，D1 的读写额度也够个人主页用。
  具体数字 Cloudflare 会调整，部署前去官方文档核一下当前值。
- **`/api/visitors` 让访客的浏览器缓存 5 分钟**（`max-age=300`），所以同一个人刚记的访问不会立刻出现在地图上。
  这不是边缘缓存，挡不住刷接口：Worker 的响应不会自动进 Cloudflare 的缓存，要像 `/api/stars` 那样自己存取才行。
  想改时长就动 Worker 里的 `max-age`。
- **同一浏览器 24 小时内只记一次**，靠 `localStorage` 判断。这个判断在客户端、
  能被绕过，但对个人主页足够。
- **`worker/` 目录会被 GitHub Pages 公开**（仓库根目录整个作为站点发布），
  也就是说 `caozhijun.top/worker/wrangler.toml` 是能被访问到的。里面没有密钥
  （`database_id` 只是标识符，读写仍需 API token），但如果不想让它公开，
  可以把 `worker/` 加进 `.gitignore` 并单独存一份，或者移到另一个私有仓库。
- **爬虫也会被计数**。Worker 没有做 UA 过滤，搜索引擎抓取会落进
  某个数据中心所在的城市。想过滤就在 `/api/visit` 里加一层判断，
  不过前端是用 fetch 发的 POST，大多数爬虫不执行 JS，实际影响很小。

## GitHub star 数（/api/stars）

同一个 Worker 还提供 `/api/stars?repo=owner/name`，页面上带
`data-gh-stars="owner/name"` 的链接会显示 `★ 147`。仓库必须在
`worker/src/index.js` 的 `STAR_REPOS` 白名单里。

### 必须配 GITHUB_TOKEN

不配也能跑，但**基本等于不能用**：GitHub 对未认证请求按**出口 IP** 限流，
每小时 60 次；Cloudflare Workers 的出口 IP 被大量 Worker 共用，这 60 次
常常早被别人耗尽，接口会一直拿到 403。上线后第一天就踩到了。

配置：

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token
2. Repository access 选 **Public Repositories (read-only)**，
   Permissions **一项都不用勾**（读公开仓库的 star 数不需要任何权限）
3. 过期时间按喜好（最长一年，到期要回来换）
4. Cloudflare → Worker → Settings → **Variables and Secrets** → Add →
   类型选 **Secret**，名字 `GITHUB_TOKEN`，值粘 token

认证后按 token 计额度，每小时 5000 次，与出口 IP 无关。

### 失败时的行为

Worker 会在边缘缓存里另存一份"上次成功的数"，保留 30 天。GitHub 拒绝时
返回那个旧数（响应里带 `"stale": true`），10 分钟后再重试。
只有从来没成功过的时候才返回 `{"stars": null}`，此时前端只显示 `Github`。

排查时看响应头 `x-upstream`，它是 Worker 从 GitHub 拿到的状态码：
`403` 就是限流，`404` 是仓库不公开或名字错了。`x-auth` 是 `token` 或 `none`，表示 Worker 有没有读到 `GITHUB_TOKEN`。

```bash
curl -si "https://caozhijun.top/api/stars?repo=showlab/Show-Harness" | grep -iE "x-upstream|x-auth|^\{"
```
