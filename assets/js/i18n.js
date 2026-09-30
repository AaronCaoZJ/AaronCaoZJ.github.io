/* 中英文切换：英文保留在 HTML 中，中文集中维护于此；不依赖外部服务。 */
(function () {
  'use strict';
  var zh = {
  "nav.home": "🏠 首页",
  "nav.biography": "个人简介",
  "nav.news": "最新动态",
  "nav.publications": "学术论文",
  "nav.experiences": "经历",
  "nav.gallery": "🖼️ 相册",
  "footer.copyright": "Copyright © Cao Zhijun. All Rights Reserved.",
  "footer.updated": "最后更新：2026 年 9 月",
  "home.title": "曹植竣 Aaron · 个人主页",
  "home.description": "曹植竣 Aaron — 新加坡国立大学电气工程硕士生，Show Lab。研究方向：扩散模型、视觉–语言–动作模型与世界模型。浙江大学本科。",
  "hero.name": "曹植竣 <span class=\"cn\">Aaron Cao</span>",
  "hero.role": "新加坡国立大学 Show Lab · 硕士研究生",
  "hero.opportunities": "正在寻找<strong>具身基础模型 / 生成式 AI</strong> 方向的<strong>研究员 / 算法工程师</strong>岗位，同时关注<strong>博士机会</strong>。详情请见我的<a href=\"/assets/pdf/CV_ZhijunCao.pdf?v=202609291444\">英文简历</a>。",
  "contact.email": "<img src=\"assets/img/icon/email.png\" alt=\"\" width=\"15\" height=\"15\">邮箱",
  "contact.scholar": "<img src=\"assets/img/icon/googlescholar.png\" alt=\"\" width=\"15\" height=\"15\">谷歌学术",
  "contact.cv": "<img src=\"assets/img/icon/cv.png\" alt=\"\" width=\"15\" height=\"15\">英文简历",
  "avatar.replay": "点击重播去噪动画",
  "avatar.name": "曹植竣 Aaron",
  "section.biography": "个人简介",
  "bio.current": "我目前在新加坡国立大学攻读电气工程硕士学位，在 <a href=\"https://github.com/showlab\">Show Lab</a> 从事<strong>机器人学习</strong>研究，导师为 <a href=\"https://sites.google.com/view/showlab\">Mike Zheng Shou</a>。我的研究兴趣包括<strong>视觉–语言–动作模型（VLA）</strong>、<strong>世界模型</strong>和<strong>扩散模型</strong>。",
  "bio.previous": "此前，我在浙江大学获得自动化专业工学学士学位，早期研究主要围绕机器人控制展开。",
  "section.news": "最新动态",
  "news.date0": "2026 年 9 月",
  "news.date1": "2026 年 6 月",
  "news.date2": "2025 年 8 月",
  "news.date3": "2024 年 11 月",
  "news.date4": "2024 年 6 月",
  "news.item0": "🦾 发布了 <strong><span class=\"shx\"><span>S</span><span>h</span><span>o</span><span>w</span></span>-Harness</strong>［<a href=\"https://showlab.github.io/Show-Harness/\">项目主页</a>、<a href=\"https://github.com/showlab/Show-Harness\">代码</a>］，以及一篇关于机器人操作智能体的［<a href=\"https://github.com/showlab/Awesome-Multimodal-Embodied-Agent/blob/main/assets/SURVEY_Multimodal_Embodied_Agent.pdf\">综述</a>］。",
  "news.item1": "🎉 两篇论文（<em>Where Success Breaks</em>、<em>Supervise What Survives</em>）被 <strong>CoRL 2026</strong> 接收。",
  "news.item2": "🐈‍⬛ 再次加入新加坡 <strong>Mikomiko</strong>，专注于下一代图像生成模型。",
  "news.item3": "📸 以硕士研究生身份加入<strong>新加坡国立大学 Show Lab</strong>。",
  "news.item4": "🎉 在 <strong>CAC 2024</strong> 发表论文《<em>基于模仿学习的面向家庭环境机器人技能学习</em>》。",
  "news.item5": "🎓 毕业于<strong>浙江大学</strong>，获得自动化专业工学学士学位。",
  "section.publications": "学术论文 <span class=\"cofirst\">（共同第一作者<span class=\"star\">*</span>，通讯作者<span class=\"star\">†</span>）</span>",
  "video.demo": "Show-Harness 演示视频",
  "paper.title0": "<span class=\"shx\"><span>S</span><span>h</span><span>o</span><span>w</span></span>-Harness：仅用一个视觉语言模型智能体即可操控机器人",
  "paper.title1": "多模态具身智能体综述：从计算机操作到机器人操作的统一能力视角",
  "paper.title2": "Where Success Breaks：通过失败边界学习提升视觉–语言–动作模型的鲁棒性",
  "paper.title3": "Supervise What Survives：利用合成机器人视频进行几何引导的 VLA 适配",
  "paper.title4": "When Failures Outline Success：面向精细机器人操作的对比去噪方法",
  "paper.title5": "大语言模型驱动的嵌入式微处理器实验报告智慧评阅系统",
  "paper.title6": "基于模仿学习的面向家庭环境机器人技能学习",
  "paper.venue0": "arXiv 预印本 <span class=\"dot\">·</span> 2026.09",
  "paper.venue1": "TEchRxiv 预印本 <span class=\"dot\">·</span> 2026.09",
  "paper.venue2": "<b>2026 机器人学习会议（CoRL）</b><span class=\"dot\">·</span> 2026.05",
  "paper.venue3": "<b>2026 机器人学习会议（CoRL）</b><span class=\"dot\">·</span> 2026.05",
  "paper.venue4": "CCF-A 类会议审稿中 <span class=\"dot\">·</span> 2026.05",
  "paper.venue5": "<b>实验室研究与探索</b> <span class=\"dot\">·</span> 2026.02",
  "paper.venue6": "<b>2024 中国自动化大会，EI</b> <span class=\"dot\">·</span> 2024.11",
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
  "writing.magazine": "<b>《大学生》</b> <span class=\"dot\">·</span> 2025.06",
  "section.internship": "实习经历",
  "internship.mikomiko": "Mikomiko Pte. Ltd · 新加坡",
  "internship.innomotion": "InnoMotion Co. Ltd · 上海 · 研发部",
  "internship.dates": "2025.08 – 2026.02 · 2026.06 – 至今",
  "internship.ai": "AI 工程师实习生",
  "internship.ml": "机器学习工程师实习生",
  "internship.lab": "<a href=\"https://kokorolab.net/en/home\"><strong>Kokoro Lab</strong></a> — 原生图像生成与编辑模型",
  "internship.studio": "<strong>Kokoro Studio</strong> <span class=\"pst\">（即将公布）</span> — 视频生成画布",
  "section.education": "教育与校园经历",
  "education.title0": "新加坡国立大学",
  "education.title1": "浙江大学",
  "education.title2": "浙江省可再生能源电气技术与系统重点实验室",
  "education.title3": "融媒体中心学生记者团",
  "education.current": "2025.08 – 至今",
  "education.detail0": "电气工程硕士 · Show Lab · 导师：寿政助理教授",
  "education.detail1": "自动化专业工学学士 · 电气工程学院",
  "education.detail2": "研究助理 · 导师：于淼教授",
  "education.detail3": "副部长、顾问",
  "education.detail4": "<strong>2023 年度优秀校园新闻奖</strong>（人民网）· <strong>年度好新闻奖</strong>（浙江大学 2023；浙大传媒学院 2025）",
  "contact.invitation": "想了解更多关于我的故事？欢迎看看 👉 <a href=\"/gallery/\"><strong>🖼️ 相册</strong></a>。<br>也欢迎<a href=\"mailto:aaroncaozj@gmail.com\">给我发邮件</a>，聊聊上述研究、探讨合作机会，或只是打个招呼 🤗。",
  "gallery.title": "相册 · 曹植竣 Aaron",
  "gallery.description": "曹植竣 Aaron 的摄影记录：浙江大学校园、西湖与旅途中的风景。",
  "gallery.heading": "🖼️ 相册",
  "gallery.welcome": "<strong>欢迎来到我的相册！</strong>",
  "gallery.intro": "摄影是我观察世界的方式之一。这里记录了一些令我难忘的地方、人物与瞬间，希望你也能从中找到喜欢的画面。",
  "gallery.campus": "求是园",
  "gallery.campusWhere": "摄于浙江大学",
  "gallery.lake": "一枕湖山",
  "gallery.lakeWhere": "摄于中国杭州",
  "gallery.more": "在路上",
  "nav.label": "主导航"
};
  var root = document.documentElement;
  var toggle = document.querySelector('.language-toggle');
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var entries = [];
  var pagePaths = { '/': true, '/index.html': true, '/gallery/': true, '/gallery/index.html': true };
  var pageLinks = [];
  ['', 'content', 'title', 'alt', 'aria-label'].forEach(function (attribute) {
    var marker = 'data-i18n' + (attribute ? '-' + attribute : '');
    document.querySelectorAll('[' + marker + ']').forEach(function (element) {
      var key = element.getAttribute(marker);
      if (!Object.prototype.hasOwnProperty.call(zh, key)) return;
      entries.push({ element: element, attribute: attribute, key: key,
        english: attribute ? element.getAttribute(attribute) : element.innerHTML });
    });
  });

  // 两种文字共用一个网格单元，较长的一种撑开宽度；隐藏文字仍参与排版。
  // 因此切换不会改变菜单、胶囊或右侧按钮的位置，也不必缓存字体测量结果。
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
  if (toggle) {
    // 按钮显示目标语言，因此标签与页面语言相反。
    pairedLabels(toggle, 'EN', '中');
  }

  // 语言状态写进 URL，而不是永久保存在浏览器里：直接打开任何页面都默认英文，
  // 中文页面之间的跳转则通过 ?lang=zh-CN 明确传递状态，链接也可以直接分享。
  document.querySelectorAll('a[href]').forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    try {
      var url = new URL(href, window.location.href);
      if (url.origin === window.location.origin && pagePaths[url.pathname]) {
        pageLinks.push({ element: link, href: href });
      }
    } catch (error) { /* 非标准链接保持原样。 */ }
  });

  function withLanguage(href, language) {
    var url = new URL(href, window.location.href);
    if (language === 'zh-CN') url.searchParams.set('lang', 'zh-CN');
    else url.searchParams.delete('lang');
    return url.pathname + url.search + url.hash;
  }

  function syncLanguageUrls(language) {
    pageLinks.forEach(function (link) {
      link.element.setAttribute('href', withLanguage(link.href, language));
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
      toggle.querySelectorAll('.language-label').forEach(function (label) {
        label.setAttribute('aria-hidden', String(label.lang === root.lang));
      });
      toggle.lang = chinese ? 'en' : 'zh-CN';
      toggle.setAttribute('aria-label', chinese ? 'Switch to English' : '切换到中文');
      toggle.title = toggle.getAttribute('aria-label');
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
