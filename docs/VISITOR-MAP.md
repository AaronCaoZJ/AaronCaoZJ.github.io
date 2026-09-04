# 访客地图部署手册

首页底部那张点阵世界地图。前端已经在仓库里跑着（默认用假数据），
这份文档只讲怎么把后端接上、让数字变成真的。

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
CREATE TABLE IF NOT EXISTS visits (city TEXT NOT NULL, country TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, n INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL, PRIMARY KEY (city, country));
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

## 前端切到真实数据

编辑 `assets/js/worldmap.js`：

```js
var USE_MOCK = true;    →    var USE_MOCK = false;
```

提交并 push。**注意 CSS/JS 被 Cloudflare 缓存 4 小时**，自己看的时候
硬刷新（Chrome `Cmd+Shift+R`）。

切换之后如果接口取不到数据，整个 Visitors 一节会**保持隐藏**——
宁可什么都不显示，也不会把假数字当成真实访问量摆出来。

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
- **`/api/visitors` 在边缘缓存 5 分钟**，所以刚记的访问不会立刻出现在地图上。
  这也顺带挡住了刷接口。想改就动 Worker 里的 `max-age`。
- **同一浏览器 24 小时内只记一次**，靠 `localStorage` 判断。这个判断在客户端、
  能被绕过，但对个人主页足够。
- **`worker/` 目录会被 GitHub Pages 公开**（仓库根目录整个作为站点发布），
  也就是说 `caozhijun.top/worker/wrangler.toml` 是能被访问到的。里面没有密钥
  （`database_id` 只是标识符，读写仍需 API token），但如果不想让它公开，
  可以把 `worker/` 加进 `.gitignore` 并单独存一份，或者移到另一个私有仓库。
- **爬虫也会被计数**。Worker 没有做 UA 过滤，搜索引擎抓取会落进
  某个数据中心所在的城市。想过滤就在 `/api/visit` 里加一层判断，
  不过前端是用 fetch 发的 POST，大多数爬虫不执行 JS，实际影响很小。
