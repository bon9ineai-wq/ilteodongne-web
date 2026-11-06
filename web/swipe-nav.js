/* Mobile tab swipe: 직장 찾기 → 동네 비교 → 집·인프라 → 동네 이야기 */
(function () {
  if (!window.matchMedia('(max-width:640px)').matches) return;
  var B = '/ilteodongne-web/';
  var TABS = [B + 'jobs/', B + 'compare/', B + 'map/', B + 'blog/'];
  function idx() {
    var p = location.pathname;
    if (/\/compare\/?$/.test(p)) return 1;
    if (/\/map\/?$/.test(p)) return 2;
    if (/\/blog(\/|$)/.test(p)) return 3;
    return 0; /* home or /jobs */
  }
  function go(i) {
    if (i < 0 || i >= TABS.length || i === idx()) return;
    var q = new URLSearchParams(location.search);
    var keep = new URLSearchParams();
    ['job', 'region'].forEach(function (k) { if (q.get(k)) keep.set(k, q.get(k)); });
    var url = TABS[i] + (keep.toString() ? '?' + keep : '');
    try {
      document.documentElement.style.transition = 'opacity .12s ease';
      document.documentElement.style.opacity = '0.88';
    } catch (e) {}
    location.href = url;
  }
  function blocked(el) {
    if (!el || !el.closest) return true;
    if (document.body.classList.contains('map-sheet-open')) return true;
    if (el.closest('#map,.leaflet-container,#dp,table,input,select,textarea,option,.bar,[data-no-swipe]')) return true;
    for (var e = el; e && e !== document.body; e = e.parentElement) {
      var s = window.getComputedStyle(e);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 4) return true;
    }
    return false;
  }
  var x0 = 0, y0 = 0, t0 = 0, tracking = false;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { tracking = false; return; }
    if (blocked(e.target)) { tracking = false; return; }
    var t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); tracking = true;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!tracking || e.touches.length !== 1) return;
    var t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dy) > Math.abs(dx) * 0.9) tracking = false; /* become vertical scroll */
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - x0, dy = t.clientY - y0;
    if (Date.now() - t0 > 900) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    var i = idx();
    if (dx < 0) go(i + 1); else go(i - 1);
  }, { passive: true });
})();
