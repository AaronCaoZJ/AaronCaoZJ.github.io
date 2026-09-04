/* 入场动画：元素进入视口后逐个浮现。

   本文件同步加载于 <head>，第一件事是给根元素打上 js-rise ——
   CSS 里 .rise 默认可见，只有这个标记存在时才转为待入场状态。
   于是本文件一旦没能加载，页面只是没有动画，而不会把内容锁死在
   透明状态。标记必须在样式生效前打上，否则会先显示再隐藏、闪一下。

   观察本身用 IntersectionObserver 而非滚动监听 —— 后者每帧都要
   算位置，前者由浏览器判断可见性，主线程零开销。同一批进入视口的
   元素按文档顺序排序后再依次延迟，保证浮现顺序是视觉上的从上到下。 */
document.documentElement.className += ' js-rise';

document.addEventListener('DOMContentLoaded', function () {

    var items = [].slice.call(document.querySelectorAll('.rise'));
    if (!items.length) return;

    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }

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
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    items.forEach(function (el) { io.observe(el); });
});
