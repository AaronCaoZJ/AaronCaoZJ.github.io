/* ---------- Hover lens ----------
   A droplet follows the pointer across a set of items: on each move it stretches along the direction
   of travel and squashes across it, then settles with the CSS spring easing. Stretch is in pixels,
   capped at 10%, so any item size stays sane.

   box must be positioned (the lens is absolute inside it); pick(target) returns the item or null.
   Leaving all items hides the lens after 120 ms, so crossing the gap between items keeps it sliding
   instead of flashing and re-appearing. */
function liquidLens(box, pick, cls) {
  var lens = document.createElement('span');
  lens.className = 'liquid-lens' + (cls ? ' ' + cls : '');
  lens.setAttribute('aria-hidden', 'true');
  box.appendChild(lens);   // last, so item order is unchanged
  var cur = null, lx = 0, ly = 0, lw = 0, lh = 0, settle = 0, leave = 0;
  function place(sx, sy) {
    lens.style.transform = 'translate(' + lx + 'px,' + ly + 'px) scale(' + sx + ',' + sy + ')';
  }
  function grow(px, size) { return Math.min(.1, px / size); }
  function to(el) {
    clearTimeout(leave);
    var first = !cur, x = el.offsetLeft, y = el.offsetTop;
    var horiz = Math.abs(x - lx) >= Math.abs(y - ly);
    lx = x; ly = y; lw = el.offsetWidth; lh = el.offsetHeight;
    if (first) lens.style.transition = 'none';     // first show: appear in place, don't fly in from a corner
    lens.style.width = lw + 'px';
    lens.style.height = lh + 'px';
    if (first) {
      place(1 - grow(14, lw), 1 - grow(14, lh));
      void lens.offsetWidth;                         // commit the start state before restoring transitions
      lens.style.transition = '';
      place(1, 1);
    } else if (el !== cur) {
      if (horiz) place(1 + grow(10, lw), 1 - grow(5, lh));
      else place(1 - grow(5, lw), 1 + grow(10, lh));
      clearTimeout(settle);
      settle = setTimeout(function () { place(1, 1); }, 140);
    }
    cur = el;
    lens.classList.add('on');
  }
  function off() { clearTimeout(leave); cur = null; lens.classList.remove('on'); }

  box.addEventListener('pointerover', function (e) {
    var el = pick(e.target);
    if (el) to(el);
    else { clearTimeout(leave); leave = setTimeout(off, 120); }
  });
  box.addEventListener('pointerleave', off);
  // swell slightly on press
  box.addEventListener('pointerdown', function (e) {
    if (cur && pick(e.target) === cur) place(1 + grow(8, lw), 1 + grow(8, lh));
  });
  box.addEventListener('pointerup', function () { if (cur) place(1, 1); });
  box.addEventListener('focusin', function (e) {
    var el = pick(e.target);
    if (el && e.target.matches(':focus-visible')) to(el);
  });
  box.addEventListener('focusout', off);
}

/* ---------- Top nav ----------
   The nav sits on a gradient blur (.nav-edge in style.css). At the top of the page there's only a solid
   background beneath, so the blur is invisible but still costs GPU work every frame: toggle .scrolled
   to enable it only after scrolling. Also attaches the hover lens. */
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  function scrolled() { nav.classList.toggle('scrolled', window.scrollY > 0); }
  scrolled();
  window.addEventListener('scroll', scrolled, { passive: true });

  // One lens (liquidLens) for the whole nav: links, the gallery loupe toggle and the language button.
  // .has-lens turns off the items' own hover backgrounds
  var wrap = nav.querySelector('.wrap');
  if (!wrap) return;
  liquidLens(nav, function (t) {
    var el = t.closest && t.closest('a, button');
    if (!el || !nav.contains(el)) return null;
    return el.tagName === 'A' ? (el.parentNode === wrap ? el : null) : el;
  }, 'nav-lens');
  nav.classList.add('has-lens');
})();
