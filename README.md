# caozhijun.top — 个人主页

纯静态站点，**零构建**：改完 HTML 直接 push，GitHub Pages 自动上线。
不依赖 Jekyll、Node、Ruby，不引用任何外部 CDN 或 Google Fonts
（后者在中国大陆不可达，会阻塞渲染）。

## 目录结构

```
.
├── index.html          主页：About / Research / News / Publications / Projects / Experience / Education / Awards
├── gallery.html        相册页（骨架已就绪，图片待补）
├── CNAME               GitHub Pages 自定义域名，内容为 caozhijun.top
├── .nojekyll           告诉 GitHub Pages 不要跑 Jekyll，直接发布原始文件
└── assets/
    ├── css/style.css   全站样式，配色沿用简历 LaTeX 的莫兰迪色板
    ├── fonts/          自托管字体（Inter + Newsreader 可变字体，167 KB）
    ├── img/
    │   ├── avatar.jpg      头像（640×640）
    │   ├── pub/            论文配图，宽 900px
    │   ├── write/          Writing & Media 配图，宽 900px
    │   ├── icon/           联系方式图标，64×64 透明 PNG
    │   ├── gallery/        相册图片目录（当前为空）
    │   └── src/            未压缩源素材，本地保留、不进 git
    └── pdf/
        ├── CV_ZhijunCao.pdf            中文简历（172 KB）
        ├── BGTree_ChinaCampus_2025.pdf 《大学生》报道抽印（459 KB）
        └── src/                        未压缩源文件，不进 git
```

## 字体

标题 **Inter**、正文 **Newsreader**，均为**自托管**可变字体（`assets/fonts/`，合计 167 KB）。

不使用 Google Fonts CDN —— `fonts.googleapis.com` 在中国大陆不可达，
会阻塞整个页面的渲染。自托管后全球访客看到同一套排版。

Newsreader 原本带 `opsz`（光学尺寸）轴，页面只在 14–16.5px 的正文用它，
因此用 fontTools 把该轴固定为 16，体积从 273 KB 降到 120 KB：

```bash
python3 -c "
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
f = TTFont('Newsreader-normal.woff2')
instancer.instantiateVariableFont(f, {'opsz': 16}, inplace=True)
f.flavor = 'woff2'; f.save('Newsreader-normal.woff2')"
```

中文（"曹植竣""报告树"等）走系统字体：苹果设备落到苹方，Windows 落到微软雅黑。
页面上中文只有寥寥几个词，为此下载 1–3 MB 中文字库对大陆访问得不偿失。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

直接双击 HTML 用 `file://` 打开也基本正常，但用 server 才能准确复现线上路径行为。

## 日常维护

| 要改什么 | 改哪里 |
|---|---|
| 加一条 News | `index.html` 的 `<ul class="news">`，最新的放最上面 |
| 折叠旧 News | 给 `<li>` 加 `class="news-hidden" hidden` |
| 加论文 | 复制一整个 `<article class="pub">` 块 |
| 论文 teaser 图 | 见下方「从论文 PDF 裁 teaser」 |
| 换简历 | 覆盖 `assets/pdf/CV_ZhijunCao.pdf`，文件名保持不变 |
| 配色 | `assets/css/style.css` 顶部的 CSS 变量（仅浅色一套） |
| 字体 | 同文件顶部的 `@font-face` 与 `--sans` / `--serif` |
| News 默认显示条数 | 给 `<li>` 加/去 `class="news-hidden" hidden` |

### 从论文 PDF 裁 teaser

```bash
python3 - <<'PY'
import pymupdf
doc  = pymupdf.open("paper.pdf")
page = doc[1]                      # teaser 通常在第 2 页，纯文字首页则试 doc[0]
b    = [x["bbox"] for x in page.get_text("dict")["blocks"] if x["type"] == 1]
top  = [x for x in b if x[1] < page.rect.height * 0.55] or b
clip = pymupdf.Rect(min(x[0] for x in top), min(x[1] for x in top),
                    max(x[2] for x in top), max(x[3] for x in top))
page.get_pixmap(matrix=pymupdf.Matrix(2.6, 2.6), clip=clip).save("out.png")
PY
magick out.png -resize 900x -quality 86 assets/img/pub-xxx.jpg
```

### 压缩简历 PDF

LaTeX 生成的 PDF 内嵌高分辨率照片，动辄 3 MB 以上，对大陆访客是明显负担。
降采样到 144 dpi 视觉无损，体积可降 95%：

```bash
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dNOPAUSE -dQUIET -dBATCH \
   -dDownsampleColorImages=true -dColorImageResolution=144 \
   -dColorImageDownsampleType=/Bicubic -dDownsampleGrayImages=true \
   -dGrayImageResolution=144 -dAutoFilterColorImages=false \
   -dColorImageFilter=/DCTEncode -dEmbedAllFonts=true -dSubsetFonts=true \
   -sOutputFile=CV_ZhijunCao.pdf 原始简历.pdf
```

### 添加相册图片

图片放进 `assets/img/gallery/`，压到长边 1600px 以内：

```bash
magick input.jpg -resize 1600x1600\> -quality 82 assets/img/gallery/name.jpg
```

然后在 `gallery.html` 里删掉 `.empty` 占位块、取消 `.grid` 的注释，逐条加 `<figure>`。

## 搜索引擎收录

站内已备好 `robots.txt`、`sitemap.xml` 与 JSON-LD 结构化数据（`index.html` 的 `<head>`）。
新增页面后记得往 `sitemap.xml` 里补一条 `<url>`。

提交入口与外链建议见 [docs/DEPLOY.md](docs/DEPLOY.md) 的「搜索引擎收录」一节。

## 部署

完整的 GitHub Pages / Cloudflare / ICP 备案流程见 [docs/DEPLOY.md](docs/DEPLOY.md)。

推到 `main` 分支即自动发布，通常 1–2 分钟生效。

```bash
git add -A && git commit -m "update" && git push
```

浏览器有缓存，看不到变化时用无痕窗口验证。

## 待补内容

- `index.html` 里 Google Scholar 链接是占位符 `YOUR_SCHOLAR_ID`，需替换
- 论文作者列表目前写的是 `et al.`，需补全合作者姓名
