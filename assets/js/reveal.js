/* 入场动画：元素进入视口后逐个浮现。

   本文件同步加载于 <head>，第一件事是给根元素打上 js-rise ——
   CSS 里 .rise 默认可见，只有这个标记存在时才转为待入场状态。
   于是本文件一旦没能加载，页面只是没有动画，而不会把内容锁死在
   透明状态。标记必须在样式生效前打上，否则会先显示再隐藏、闪一下。

   观察本身用 IntersectionObserver 而非滚动监听 —— 后者每帧都要
   算位置，前者由浏览器判断可见性，主线程零开销。同一批进入视口的
   元素按文档顺序排序后再依次延迟，保证浮现顺序是视觉上的从上到下。

   首屏那一批走完时发出 rise:settled（并记在 window.__riseSettled 上）：
   glass.js 这类开销大的初始化等它再开始，不和进场动画抢主线程。 */
document.documentElement.className += ' js-rise';

function riseSettled() {
  if (window.__riseSettled) return;
  window.__riseSettled = true;
  document.dispatchEvent(new Event('rise:settled'));
}

/* 等页面第一次真正画到屏幕上再开始入场：第一帧要把整页栅格化（字体、图片），弱设备上要几百毫秒，
   动画若和它重叠，开头那一段会卡住或直接跳过去。信号用浏览器报告的首次内容绘制（FCP）——
   它在画面真正呈现之后才发出；requestAnimationFrame 只说明主线程开始了新的一帧，GPU 忙的时候
   上一帧可能还没画完。不支持 Paint Timing 的老浏览器最多等 3 秒。 */
function afterFirstPaint(fn) {
  var done = false;
  function go() { if (!done) { done = true; requestAnimationFrame(fn); } }
  try {
    new PerformanceObserver(function (list) {
      if (list.getEntriesByName('first-contentful-paint').length) go();
    }).observe({ type: 'paint', buffered: true });
  } catch (e) {}
  setTimeout(go, 3000);
}

document.addEventListener('DOMContentLoaded', function () {

    var items = [].slice.call(document.querySelectorAll('.rise'));
    if (!items.length) return riseSettled();

    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return riseSettled();
    }

    afterFirstPaint(start);
    function start() {
      var first = true;
      var io = new IntersectionObserver(function (entries) {
        var batch = entries.filter(function (e) { return e.isIntersecting; });
        batch.sort(function (a, b) {
          return a.target.compareDocumentPosition(b.target) & 4 ? -1 : 1;
        });
        batch.forEach(function (e, i) {
          e.target.style.setProperty('--d', (i * 80) + 'ms');
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
        // 首屏这批：最后一个元素的延迟加上动画时长（读样式表里的值，不在这里重复写）之后算走完
        if (first) {
          first = false;
          var last = batch.length && batch[batch.length - 1].target;
          var dur = last ? parseFloat(getComputedStyle(last).transitionDuration) * 1000 || 0 : 0;
          setTimeout(riseSettled, last ? (batch.length - 1) * 80 + dur : 0);
        }
      }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

      items.forEach(function (el) { io.observe(el); });
    }
});
