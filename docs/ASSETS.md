# 素材维护

## 简历与文章 PDF：原样发布，不压缩

`CV_ZhijunCao.pdf` 与 `BGTree_ChinaCampus_2025.pdf` **一律用原件逐字节替换**，
不要用 gs / PyMuPDF 等任何工具重新压缩或重写 —— 体积大就大。
以前按 144 dpi 降采样过，简历头像被压到 124×124，点开明显糊。

```bash
cp 原始简历.pdf assets/pdf/CV_ZhijunCao.pdf
cmp 原始简历.pdf assets/pdf/CV_ZhijunCao.pdf   # 无输出即一致
```

`assets/img/write/write-bgtree.jpg` 同理，用原图，不缩不压。
替换后照常更新 `?v=` 版本串，避免浏览器和 Cloudflare 继续给旧文件。
简历的链接有三处，见 [DEPLOY.md](DEPLOY.md) 最后一节。

## 图片规格

| 目录 | 内容 |
|---|---|
| `assets/img/avatar.jpg` | 头像，640×640；原图放 `src/`。换图后把首页里头像的三处地址（`<img>`、`og:image`、JSON-LD 的 `image`）换成同一个新的 `?v=`——Google 按地址缓存图片，地址不变搜索结果里的照片可能几周都不更新；再把 `sitemap.xml` 首页的 `lastmod` 改成当天，构图变了还要改它的 `data-fx-face`（两眼中点占宽高的比例，去噪动画的网格和脸部那一层都以它为中心），并看一眼 index.html 里 `FACE_RX` / `FACE_RY` 的椭圆是否还罩得住脸（见 `buildMask`） |
| `assets/img/pub/` | 论文配图，宽 660px（缩略图只显示 218px，三倍屏也够），原图放 `src/` |
| `assets/img/write/` | Writing & Media 配图，宽 900px（bgtree 用原图） |
| `assets/img/icon/` | 联系方式图标，64×64 透明 PNG |
| `assets/img/logo/` | 实习、教育经历的机构 logo |
| `assets/img/gallery/` | 相册，见下 |
| `assets/**/src/` | 未压缩的源素材，只留本地，不进 git |

## 从论文 PDF 裁 teaser

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
magick out.png -resize 660x -strip -interlace JPEG -quality 86 assets/img/pub/pub-xxx.jpg
```

## 相册图片

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

然后在 `gallery/index.html` 对应的轨道里加一条 `<figure>`，`data-lg-hi` 指向大图，`width` / `height` 写照片的比例
（列表模式靠它分行）：

```html
<figure><img src="/assets/img/gallery/560/lake-17.webp?v=20261002order" data-lg-hi="/assets/img/gallery/1120/lake-17.webp?v=20261002order" width="840" height="560" alt="" loading="lazy"></figure>
```

错落的高度由脚本按序号自动标，照片数不必凑 4 的倍数。增减照片后按比例调整该栏的 `--dur`，保持滚动速度不变。
同名文件换了内容（重新导出、重排编号）时，把页面里这些地址的 `?v=` 版本串统一换掉，
否则看过旧页面的访客会拿到缓存的旧图，跑马灯和放大镜还可能对不上同一张照片。
换原图时把新文件放进 `src/`，改链接指向它（`ln -sf 新原图.jpg lake-13.jpg`），重新导出即可；
宽高比变了的话，顺手按比例微调该栏的 `--dur`。
