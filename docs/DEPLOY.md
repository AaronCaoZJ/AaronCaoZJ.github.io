# 部署与大陆访问

## 现状与目标

原架构：`caozhijun.top` → Cloudflare（仅 DNS 解析）→ `ghs.googlehosted.com` → Google Sites。
Google Sites 绑定自定义域名时证书由 Google 签发，Cloudflare 必须设为 DNS only（灰云），
流量最终直连 Google 服务器 —— **在中国大陆完全不可访问**，不是慢的问题。

目标分两步，两步共用同一份静态文件，换托管不需要改任何页面代码：

| 阶段 | 架构 | 成本 | 大陆体验 |
|---|---|---|---|
| 第一步 | GitHub Pages + Cloudflare 橙云代理 | ¥0 | 1–5 秒可打开，电信/联通尚可，移动较差 |
| 第二步 | 备案 + 阿里云 OSS/CDN，境内外双线解析 | ~¥200/年 + 备案 2–3 周 | 秒开，稳定 |

**硬性约束**：任何使用中国大陆境内节点的 CDN 都要求域名 ICP 备案，无合规绕过方式。
Cloudflare 的大陆节点（China Network）仅 Enterprise 计划开放，且同样要求备案。

---

## 第一步：GitHub Pages 上线（今天可完成）

### 1. 建仓库并推送

在 GitHub 新建**公开**仓库，名字必须是 `AaronCaoZJ.github.io`
（用户级 Pages 仓库，站点直接挂在域名根路径；换成别的名字会变成 `/仓库名/` 子路径）。

```bash
cd /Users/aaroncao/Code/homepage
git remote add origin git@github.com:AaronCaoZJ/AaronCaoZJ.github.io.git
git push -u origin main
```

### 2. 开启 Pages

仓库 **Settings → Pages**：

- **Source**：`Deploy from a branch`
- **Branch**：`main`，目录 `/ (root)`

保存后 1–2 分钟，`https://aaroncaozj.github.io` 应能打开。**先确认这个地址正常再往下走。**

### 3. 绑定自定义域名（顺序很关键）

同一页面的 **Custom domain** 填 `caozhijun.top` → Save。

> 仓库里已有 `CNAME` 文件（内容 `caozhijun.top`），GitHub 会自动识别。
> 若想用 `www.caozhijun.top` 作主域，改这个文件的内容即可。

⚠️ **这一步必须在 Cloudflare 处于灰云（DNS only）时做**，见下节。

---

## Cloudflare DNS 配置

### 1. 删除指向 Google 的旧记录

Cloudflare 控制台 → `caozhijun.top` → **DNS**，删除所有指向
`ghs.googlehosted.com` 的 CNAME 记录。

顺手去 Google Sites 后台把自定义域名解绑，避免以后自己混淆。

### 2. 添加指向 GitHub 的记录

| 类型 | 名称 | 目标 | 代理状态 |
|---|---|---|---|
| CNAME | `@` | `aaroncaozj.github.io` | 先**灰云** |
| CNAME | `www` | `aaroncaozj.github.io` | 先**灰云** |

> Cloudflare 支持 CNAME flattening，根域名（`@`）可以直接用 CNAME，
> 比配 4 条 A 记录更好——GitHub 换 IP 时会自动跟随。

### 3. ⚠️ 证书签发顺序（最容易踩的坑）

GitHub Pages 要给自定义域名签发 Let's Encrypt 证书，必须能直接验证域名。
**开着橙云代理时 GitHub 验证不到**，`Enforce HTTPS` 会一直灰着点不动。

正确顺序：

1. Cloudflare 两条记录设为**灰云（DNS only）**
2. 在 GitHub Pages 填好自定义域名，**等到 `Enforce HTTPS` 变为可勾选并勾上**
   （通常几分钟到半小时，页面会显示证书已签发）
3. 回 Cloudflare 把两条记录切换为**橙云（Proxied）**
4. **SSL/TLS → 概览**，加密模式必须选 **Full** 或 **Full (strict)**

> 第 4 步不能选 **Flexible**：GitHub Pages 强制 HTTPS 跳转，而 Flexible 模式下
> Cloudflare 用 HTTP 回源，会造成**无限重定向**，页面直接打不开。

### 4. 建议开启

- **SSL/TLS → 边缘证书 → Always Use HTTPS**：开
- **速度 → 优化 → Brotli**：开

---

## 第二步：ICP 备案（2–3 周，可与第一步并行）

域名已在阿里云注册，省掉了域名转入这一步。注意
**域名实名认证 ≠ ICP 备案**，前者你买域名时已完成，后者是给「网站」备案。

### 需要准备

- 国内身份证
- 能接电话、能收短信的国内手机号
- **一台中国大陆境内服务器作为接入主体**：阿里云轻量应用服务器最低规格即可，
  必须**包月 3 个月以上**才有备案资格。备案通过后这台机器可以闲置，
  站点实际放 OSS。

### 流程

1. 阿里云买轻量应用服务器（选中国大陆地域，不要选香港/新加坡）
2. 阿里云 App 或控制台 → **备案** → 首次备案
3. 填主体信息（个人）+ 网站信息
   - 网站名称**不要**带「科技」「工作室」等企业化词汇，个人主页/博客类最易过
   - 服务内容选「个人主页」或「博客」
4. 用阿里云 App 完成**人脸核验**（人在境外也能做）
5. 阿里云初审（1–2 个工作日）→ 管局审核（7–20 个工作日，各省不同）
6. 拿到备案号后，**必须**在页面底部放备案号并链接到 `https://beian.miit.gov.cn/`

在 `index.html` 和 `gallery.html` 的 `<footer>` 里加：

```html
<span><a href="https://beian.miit.gov.cn/" rel="noopener">浙ICP备XXXXXXXX号</a></span>
```

> 备案审核期间，管局可能会访问域名做检查。部分省份要求备案期间网站不可访问，
> 保险起见可在此期间暂时不要让国内服务器提供内容。

### 备案通过后

1. **阿里云 OSS**：新建 Bucket（华东/华北），开启「静态网站托管」，
   索引文档设为 `index.html`，把本仓库文件全部上传
2. **阿里云 CDN**：加速域名填 `caozhijun.top`，源站选上面的 OSS Bucket
3. **NS 迁回阿里云**：在阿里云域名控制台把 DNS 服务器改回阿里云云解析
   （Cloudflare 免费版不支持按地理线路分流，这一步是双线的前提）
4. **配置双线解析**：阿里云云解析 → 添加两条同名记录，线路分别选
   - **境内** → 指向阿里云 CDN 的 CNAME
   - **境外（默认）** → 指向 `aaroncaozj.github.io`

这样大陆访客走国内 CDN 秒开，海外访客走 GitHub Pages，两边内容同源。

> 每次更新站点，除了 `git push`，还要同步一份到 OSS
> （`ossutil cp -r . oss://bucket/ -u`），并在 CDN 控制台刷新缓存。

---

## 常见问题

**改了内容但线上没变**
浏览器和 Cloudflare 都有缓存。先用无痕窗口验证；仍是旧的就去
Cloudflare **缓存 → 清除缓存 → 清除所有内容**。

**`Enforce HTTPS` 一直点不了**
橙云代理挡住了 GitHub 的域名验证。切回灰云，等证书签发成功再切回橙云。

**页面打开就无限跳转**
Cloudflare SSL/TLS 模式是 Flexible，改成 Full。

**大陆访问仍然很慢**
第一步方案的固有上限——流量要跨境。只有走完备案上国内 CDN 才能根本解决。
