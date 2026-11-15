/* Shared behaviour on every page: menu, header, copy buttons, photo viewer, share links. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------- header and mobile menu ---------- */
  var header = $('#site-header'), toggle = $('#nav-toggle'), nav = $('#nav'), toTop = $('#to-top');

  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    root.classList.toggle('menu-lock', open);
    if (open) { var first = $('a', nav); if (first) { first.focus(); } }
  }
  if (header && toggle && nav) {
    toggle.addEventListener('click', function () { setMenu(!header.classList.contains('menu-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) { setMenu(false); } });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('menu-open')) { setMenu(false); toggle.focus(); }
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 1021px)');
      var onMq = function (e) { if (e.matches) { setMenu(false); } };
      if (mq.addEventListener) { mq.addEventListener('change', onMq); } else if (mq.addListener) { mq.addListener(onMq); }
    }
  }

  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.pageYOffset || root.scrollTop || 0;
    if (header) { header.classList.toggle('is-stuck', y > 8); }
    if (toTop) { toTop.hidden = y < 900; }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) { toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }); }

  /* ---------- copy buttons (contact details) ---------- */
  function copyText(text, done) {
    function fallback() {
      var t = doc.createElement('textarea');
      t.value = text; t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      doc.body.appendChild(t); t.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
      doc.body.removeChild(t);
      if (ok && done) { done(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { if (done) { done(); } }, fallback);
    } else { fallback(); }
  }
  window.SFCopy = copyText;

  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copyText(btn.getAttribute('data-copy'), function () {
        btn.classList.add('is-done');
        var sr = $('.sr-only', btn); if (sr) { sr.textContent = 'Copied'; }
        window.setTimeout(function () { btn.classList.remove('is-done'); if (sr) { sr.textContent = 'Copy'; } }, 1800);
      });
    });
  });

  /* ---------- photo viewer ---------- */
  var lb = $('#lightbox');
  if (lb) {
    var lbImg = $('img', lb), lbCap = $('.lightbox__cap', lb);
    var prev = $('.lightbox__nav--prev', lb), next = $('.lightbox__nav--next', lb);
    var set = [], at = 0;

    var show = function (i) {
      at = (i + set.length) % set.length;
      var a = set[at], img = $('img', a);
      lbImg.src = a.getAttribute('data-full') || a.href;
      lbImg.alt = img ? img.alt : '';
      var cap = a.getAttribute('data-caption') || '';
      lbCap.textContent = cap; lbCap.hidden = !cap;
      prev.hidden = next.hidden = set.length < 2;
    };
    var openAt = function (group, a) {
      set = $$('a[data-lb="' + group + '"]');
      show(Math.max(0, set.indexOf(a)));
      if (lb.showModal) { lb.showModal(); } else { lb.setAttribute('open', ''); }
    };
    var close = function () { if (lb.close) { lb.close(); } else { lb.removeAttribute('open'); } };

    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-lb]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) { return; }
      e.preventDefault();
      openAt(a.getAttribute('data-lb'), a);
    });
    lb.addEventListener('click', function (e) {
      if (e.target === lb || (e.target.closest && e.target.closest('.lightbox__close'))) { close(); }
    });
    prev.addEventListener('click', function () { show(at - 1); });
    next.addEventListener('click', function () { show(at + 1); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(at - 1); } else if (e.key === 'ArrowRight') { show(at + 1); }
    });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) { return; }
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50 && set.length > 1) { show(at + (dx < 0 ? 1 : -1)); }
    }, { passive: true });
  }

  /* ---------- share on WhatsApp ---------- */
  $$('[data-share="whatsapp"]').forEach(function (a) {
    var title = (doc.title || '').split(' | ')[0];
    a.href = 'https://wa.me/?text=' + encodeURIComponent(title + '\n' + location.href);
    a.hidden = false;
  });

  /* ---------- the year in the footer ---------- */
  var yr = $('#year'); if (yr) { yr.textContent = String(new Date().getFullYear()); }
})();
