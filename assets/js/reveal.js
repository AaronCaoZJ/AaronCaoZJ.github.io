/* Entrance animation: elements come into focus one by one as they enter the viewport.

   Loaded synchronously in <head> and first adds js-rise to the root. .rise is visible by default in CSS
   and only hidden while that class is present, so if this file fails to load the page just has no
   animation instead of staying transparent. The class must land before styles apply, or content flashes.

   IntersectionObserver rather than scroll listeners: no per-frame layout work. Each batch is sorted by
   document order before staggering, so elements appear top to bottom. On the homepage the sheet (<main>) is
   one .rise whose first screen builds in pieces (style.css), and each section below News is a .rise of its
   own, entering whole as it scrolls in.

   Starts once the document is parsed and painted, not at DOMContentLoaded, which also waits for every deferred
   script: on a cold load they share the connection with images and arrive late, and the sheet sat empty meanwhile.

   When the first-screen batch finishes, fires rise:settled (and sets window.__riseSettled) so heavy
   setup such as glass.js can wait instead of competing with the animation. */
document.documentElement.className += ' js-rise';

function riseSettled() {
  if (window.__riseSettled) return;
  window.__riseSettled = true;
  document.dispatchEvent(new Event('rise:settled'));
}

/* Start only after the first real paint: rasterising the first frame (fonts, images) can take hundreds of
   ms on weak devices, and an overlapping animation stutters or skips its start. FCP fires once pixels are
   on screen; requestAnimationFrame only means a new frame began. Without Paint Timing, the frame after next
   stands in; the timeout covers a first paint with nothing contentful in it, where FCP never fires. */
function afterFirstPaint(fn) {
  var done = false;
  function go() { if (!done) { done = true; requestAnimationFrame(fn); } }
  var types = window.PerformanceObserver && PerformanceObserver.supportedEntryTypes || [];
  if (types.indexOf('paint') < 0) return requestAnimationFrame(go);
  new PerformanceObserver(function (list) {
    if (list.getEntriesByName('first-contentful-paint').length) go();
  }).observe({ type: 'paint', buffered: true });
  setTimeout(go, 1000);
}

/* Parsed: readyState turns 'interactive' before deferred scripts run. A Chinese page (?lang=zh-CN, read as
   i18n.js reads it) waits for DOMContentLoaded instead: deferred i18n.js swaps the text in just before it,
   and nothing should change language mid-entrance. */
function whenParsed(fn) {
  var zh = new URL(location.href).searchParams.get('lang') === 'zh-CN';
  var type = zh ? 'DOMContentLoaded' : 'readystatechange';
  document.addEventListener(type, function once() {
    document.removeEventListener(type, once);
    fn();
  });
}

whenParsed(function () {

    var items = [].slice.call(document.querySelectorAll('.rise'));
    if (!items.length) return riseSettled();

    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return riseSettled();
    }

    var STEP = 120;   // ms between items of a batch: the spacing of the homepage's first-screen pieces (style.css)
    afterFirstPaint(start);
    function start() {
      var first = true;
      var io = new IntersectionObserver(function (entries) {
        var batch = entries.filter(function (e) { return e.isIntersecting; });
        batch.sort(function (a, b) {
          return a.target.compareDocumentPosition(b.target) & 4 ? -1 : 1;
        });
        // In the first batch of a page opened at its top, a .rise inside another entering one (a homepage section
        // that a tall screen shows at load) waits for that host's first screen: its --nested-from (style.css).
        // Opened further down (an #anchor), what is on screen enters at once.
        var targets = batch.map(function (e) { return e.target; });
        var top = first && (window.pageYOffset || 0) < window.innerHeight / 2;
        var turns = batch.map(function (e, i) {
          var host = top && e.target.parentNode.closest('.rise');
          if (!host || targets.indexOf(host) < 0) return i * STEP;
          return (parseFloat(getComputedStyle(host).getPropertyValue('--nested-from')) || 0) + i * STEP;
        });
        batch.forEach(function (e, i) {
          e.target.style.setProperty('--d', turns[i] + 'ms');
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
        // First batch is done when its latest item is: its turn plus the transition duration (read from CSS, not
        // duplicated), or longer if the item builds its own pieces in after its turn: such an item states how long
        // that takes, counted from its turn, as --settle (a gallery photo row: its ripple)
        if (first) {
          first = false;
          var end = 0;
          batch.forEach(function (e, i) {
            var cs = getComputedStyle(e.target);
            var dur = parseFloat(cs.transitionDuration) * 1000 || 0;
            var settle = parseFloat(cs.getPropertyValue('--settle')) || 0;
            end = Math.max(end, turns[i] + Math.max(dur, settle));
          });
          setTimeout(riseSettled, end);
        }
      // threshold 0: the home page sheet is one .rise thousands of px tall on phones, so any ratio
      // threshold may never be reached on a short screen and the sheet would stay hidden
      }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });

      items.forEach(function (el) { io.observe(el); });
    }
});
