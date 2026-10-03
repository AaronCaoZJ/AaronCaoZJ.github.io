# caozhijun.top — 个人主页

纯静态站点，**零构建**：改完 HTML 直接 push，GitHub Pages 自动上线。
不依赖 Jekyll、Node、Ruby，不引用任何外部 CDN 或 Google Fonts
（后者在中国大陆不可达，会阻塞渲染）。

## 目录结构

```
.
├── index.html          主页：About / Research / News / Publications / Projects / Experience / Education / Awards
├── gallery/index.html  相册页，URL 为 /gallery/
├── CNAME               GitHub Pages 自定义域名，内容为 caozhijun.top
├── .nojekyll           告诉 GitHub Pages 不要跑 Jekyll，直接发布原始文件
├── caozhijun.top.png   域名证书，本地保留、不进 git
└── assets/
    ├── css/style.css   全站样式，配色沿用简历 LaTeX 的莫兰迪色板
    ├── fonts/          自托管字体（Inter + Newsreader 可变字体，167 KB）
    ├── img/
    │   ├── avatar.jpg      头像（640×640）
    │   ├── pub/            论文配图，宽 900px
    │   ├── write/          Writing & Media 配图，宽 900px（bgtree 用原图）
    │   ├── icon/           联系方式图标，64×64 透明 PNG
    │   ├── gallery/        相册：560/ 跑马灯用（高 560px），1120/ 放大镜用（高 1120px），
    │   │                   src/ 原图（原文件名，本地保留、不进 git），campus-01.jpg 这类是指向原图的符号链接
    │   └── src/            未压缩源素材，本地保留、不进 git
    └── pdf/
        ├── CV_ZhijunCao.pdf            英文简历，原件（288 KB）
        ├── BGTree_ChinaCampus_2025.pdf 《大学生》报道抽印，原件（1.4 MB）
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

中文版使用系统中文字体：苹果设备落到苹方，Windows 落到微软雅黑。
无需额外下载大型中文字体文件；中文模式下同时调整正文行距和标题字距。

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

### 简历与文章 PDF：原样发布，不压缩

`CV_ZhijunCao.pdf` 与 `BGTree_ChinaCampus_2025.pdf` **一律用原件逐字节替换**，
不要用 gs / PyMuPDF 等任何工具重新压缩或重写 —— 体积大就大。
以前按 144 dpi 降采样过，简历头像被压到 124×124，点开明显糊。

```bash
cp 原始简历.pdf assets/pdf/CV_ZhijunCao.pdf
cmp 原始简历.pdf assets/pdf/CV_ZhijunCao.pdf   # 无输出即一致
```

`assets/img/write/write-bgtree.jpg` 同理，用原图，不缩不压。
替换后照常更新 `?v=` 版本串，避免浏览器和 Cloudflare 继续给旧文件。

### 相册图片

每张照片导出两档 WebP。原图以原文件名放在 `assets/img/gallery/src/`，再用一个按页面命名的符号链接指向它
（如 `lake-13.jpg -> 20250330-_ARC2114.jpg`），`ls -l src` 就是完整的对照表。
链接名的扩展名跟着原图走（如 `campus-02.png -> 250116_ARC copy.png`，那张星轨是 Photoshop 导出的 PNG）。

导出两档：

- `560/`：跑马灯显示用，高 560px（最高的照片框 262px，悬停放大后在 2 倍屏上约 548px）
- `1120/`：放大镜用，高 1120px，只在打开放大镜、且扫到这张照片时才下载

```bash
cd assets/img/gallery/src
for f in campus-* lake-* more-*; do n=${f%.*}
  magick "$f" -auto-orient -colorspace sRGB -depth 8 -alpha off -strip -write mpr:o +delete \
    \( mpr:o -resize 'x1120>' -quality 86 -define webp:method=6 -define webp:use-sharp-yuv=true -write ../1120/$n.webp +delete \) \
    \( mpr:o -resize 'x560>'  -quality 85 -define webp:method=6 -define webp:use-sharp-yuv=true -write ../560/$n.webp  +delete \) null:
done
```

- 不要加 `-define jpeg:size=…` 提速：ImageMagick 7 会按这个提示把小于它的图**放大**解码。
- `-strip` 会去掉 EXIF（含 GPS 定位）；在它之前先 `-auto-orient`，否则竖拍的照片会躺倒。

然后在 `gallery/index.html` 对应的轨道里加一条 `<figure>`，`data-lg-hi` 指向大图：

```html
<figure><img src="/assets/img/gallery/560/lake-17.webp?v=20261002order" data-lg-hi="/assets/img/gallery/1120/lake-17.webp?v=20261002order" alt="" loading="lazy"></figure>
```

错落的高度由脚本按序号自动标，照片数不必凑 4 的倍数。增减照片后按比例调整该栏的 `--dur`，保持滚动速度不变。
同名文件换了内容（重新导出、重排编号）时，把页面里这些地址的 `?v=` 版本串统一换掉，
否则看过旧页面的访客会拿到缓存的旧图，跑马灯和放大镜还可能对不上同一张照片。
换原图时把新文件放进 `src/`，改链接指向它（`ln -sf 新原图.jpg lake-13.jpg`），重新导出即可；
宽高比变了的话，顺手按比例微调该栏的 `--dur`。

## 搜索引擎收录

站内已备好 `robots.txt`、`sitemap.xml` 与 JSON-LD 结构化数据（`index.html` 的 `<head>`）。
新增页面后记得往 `sitemap.xml` 里补一条 `<url>`；内容有实质改动时，顺手把 `<lastmod>` 改成当天日期。

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

## 中英文切换

主页和相册共用导航右侧的圆形液态玻璃按钮：英文页显示「中」，中文页显示「EN」。
普通打开主页或相册时默认显示英文。切换中文后，当前地址和站内页面链接会加上
`?lang=zh-CN`；刷新或进入相册时继续显示中文。切回英文会移除该参数，之后的站内跳转也保持英文。
语言状态不写入浏览器存储；JavaScript 不可用时保留完整英文内容。
导航为中英文标签预留相同宽度，以淡入淡出切换文字，避免胶囊和按钮跳位。
正文切换采用 100 ms 淡出、180 ms 淡入；系统开启“减少动态效果”时直接切换。

英文原文仍在 HTML 中，中文集中在 `assets/js/i18n.js` 的 `zh` 对象中。
新增翻译时给对应元素加 `data-i18n="键名"`，并在 `zh` 中补上同名中文文案。
提示和元信息分别使用 `data-i18n-title`、`data-i18n-alt`、`data-i18n-aria-label` 和
`data-i18n-content`。翻译可包含可信的静态 HTML；请勿嵌套翻译标记，或将标记放在包含动态控件的父元素上。
动态文案（新闻展开、访客地图、GitHub 星标）监听 `languagechange` 事件更新。
中文文案中，汉字与英文、数字之间留一个半角空格（包括跨行内标签的边界），
全角标点两侧不额外留空格；纯中文链接与前后中文之间不添加空格。
