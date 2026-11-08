/* DBBL TCO Prep 2026 — interactions */
(function () {
  "use strict";

  /* ---------- theme ---------- */
  var root = document.documentElement;
  var themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* ---------- mobile nav ---------- */
  var menuBtn = document.getElementById("menuBtn");
  var scrim = document.getElementById("scrim");
  function closeNav() {
    document.body.classList.remove("nav-open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  if (scrim) scrim.addEventListener("click", closeNav);

  /* ---------- search ---------- */
  var input = document.getElementById("q");
  var box = document.getElementById("results");
  var index = null;
  var loading = false;
  var selected = -1;
  var current = [];

  function loadIndex() {
    if (index || loading) return;
    loading = true;
    fetch("assets/search.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; loading = false; if (input.value.trim()) runSearch(); })
      .catch(function () { loading = false; });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function runSearch() {
    var q = input.value.trim().toLowerCase();
    if (!q || !index) { box.hidden = true; current = []; return; }
    var hits = [];
    for (var i = 0; i < index.length && hits.length < 40; i++) {
      var e = index[i];
      if (e.t.toLowerCase().indexOf(q) !== -1 || e.g.toLowerCase().indexOf(q) !== -1) hits.push(e);
    }
    current = hits.slice(0, 14);
    selected = -1;
    if (!current.length) {
      box.innerHTML = '<div class="r-empty">No match. Try “profit”, “mock”, “viva” or “repo”.</div>';
      box.hidden = false;
      return;
    }
    box.innerHTML = current.map(function (e) {
      return '<a href="' + esc(e.u) + '"><span class="r-group">' + esc(e.g) + '</span>' + esc(e.t) + "</a>";
    }).join("");
    box.hidden = false;
  }

  function move(dir) {
    var links = box.querySelectorAll("a");
    if (!links.length) return;
    selected = (selected + dir + links.length) % links.length;
    links.forEach(function (a, i) { a.classList.toggle("sel", i === selected); });
    links[selected].scrollIntoView({ block: "nearest" });
  }

  if (input && box) {
    input.addEventListener("focus", loadIndex);
    input.addEventListener("input", function () { loadIndex(); runSearch(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        var links = box.querySelectorAll("a");
        if (selected >= 0 && links[selected]) window.location.href = links[selected].getAttribute("href");
        else if (links.length) window.location.href = links[0].getAttribute("href");
      } else if (e.key === "Escape") { box.hidden = true; input.blur(); }
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ---------- checkbox persistence ---------- */
  var boxes = document.querySelectorAll("input.task");
  var pageKey = "tasks:" + location.pathname;
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(pageKey) || "{}"); } catch (e) { saved = {}; }
  boxes.forEach(function (cb, i) {
    if (Object.prototype.hasOwnProperty.call(saved, i)) cb.checked = !!saved[i];
    cb.addEventListener("change", function () {
      saved[i] = cb.checked;
      try { localStorage.setItem(pageKey, JSON.stringify(saved)); } catch (e) {}
    });
  });

  /* ---------- countdown ---------- */
  var cd = document.getElementById("countdown");
  if (cd) {
    var target = new Date(cd.getAttribute("data-target")).getTime();
    var d = document.getElementById("cd-d");
    var h = document.getElementById("cd-h");
    var m = document.getElementById("cd-m");
    var s = document.getElementById("cd-s");
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) {
        d.textContent = h.textContent = m.textContent = s.textContent = "0";
        return;
      }
      var sec = Math.floor(diff / 1000);
      d.textContent = Math.floor(sec / 86400);
      h.textContent = Math.floor((sec % 86400) / 3600);
      m.textContent = Math.floor((sec % 3600) / 60);
      s.textContent = sec % 60;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- past-paper lightbox ---------- */
  var triggers = Array.prototype.slice.call(document.querySelectorAll(".paper-open"));
  if (triggers.length) {
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal-bar"><span id="modalCap"></span>' +
      '<div class="nav-btns"><button id="modalPrev" aria-label="Previous page">←</button>' +
      '<button id="modalNext" aria-label="Next page">→</button>' +
      '<button id="modalClose" aria-label="Close">✕</button></div></div>' +
      '<div class="modal-body"><img id="modalImg" alt="Past paper page"></div>';
    document.body.appendChild(modal);

    var img = modal.querySelector("#modalImg");
    var cap = modal.querySelector("#modalCap");
    var at = 0;

    function show(i) {
      at = (i + triggers.length) % triggers.length;
      var t = triggers[at];
      img.src = t.getAttribute("data-src");
      cap.textContent = t.getAttribute("data-caption");
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function close() {
      modal.hidden = true;
      document.body.style.overflow = "";
    }

    triggers.forEach(function (t, i) {
      t.addEventListener("click", function () { show(i); });
    });
    modal.querySelector("#modalPrev").addEventListener("click", function () { show(at - 1); });
    modal.querySelector("#modalNext").addEventListener("click", function () { show(at + 1); });
    modal.querySelector("#modalClose").addEventListener("click", close);
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target.classList.contains("modal-body")) close(); });
    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(at - 1);
      if (e.key === "ArrowRight") show(at + 1);
    });
  }
})();
