/* Portfolio: quiet interactions. Everything renders complete without this script. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 861px)");
  var SVGNS = "http://www.w3.org/2000/svg";

  /* Each new page starts at the top (or at its #anchor). Only a reload of the same page keeps its place,
     so a scroll position saved by the host can't carry over from one page to the next. */
  (function startAtTop() {
    var here = location.origin + location.pathname + location.search, prev = null;
    try { prev = sessionStorage.getItem("fieldnotes:last-page"); sessionStorage.setItem("fieldnotes:last-page", here); } catch (e) {}
    var nav = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
    if (prev === here || (nav && nav.type === "back_forward")) return;

    var reader = false;
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (ev) {
      window.addEventListener(ev, function () { reader = true; }, { once: true, passive: true });
    });
    function target() {
      var id = location.hash.slice(1);
      try { return id ? document.getElementById(decodeURIComponent(id)) : null; } catch (e) { return null; }
    }
    function settle() {
      if (reader) return;
      var t = target();
      var doc = document.documentElement;
      var ownScroll = doc.scrollHeight > window.innerHeight + 1;
      if (t) { t.scrollIntoView({ block: "start" }); return; }
      if (ownScroll) { window.scrollTo(0, 0); }
      else { doc.scrollIntoView({ block: "start" }); } /* page sized to its content: bring its top into view */
    }
    settle();
    window.addEventListener("load", settle);
    var until = Date.now() + 800;
    (function hold() {
      if (reader || Date.now() > until) return;
      if (!target() && window.scrollY !== 0) window.scrollTo(0, 0);
      requestAnimationFrame(hold);
    })();
  })();

  /* 0. Keep sticky offsets in step with the real header height (it wraps to two rows on phones) */
  var header = document.querySelector(".site-header");
  function syncHeader() {
    if (!header) return;
    // measure without the last value, or the header can never shrink back after a resize
    var root = document.documentElement.style;
    root.removeProperty("--header-h");
    root.setProperty("--header-h", header.offsetHeight + "px");
  }
  syncHeader();
  window.addEventListener("resize", syncHeader);

  function once(el, cb, opts) {
    if (!("IntersectionObserver" in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.disconnect(); cb(); }
      });
    }, opts || { threshold: 0.35 });
    io.observe(el);
  }

  /* 1. Index numerals count up briefly the first time they appear */
  document.querySelectorAll(".numeral[data-count]").forEach(function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (!target || reduce.matches) return;
    var finalText = el.textContent.trim();
    var pad = finalText.length;
    once(el, function () {
      var start = null, dur = 240;
      /* never leave a wrong number on screen if frames are throttled */
      setTimeout(function () { el.textContent = finalText; }, dur + 80);
      function frame(t) {
        if (start === null) start = t;
        var p = Math.min(1, (t - start) / dur);
        var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = String(v).padStart(pad, "0");
        if (p < 1) requestAnimationFrame(frame);
      }
      el.textContent = String(0).padStart(pad, "0");
      requestAnimationFrame(frame);
    }, { threshold: 0.6 });
  });

  /* 2. Annotations: place each note level with its pin, then draw a leader line between them */
  function layoutAnno(fig) {
    var notes = fig.querySelector(".anno-notes");
    var svg = fig.querySelector(".anno-lines");
    var media = fig.querySelector(".anno-img");
    if (!notes || !svg || !media) return;
    var items = Array.prototype.slice.call(notes.children);
    items.forEach(function (li) { li.style.top = ""; });
    fig.classList.remove("is-laid");
    notes.style.height = "";
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!wide.matches) return;

    var fr = fig.getBoundingClientRect();
    var nr = notes.getBoundingClientRect();
    var mr = media.getBoundingClientRect();
    var rows = items.map(function (li) {
      var pin = media.querySelector('.pin[data-n="' + li.getAttribute("data-n") + '"]');
      if (!pin) return null;
      var pr = pin.getBoundingClientRect();
      return { li: li, x: pr.left + pr.width / 2 - fr.left, y: pr.top + pr.height / 2 - fr.top, h: li.offsetHeight };
    }).filter(Boolean).sort(function (a, b) { return a.y - b.y; });

    fig.classList.add("is-laid");
    var notesTop = nr.top - fr.top;
    var prevBottom = -Infinity, maxBottom = 0;
    rows.forEach(function (r) {
      var top = Math.max(r.y - notesTop - 10, prevBottom + 16, 0);
      r.li.style.top = top + "px";
      r.ny = notesTop + top + 10;
      prevBottom = top + r.h;
      maxBottom = Math.max(maxBottom, prevBottom);
    });
    notes.style.height = maxBottom + "px";

    var nx = nr.left - fr.left - 10;
    var mx = mr.right - fr.left + (nr.left - mr.right) / 2;
    rows.forEach(function (r) {
      var d = Math.abs(r.ny - r.y) < 1
        ? "M" + r.x + " " + r.y + " H" + nx
        : "M" + r.x + " " + r.y + " H" + mx + " V" + r.ny + " H" + nx;
      var path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
      var dot = document.createElementNS(SVGNS, "circle");
      dot.setAttribute("cx", nx); dot.setAttribute("cy", r.ny); dot.setAttribute("r", 2);
      svg.appendChild(dot);
    });

    if (!fig.dataset.drawn && !reduce.matches) {
      svg.querySelectorAll("path").forEach(function (p) {
        var len = p.getTotalLength();
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
      });
      svg.querySelectorAll("circle").forEach(function (c) { c.style.opacity = 0; });
    }
  }

  function drawAnno(fig) {
    fig.dataset.drawn = "1";
    var svg = fig.querySelector(".anno-lines");
    if (!svg) return;
    svg.classList.add("is-drawing");
    requestAnimationFrame(function () {
      svg.querySelectorAll("path").forEach(function (p) { p.style.strokeDashoffset = 0; });
      setTimeout(function () {
        svg.querySelectorAll("circle").forEach(function (c) { c.style.transition = "opacity 150ms"; c.style.opacity = 1; });
      }, 380);
    });
  }

  var annos = Array.prototype.slice.call(document.querySelectorAll(".anno"));
  function layoutAll() { annos.forEach(layoutAnno); }
  function init() {
    layoutAll();
    annos.forEach(function (fig) {
      once(fig, function () {
        if (reduce.matches) { fig.dataset.drawn = "1"; return; }
        drawAnno(fig);
      }, { threshold: 0.4 });
    });
  }
  var imgs = annos.map(function (f) { return f.querySelector("img"); }).filter(Boolean);
  Promise.all(imgs.map(function (img) {
    return img.complete ? Promise.resolve() : new Promise(function (r) { img.addEventListener("load", r); img.addEventListener("error", r); });
  })).then(function () {
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(init);
  });
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      layoutAll();
      annos.forEach(function (fig) {
        if (fig.dataset.drawn) {
          fig.querySelectorAll(".anno-lines path").forEach(function (p) { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; });
        }
      });
    }, 120);
  });

  /* 3. Sticky index: highlight the section being read */
  var rail = document.querySelector(".rail");
  if (rail && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(rail.querySelectorAll("a[href^='#']"));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var current = null;
    function setCurrent(id) {
      if (id === current || !map[id]) return;
      current = id;
      links.forEach(function (a) { a.classList.remove("is-current"); a.removeAttribute("aria-current"); });
      map[id].classList.add("is-current");
      map[id].setAttribute("aria-current", "true");
      if (!wide.matches || window.innerWidth <= 1100) {
        var l = map[id], box = rail;
        var left = l.offsetLeft - 24;
        box.scrollTo({ left: left, behavior: reduce.matches ? "auto" : "smooth" });
      }
    }
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setCurrent(e.target.id); });
    }, { rootMargin: "-35% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
    setCurrent(Object.keys(map)[0]);
  }
})();
