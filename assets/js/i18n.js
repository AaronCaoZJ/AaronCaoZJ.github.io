/* EN/ZH switch: English stays in the HTML, Chinese lives here; no external services. */
(function () {
  'use strict';
  var zh = {
  "nav.home": "🏠 首页",
  "nav.biography": "简介",
  "nav.publications": "发表物",
  "nav.experiences": "经历",
  "nav.gallery": "🖼️ 相册",
  "footer.partner": "认识一下我的伴侣 <span class=\"emo\">👉</span> <a href=\"https://xiangweijing.top\" data-fallback=\"https://xwj0811.github.io\"><img src=\"/assets/img/icon/xiangweijing.svg?v=20261123i26\" alt=\"\" width=\"26\" height=\"26\" loading=\"lazy\">向伟静</a>",
  "footer.copyright": "版权所有 © 曹植竣",
  "footer.updated": "最后更新：2026 年 11 月",
  "home.title": "曹植竣 Aaron Zhijun Cao",
  "home.description": "Aaron Zhijun Cao（曹植竣，caozhijun）— 新加坡国立大学电气工程硕士生，Show Lab；Mikomiko AIGC 算法研究员（实习）。研究方向：扩散模型、通用机器人策略与具身智能体。浙江大学本科。",
  "hero.name": "曹植竣 <span class=\"cn\" lang=\"en\">Aaron Zhijun Cao</span>",
  "hero.role": "新加坡国立大学 Show Lab · 硕士研究生",
  "contact.email": "<img src=\"assets/img/icon/email.png\" alt=\"\" width=\"15\" height=\"15\">邮箱",
  "contact.scholar": "<img src=\"assets/img/icon/googlescholar.png\" alt=\"\" width=\"15\" height=\"15\">谷歌学术",
  "mail.label": "邮箱地址",
  "mail.copy": "复制",
  "contact.cv": "<img src=\"assets/img/icon/cv.png\" alt=\"\" width=\"15\" height=\"15\">英文简历",
  "avatar.replay": "点击重播去噪动画",
  "avatar.name": "Aaron Zhijun Cao",
  "section.biography": "个人简介",
  "bio.current": "我目前在新加坡国立大学攻读电气工程硕士学位，在 <a href=\"https://github.com/showlab\">Show Lab</a> 从事<strong>机器人学习</strong>研究，导师为 <a href=\"https://sites.google.com/view/showlab\">Mike Zheng Shou</a>。我的研究兴趣包括<strong>通用机器人策略</strong>、<strong>具身智能体</strong>和<strong>扩散模型</strong>。",
  "bio.mikomiko": "同时，我在 <strong>Mikomiko</strong> 担任 AIGC 算法研究员（实习），从事智能体驱动的图像生成与编辑模型研究。",
  "bio.previous": "此前，我在<strong>浙江大学</strong>获得自动化专业工学学士学位，早期研究主要围绕机器人系统控制展开。",
  "section.news": "最新动态",
  "news.item0": "<span class=\"emo\">📊</span> 发布了两个关于操作机器人的基准：<a href=\"https://showlab.github.io/RUIBench/\">RUIBench</a> 和 <a href=\"https://showlab.github.io/MRBench/\">MRBench</a>。",
  "news.item1": "<span class=\"emo\">🦾</span> 发布了 <a href=\"https://showlab.github.io/Show-Harness/\"><span class=\"shx\"><span>S</span><span>h</span><span>o</span><span>w</span></span>-Harness</a>，以及一篇关于多模态具身智能体的<a href=\"https://arxiv.org/abs/2610.30108\">综述</a>。",
  "news.item2": "<span class=\"emo\">🎉</span> 两篇论文被 <strong>CoRL 2026</strong> 接收。",
  "news.item3": "<span class=\"emo\">🐈‍⬛</span> 以 AIGC 算法研究员（实习）身份重新加入 <strong>Mikomiko</strong>。",
  "news.item4": "<span class=\"emo\">📸</span> 以硕士研究生身份加入<strong>新加坡国立大学 Show Lab</strong>。",
  "news.item5": "<span class=\"emo\">🎉</span> 一篇论文发表于 <strong>CAC 2024</strong>。",
  "news.item6": "<span class=\"emo\">🎓</span> 从<strong>浙江大学</strong>毕业，获得自动化专业工学学士学位。",
  "section.publications": "学术论文 <span class=\"cofirst\">（<span class=\"star\">*</span>共同第一作者，<span class=\"star\">†</span>通讯作者）</span>",
  "video.demo": "Show-Harness 演示视频",
  "video.ruibench": "RUIBench 演示视频",
  "paper.title0": "<span class=\"shx\"><span>S</span><span>h</span><span>o</span><span>w</span></span>-Harness：视觉语言模型智能体即可“玩转”机器人",
  "paper.title1": "多模态具身智能体综述：以统一的能力视角贯通计算机操作与机器人操作",
  "paper.title2": "成败之界：通过失败边界学习提升视觉–语言–动作模型的鲁棒性",
  "paper.title3": "去伪存真：利用合成机器人视频进行几何引导的 VLA 适配",
  "paper.title4": "从“最后一公里”的失败中学习精细机器人操作",
  "paper.title5": "大语言模型驱动的嵌入式微处理器实验报告智慧评阅系统",
  "paper.title6": "基于模仿学习的家庭环境机械臂技能训练",
  "paper.more": "全部论文",
  "paper.title7": "RUIBench：用什么接口操作机器人才好？",
  "paper.title8": "MRBench：异构多机器人操作中的物理必要性推理基准",
  "paper.venue0": "arXiv 预印本 <span class=\"dot\">·</span> 2026.09",
  "paper.venue1": "arXiv 预印本 <span class=\"dot\">·</span> 2026.09",
  "paper.venue2": "<b>2026 机器人学习会议（CoRL）</b><span class=\"dot\">·</span> 2026.05",
  "paper.venue3": "<b>2026 机器人学习会议（CoRL）</b><span class=\"dot\">·</span> 2026.05",
  "paper.venue4": "CCF-A 类会议审稿中 <span class=\"dot\">·</span> 2026.05",
  "paper.venue5": "<b>实验室研究与探索</b> <span class=\"dot\">·</span> 2026.02",
  "paper.venue6": "<b>2024 中国自动化大会（CAC），EI</b> <span class=\"dot\">·</span> 2024.11",
  "paper.venue7": "arXiv 预印本 <span class=\"dot\">·</span> 2026.11",
  "paper.venue8": "arXiv 预印本 <span class=\"dot\">·</span> 2026.11",
  "link.paper": "论文",
  "link.page": "项目主页",
  "link.models": "模型",
  "link.data": "数据",
  "link.blogpage": "博客",
  "paper.pending": "论文链接待更新",
  "paper.funding": "获国家自然科学基金资助（项目编号：U21A20485）",
  "section.writing": "写作与媒体",
  "writing.diffusion": "基于 Julia 实现连续时间扩散模型：NUS EE5311 课程博客",
  "writing.tree": "报告树：浙大玉泉校门前老雪松的纪实报道",
  "writing.course": "NUS EE5311 课程博客 <span class=\"dot\">·</span> 2026.03",
  "writing.magazine": "<b>《大学生》</b><span class=\"dot\">·</span> 2025.06",
  "section.internship": "实习经历",
  "internship.mikomiko": "Mikomiko Pte Ltd",
  "internship.innomotion": "InnoMotion Co. Ltd · 上海 · 研发部",
  "internship.dates": "2025.08\u00a0–\u00a02026.02 · 2026.06\u00a0–\u00a0至今",
  "internship.ai": "AIGC 算法研究员",
  "internship.ml": "机器学习算法工程师",
  "internship.lab": "<a href=\"https://kokorolab.net/en/home\"><strong>Kokoro Lab</strong></a> — 让智能体执笔，让想象跃然成画",
  "internship.more": "<span class=\"pst\">了解更多 <span class=\"handle\" tabindex=\"0\" data-h=\"@otakufans_net\"></span></span>",
  "section.education": "教育与校园经历",
  "education.title0": "新加坡国立大学",
  "education.title1": "浙江大学",
  "education.title2": "浙江省可再生能源电气技术与系统重点实验室",
  "education.title3": "融媒体中心学生记者团",
  "education.title4": "基于三菱 RV-4FRL-D 机械臂的咖啡冲煮机器人设计",
  "education.current": "2025.08 – 至今",
  "education.detail0": "电气工程硕士 · Show Lab · 导师：寿政副教授",
  "education.detail1": "自动化专业工学学士 · 电气工程学院",
  "education.detail2": "研究助理 · 导师：于淼教授",
  "education.detail3": "副部长、顾问",
  "education.detail4": "<em><strong>年度优秀校园新闻奖</strong>（人民网 2023）· <strong>年度好新闻奖</strong>（浙江大学 2023；浙大传媒学院 2025）</em>",
  "education.detail5": "项目负责人 · <em>获浙江省新苗人才计划资助（项目编号：2022R401035）</em>",
  "contact.invitation": "<span class=\"sent\">想多了解我一些？可以逛逛我的 <span class=\"emo\">👉</span> <a href=\"/gallery/\"><strong><span class=\"emo\">🖼️</span> 相册</strong></a>。</span><span class=\"sent\">也欢迎<a href=\"mailto:aaroncaozj@gmail.com\">发邮件</a>和我聊聊研究、谈谈合作，闲聊也好 <span class=\"emo\">🤝</span>。</span>",
  "gallery.title": "相册 · Aaron Zhijun Cao",
  "gallery.description": "Aaron Zhijun Cao（曹植竣，caozhijun）的摄影记录：浙江大学校园、西湖与旅途中的风景。",
  "gallery.heading": "🖼️ 相册",
  "gallery.loupe": "放大镜",
  "gallery.viewLabel": "显示模式",
  "gallery.viewFilm": "🎞️ 胶卷模式",
  "gallery.viewList": "📋 列表模式",
  "gallery.welcome": "<strong>欢迎来到我的相册！</strong>",
  "gallery.intro": "摄影是我观察世界的方式之一。这里记录了一些令我难忘的地方、人物与瞬间，希望你也会喜欢。",
  "gallery.campus": "求是园",
  "gallery.campusWhere": "摄于浙江大学",
  "gallery.at.yuquan1": "玉泉教一",
  "gallery.at.yuquan2": "玉泉教二",
  "gallery.at.haining": "海宁中心湖",
  "gallery.at.yuquan6": "玉泉教六",
  "gallery.at.qiushi": "紫金港求是大讲堂",
  "gallery.at.sakura": "玉泉邵科馆东侧樱花",
  "gallery.at.dianji": "玉泉电机楼",
  "gallery.at.graduation": "紫金港雨中<span class=\"nw\"><span class=\"emo\">🎓</span>典礼</span>",
  "gallery.at.mao": "玉泉毛像",
  "gallery.at.east3": "紫金港东三长廊",
  "gallery.at.library": "紫金港主图",
  "gallery.at.baidi": "白堤桃花",
  "gallery.at.taiziwan": "太子湾树下长椅",
  "gallery.at.tianmushan": "天目山路楼宇",
  "gallery.at.jiuxi": "九溪烟树池中红叶",
  "gallery.at.milkyway": "西湖银河",
  "gallery.at.gushan": "孤山路柳树",
  "gallery.at.canal": "京杭大运河桥洞",
  "gallery.at.huagang": "花港观鱼濠上乐",
  "gallery.at.qingshan": "青山湖水上森林",
  "gallery.at.liangzhu": "良渚遗址公园",
  "gallery.at.hupao": "<span class=\"nw\"><span class=\"emo\">🐯</span>跑</span>公园旗袍",
  "gallery.at.faxi": "法喜寺锦鲤池",
  "gallery.at.lingfeng": "灵峰探梅来鹤亭",
  "gallery.at.qianwang": "钱王祠梅花",
  "gallery.at.beishan": "北山街法国梧桐",
  "gallery.at.moon": "西湖圆月",
  "gallery.at.jeju": "济州岛水族馆",
  "gallery.at.bund": "上海外滩",
  "gallery.at.nanao1": "南澳岛灯塔",
  "gallery.at.xianggong": "桂林相公山",
  "gallery.at.nalati": "新疆<span class=\"nw\">那拉提<span class=\"emo\">👒</span></span>",
  "gallery.at.jejucoast": "济州岛海岸",
  "gallery.at.crescent": "杭州新月树影",
  "gallery.at.tianshan": "伊犁天山花海",
  "gallery.at.shichirigahama": "镰仓七里滨海岸",
  "gallery.at.hongcun": "黟县宏村",
  "gallery.at.fuji": "富士山晚霞",
  "gallery.at.siming": "宁波四明湖",
  "gallery.at.tokyotower": "东京塔晨光",
  "gallery.lake": "一枕湖山",
  "gallery.lakeWhere": "摄于中国杭州",
  "gallery.more": "在路上",
  "nav.label": "主导航"
};
  var root = document.documentElement;
  var toggle = document.querySelector('.language-toggle');
  var badge = toggle && toggle.querySelector('.language-badge');
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var entries = [];
  var pagePaths = { '/': true, '/index.html': true, '/gallery/': true, '/gallery/index.html': true };
  ['', 'content', 'title', 'alt', 'aria-label'].forEach(function (attribute) {
    var marker = 'data-i18n' + (attribute ? '-' + attribute : '');
    document.querySelectorAll('[' + marker + ']').forEach(function (element) {
      var key = element.getAttribute(marker);
      if (!Object.prototype.hasOwnProperty.call(zh, key)) return;
      entries.push({ element: element, attribute: attribute, key: key,
        english: attribute ? element.getAttribute(attribute) : element.innerHTML });
    });
  });

  // Both labels share one grid cell and cross-fade in place; CSS takes the hidden one out of layout so
  // the link width follows the current language (.language-label in style.css).
  function pairedLabels(element, english, chinese) {
    element.textContent = '';
    ['en', 'zh-CN'].forEach(function (language) {
      var label = document.createElement('span');
      label.className = 'language-label';
      label.lang = language;
      label.textContent = language === 'en' ? english : chinese;
      element.appendChild(label);
    });
  }
  entries.forEach(function (entry) {
    if (!entry.attribute && entry.element.matches('.nav a')) {
      entry.navigation = true;
      entry.element.classList.add('language-pair');
      pairedLabels(entry.element, entry.element.textContent, zh[entry.key]);
    }
  });

  // Language lives in the URL, not browser storage: a fresh visit is English, ?lang=zh-CN carries
  // Chinese across pages, and links stay shareable.
  function withLanguage(href, language) {
    var url = new URL(href, window.location.href);
    if (language === 'zh-CN') url.searchParams.set('lang', 'zh-CN');
    else url.searchParams.delete('lang');
    return url.pathname + url.search + url.hash;
  }

  function syncLanguageUrls(language) {
    // Translating via innerHTML creates new link nodes, so rescan the DOM each time
    // instead of reusing references from init.
    document.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      try {
        var url = new URL(href, window.location.href);
        if (url.origin === window.location.origin && pagePaths[url.pathname]) {
          link.setAttribute('href', withLanguage(href, language));
        }
      } catch (error) { /* leave unparseable links alone */ }
    });
    if (!window.history || !window.history.replaceState) return;
    var current = new URL(window.location.href);
    if (language === 'zh-CN') current.searchParams.set('lang', 'zh-CN');
    else current.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '',
      current.pathname + current.search + current.hash);
  }

  function apply(language) {
    var chinese = language === 'zh-CN';
    root.lang = chinese ? 'zh-CN' : 'en';
    entries.forEach(function (entry) {
      var value = chinese ? zh[entry.key] : entry.english;
      if (entry.attribute) entry.element.setAttribute(entry.attribute, value);
      // Only trusted, repository-owned translations may contain markup.
      else if (!entry.navigation) entry.element.innerHTML = value;
    });
    document.querySelectorAll('.nav a .language-label').forEach(function (label) {
      label.setAttribute('aria-hidden', String(label.lang !== root.lang));
    });
    if (toggle) {
      // The target language goes in the badge and in title/aria-label, written in that language (lang matches)
      toggle.lang = chinese ? 'en' : 'zh-CN';
      toggle.setAttribute('aria-label', chinese ? 'Switch to English' : '切换到中文');
      toggle.title = toggle.getAttribute('aria-label');
      if (badge) badge.textContent = chinese ? 'EN' : '中';
      toggle.hidden = false;
    }
    syncLanguageUrls(root.lang);
    document.dispatchEvent(new CustomEvent('languagechange', { detail: root.lang }));
  }

  var initial = new URL(window.location.href).searchParams.get('lang') === 'zh-CN'
    ? 'zh-CN' : 'en';
  apply(initial);

  var switching = false;
  var surfaces = [].slice.call(document.querySelectorAll('main, footer'));
  function fade(from, to, duration) {
    var animations = surfaces.map(function (element) {
      return element.animate([{ opacity: from }, { opacity: to }], {
        duration: duration, easing: 'ease-in-out', fill: 'forwards'
      });
    });
    return {
      finished: Promise.all(animations.map(function (animation) {
        return animation.finished.catch(function () {});
      })),
      clear: function () { animations.forEach(function (animation) { animation.cancel(); }); }
    };
  }
  if (toggle) toggle.addEventListener('click', async function () {
    if (switching) return;
    switching = true;
    var language = root.lang === 'zh-CN' ? 'en' : 'zh-CN';
    var outgoing, incoming;
    try {
      var animate = !(reducedMotion && reducedMotion.matches) &&
        surfaces.length && surfaces.every(function (element) { return typeof element.animate === 'function'; });
      if (animate) {
        outgoing = fade(1, 0, 100);
        await outgoing.finished;
      }
      apply(language);
      if (animate) {
        outgoing.clear();
        incoming = fade(0, 1, 180);
        await incoming.finished;
      }
    } finally {
      if (outgoing) outgoing.clear();
      if (incoming) incoming.clear();
      switching = false;
    }
  });
})();
