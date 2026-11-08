/* ============================================================
   DBBL TCO Prep 2026 — app
   Vanilla JS. No dependencies. Data in assets/data/.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- storage ---------------- */

  var KEY = "tco.v1";

  function readState() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && typeof raw === "object") {
        raw.attempts = raw.attempts || [];
        raw.study = raw.study || {};
        return raw;
      }
    } catch (e) {}
    return { attempts: [], study: {}, session: null };
  }

  function writeState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {}
  }

  var S = readState();

  /* ---------------- data ---------------- */

  var D = { banks: [], mocks: [], byId: {}, loaded: false };

  function loadData() {
    if (D.loaded) return Promise.resolve(D);
    return fetch("assets/data/questions.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        D.banks = data.banks;
        D.mocks = data.mocks;
        D.banks.concat(D.mocks).forEach(function (b) {
          b.questions.forEach(function (q) {
            q.bank = b;
            D.byId[q.id] = q;
          });
        });
        D.loaded = true;
        return D;
      });
  }

  /* ---------------- utils ---------------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pct(a, b) { return b ? Math.round((a * 100) / b) : 0; }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function examCountdown() {
    var target = new Date("2026-11-20T10:00:00+06:00").getTime();
    var diff = target - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, past: true };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      past: false
    };
  }

  function allQuestions() {
    var out = [];
    D.banks.forEach(function (b) { out = out.concat(b.questions); });
    return out;
  }

  function totalQuestionCount() {
    var n = 0;
    D.banks.concat(D.mocks).forEach(function (b) { n += b.questions.length; });
    return n || 430;
  }

  function answersOf(attempt) { return Object.keys(attempt.answers || {}); }

  function correctness(attempt) {
    var ok = 0, total = 0;
    Object.keys(attempt.answers || {}).forEach(function (id) {
      var q = D.byId[id];
      if (!q) return;
      total++;
      if (q.ans === attempt.answers[id]) ok++;
    });
    return { ok: ok, total: total };
  }

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findHits(index, query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    var terms = q.split(/\s+/).filter(Boolean);
    var scored = [];
    index.forEach(function (e) {
      var title = String(e.t || "").toLowerCase();
      var hay = title + " " + String(e.g || "").toLowerCase();
      var all = terms.every(function (t) { return hay.indexOf(t) !== -1; });
      if (!all) return;
      var score = 0;
      if (title.indexOf(q) !== -1) score += 8;
      terms.forEach(function (t) {
        if (new RegExp("(^|[^a-z0-9\\u0980-\\u09ff])" + escapeRe(t)).test(title)) score += 4;
        else if (title.indexOf(t) !== -1) score += 1;
        if (String(e.k) === "question") score += 0.5;
      });
      scored.push({ e: e, s: score });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.map(function (x) { return x.e; });
  }

  function globalStats() {
    var seen = {}, ok = 0, total = 0;
    S.attempts.forEach(function (a) {
      var c = correctness(a);
      ok += c.ok;
      total += c.total;
      answersOf(a).forEach(function (id) { seen[id] = true; });
    });
    var all = totalQuestionCount();
    return {
      answered: Object.keys(seen).length,
      coverage: pct(Object.keys(seen).length, all),
      accuracy: pct(ok, total),
      attempts: S.attempts.length,
      totalAnswered: total
    };
  }

  function readiness() {
    var g = globalStats();
    if (!g.totalAnswered) return 0;
    return Math.round(0.65 * g.accuracy + 0.35 * g.coverage);
  }

  function streak() {
    var days = {};
    S.attempts.forEach(function (a) {
      var d = new Date(a.at);
      days[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] = true;
    });
    var n = 0;
    var d = new Date();
    if (!days[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()]) {
      d.setDate(d.getDate() - 1);
    }
    while (days[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()]) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function topicStats() {
    var map = {};
    S.attempts.forEach(function (a) {
      Object.keys(a.answers || {}).forEach(function (id) {
        var q = D.byId[id];
        if (!q) return;
        var key = q.bank.id + "|" + q.topic;
        if (!map[key]) map[key] = { bank: q.bank.name, topic: q.topic, ok: 0, total: 0 };
        map[key].total++;
        if (q.ans === a.answers[id]) map[key].ok++;
      });
    });
    return Object.keys(map).map(function (k) {
      var m = map[k];
      m.acc = pct(m.ok, m.total);
      return m;
    }).sort(function (a, b) { return a.acc - b.acc; });
  }

  function saveAttempt(attempt) {
    attempt.at = new Date().toISOString();
    S.attempts.unshift(attempt);
    if (S.attempts.length > 60) S.attempts.length = 60;
    S.session = null;
    writeState();
  }

  function ring(value, size, stroke) {
    size = size || 116;
    stroke = stroke || 10;
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--brand)" stroke-width="' + stroke +
      '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off +
      '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' +
      '<text x="50%" y="50%" text-anchor="middle" dy="0.35em" class="ring-label">' + value + "%</text></svg>";
  }

  /* ---------------- study plan ---------------- */

  var PLAN = [
    { day: 1, date: "Sun 8 Nov", title: "Maths core I", focus: "Percentage, profit & loss, discount",
      tasks: [
        { t: "Read formula sheet §1–2", href: "math-formula-sheet.html" },
        { t: "Solve Math Q1–Q15", href: "practice.html?bank=math&from=1&to=15" },
        { t: "Write the 6 formulas from memory", href: "math-formula-sheet.html" }
      ] },
    { day: 2, date: "Mon 9 Nov", title: "Maths core II", focus: "Ratio, average, partnership, age",
      tasks: [
        { t: "Solve Math Q16–Q30", href: "practice.html?bank=math&from=16&to=30" },
        { t: "English rules 1–8", href: "english-grammar-rules.html" },
        { t: "Write one 120-word paragraph", href: "written-part-guide.html" }
      ] },
    { day: 3, date: "Tue 10 Nov", title: "Maths core III", focus: "Time & work, pipes, speed, trains, boats",
      tasks: [
        { t: "Solve Math Q31–Q45", href: "practice.html?bank=math&from=31&to=45" },
        { t: "ICT practice, 15 questions", href: "practice.html?bank=ict&n=15" },
        { t: "Redo every wrong Day 1–2 question", href: "practice.html?weak=1" }
      ] },
    { day: 4, date: "Wed 11 Nov", title: "Maths finish + English", focus: "Interest, mixture, sets, geometry, series",
      tasks: [
        { t: "Solve Math Q46–Q60", href: "practice.html?bank=math&from=46&to=60" },
        { t: "English rules 9–16 + Q1–Q20", href: "practice.html?bank=english&from=1&to=20" },
        { t: "Write one formal email", href: "model-answers.html" }
      ] },
    { day: 5, date: "Thu 12 Nov", title: "English deep", focus: "Rules 17–25, vocabulary, idioms",
      tasks: [
        { t: "English rules 17–25", href: "english-grammar-rules.html" },
        { t: "English Q21–Q45", href: "practice.html?bank=english&from=21&to=45" },
        { t: "Learn 30 idioms", href: "english-grammar-rules.html" }
      ] },
    { day: 6, date: "Fri 13 Nov", title: "Bangla + GK", focus: "সন্ধি, সমাস, কারক, banking numbers",
      tasks: [
        { t: "Bangla Q1–Q40", href: "practice.html?bank=bangla&n=40" },
        { t: "Read banking GK notes", href: "banking-gk-notes.html" },
        { t: "Memorise the 12 numbers", href: "last-48-hours.html" }
      ] },
    { day: 7, date: "Sat 14 Nov", title: "GK + ICT", focus: "Consolidation and first short mock",
      tasks: [
        { t: "GK Q1–Q30", href: "practice.html?bank=gk&from=1&to=30" },
        { t: "ICT Q1–Q30", href: "practice.html?bank=ict&n=30" },
        { t: "Mock Test 2, timed", href: "exam.html?mock=mock2" }
      ] },
    { day: 8, date: "Sun 15 Nov", title: "Analytical", focus: "Series, coding, relations, seating",
      tasks: [
        { t: "Analytical Q1–Q30", href: "practice.html?bank=analytical&n=30" },
        { t: "Redo the logic games you missed", href: "practice.html?weak=1" },
        { t: "20 banking GK questions", href: "practice.html?bank=gk&from=1&to=20" }
      ] },
    { day: 9, date: "Mon 16 Nov", title: "Written part", focus: "Paragraph, argument, written maths",
      tasks: [
        { t: "Read the written guide", href: "written-part-guide.html" },
        { t: "Write 3 answers by hand, timed", href: "model-answers.html" },
        { t: "Compare against the models", href: "model-answers.html" }
      ] },
    { day: 10, date: "Tue 17 Nov", title: "Full mock", focus: "100 questions in 90 minutes",
      tasks: [
        { t: "Sit Mock Test 1, timed", href: "exam.html?mock=mock1" },
        { t: "Review every wrong answer", href: "progress.html" },
        { t: "Drill your two weakest sections", href: "practice.html?weak=1" }
      ] },
    { day: 11, date: "Wed 18 Nov", title: "Repair day", focus: "Mistakes, not new topics",
      tasks: [
        { t: "Redo every wrong question", href: "practice.html?weak=1" },
        { t: "Memorise the last-48-hours sheet", href: "last-48-hours.html" },
        { t: "One handwritten essay + paragraph", href: "model-answers.html" }
      ] },
    { day: 12, date: "Thu 19 Nov", title: "Taper", focus: "Skim, pack, sleep early",
      tasks: [
        { t: "Skim formulas, rules, GK numbers", href: "last-48-hours.html" },
        { t: "30 easy questions for confidence", href: "practice.html?bank=math&n=10" },
        { t: "Pack admit card, 2 pens, NID", href: "exam-brief.html" }
      ] }
  ];

  function nextStudyDay() {
    for (var i = 0; i < PLAN.length; i++) {
      if (!S.study[PLAN[i].day]) return PLAN[i];
    }
    return null;
  }

  /* ---------------- shared chrome ---------------- */

  function initChrome() {
    var root = document.documentElement;
    var themeBtn = document.getElementById("themeBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (e) {}
      });
    }

    var path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      var target = a.getAttribute("href");
      if (target === path) a.classList.add("active");
    });

    var moreBtn = document.getElementById("moreBtn");
    var sheet = document.getElementById("sheet");
    var sheetScrim = document.getElementById("sheetScrim");
    function closeSheet() {
      document.body.classList.remove("sheet-open");
      if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
    }
    if (moreBtn && sheet) {
      moreBtn.addEventListener("click", function () {
        var open = document.body.classList.toggle("sheet-open");
        moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    if (sheetScrim) sheetScrim.addEventListener("click", closeSheet);
    var sheetClose = document.getElementById("sheetClose");
    if (sheetClose) sheetClose.addEventListener("click", closeSheet);
    document.querySelectorAll("#sheet a").forEach(function (a) {
      a.addEventListener("click", closeSheet);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSheet();
    });

    initSearch();
    initTasks();
    initLightbox();
  }

  /* ---------------- search ---------------- */

  var SEARCH = { index: null, loading: false };

  function initSearch() {
    var input = document.getElementById("q");
    var box = document.getElementById("results");
    if (!input || !box) return;

    function load() {
      if (SEARCH.index || SEARCH.loading) return;
      SEARCH.loading = true;
      fetch("assets/data/search.json")
        .then(function (r) { return r.json(); })
        .then(function (d) { SEARCH.index = d; SEARCH.loading = false; if (input.value.trim()) run(); })
        .catch(function () { SEARCH.loading = false; });
    }

    var sel = -1, hits = [];

    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q || !SEARCH.index) { box.hidden = true; return; }
      hits = findHits(SEARCH.index, input.value).slice(0, 60);
      sel = -1;
      if (!hits.length) {
        box.innerHTML = '<div class="r-empty">Nothing found. Try “percentage”, “repo rate”, “seating” or “viva”.</div>';
        box.hidden = false;
        return;
      }
      box.innerHTML = hits.slice(0, 12).map(function (e) {
        return '<a href="' + esc(e.u) + '"><span class="r-group">' + esc(e.g) +
          '</span><span class="r-title">' + esc(e.t) + "</span></a>";
      }).join("") +
        '<a class="r-all" href="search.html?q=' + encodeURIComponent(input.value.trim()) + '">See all results for “' +
        esc(input.value.trim()) + '” →</a>';
      box.hidden = false;
    }

    function move(dir) {
      var links = box.querySelectorAll("a");
      if (!links.length) return;
      sel = (sel + dir + links.length) % links.length;
      links.forEach(function (a, i) { a.classList.toggle("sel", i === sel); });
      links[sel].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("focus", load);
    input.addEventListener("input", function () { load(); run(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        var links = box.querySelectorAll("a");
        if (sel >= 0 && links[sel]) location.href = links[sel].getAttribute("href");
        else if (links.length) location.href = links[0].getAttribute("href");
      } else if (e.key === "Escape") { box.hidden = true; input.blur(); }
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ---------------- content-page extras ---------------- */

  function initTasks() {
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
  }

  function initLightbox() {
    var triggers = Array.prototype.slice.call(document.querySelectorAll(".paper-open"));
    if (!triggers.length) return;
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal-bar"><span id="modalCap"></span>' +
      '<div class="nav-btns"><button id="modalPrev" aria-label="Previous">←</button>' +
      '<button id="modalNext" aria-label="Next">→</button>' +
      '<button id="modalClose" aria-label="Close">✕</button></div></div>' +
      '<div class="modal-body"><img id="modalImg" alt="Past paper page"></div>';
    document.body.appendChild(modal);

    var img = modal.querySelector("#modalImg");
    var cap = modal.querySelector("#modalCap");
    var at = 0;

    function show(i) {
      at = (i + triggers.length) % triggers.length;
      img.src = triggers[at].getAttribute("data-src");
      cap.textContent = triggers[at].getAttribute("data-caption");
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function close() { modal.hidden = true; document.body.style.overflow = ""; }

    triggers.forEach(function (t, i) { t.addEventListener("click", function () { show(i); }); });
    modal.querySelector("#modalPrev").addEventListener("click", function () { show(at - 1); });
    modal.querySelector("#modalNext").addEventListener("click", function () { show(at + 1); });
    modal.querySelector("#modalClose").addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      if (e.target === modal || e.target.classList.contains("modal-body")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(at - 1);
      if (e.key === "ArrowRight") show(at + 1);
    });
  }

  /* ---------------- dashboard ---------------- */

  function viewDashboard(el) {
    var g = globalStats();
    var ready = readiness();
    var cd = examCountdown();
    var next = nextStudyDay();
    var st = streak();

    var subjects = D.banks.map(function (b) {
      var ids = {};
      S.attempts.forEach(function (a) {
        Object.keys(a.answers || {}).forEach(function (id) {
          if (id.indexOf(b.id + ":") === 0) ids[id] = true;
        });
      });
      var ok = 0, total = 0;
      S.attempts.forEach(function (a) {
        Object.keys(a.answers || {}).forEach(function (id) {
          if (id.indexOf(b.id + ":") !== 0) return;
          var q = D.byId[id];
          if (!q) return;
          total++;
          if (q.ans === a.answers[id]) ok++;
        });
      });
      return {
        id: b.id, name: b.name, total: b.questions.length,
        seen: Object.keys(ids).length, acc: pct(ok, total)
      };
    });

    var recent = S.attempts.slice(0, 4).map(function (a) {
      var c = correctness(a);
      return '<li><span class="dot ' + (a.type === "mock" ? "dot-mock" : "") + '"></span>' +
        '<span class="r-label">' + esc(a.label) + '</span>' +
        '<span class="r-meta">' + c.ok + "/" + c.total + " · " + fmtDate(a.at) + "</span></li>";
    }).join("");

    el.innerHTML =
      '<section class="dash-hero">' +
        '<div class="dash-hero-copy">' +
          '<p class="eyebrow">' + (cd.past ? "Exam day has passed" : "Exam in " + cd.days + " days · 20 November 2026, 10:00 AM") + '</p>' +
          "<h1>" + (g.answered ? "Welcome back." : "Let’s get you exam-ready.") + "</h1>" +
          '<p class="lede">' + (g.answered
            ? "You have answered " + g.answered + " of 430 questions. Your accuracy is " + g.accuracy + "%. Keep going — consistency beats cramming."
            : "430 solved questions, two timed mocks and a 12-day guided path. Start with Day 1 and the app will track the rest.") + "</p>" +
          '<div class="hero-actions">' +
            (next
              ? '<a class="btn btn-primary" href="study.html">Continue Day ' + next.day + " →</a>"
              : '<a class="btn btn-primary" href="exam.html">Sit a mock →</a>') +
            '<a class="btn btn-ghost" href="practice.html">Quick practice</a>' +
          "</div>" +
        "</div>" +
        '<div class="readiness">' + ring(ready) +
          '<p class="ring-caption">Readiness</p>' +
          '<p class="ring-sub">' + (ready ? "accuracy + coverage" : "no data yet") + "</p>" +
        "</div>" +
      "</section>" +

      '<section class="stat-row">' +
        stat(g.answered, "questions answered") +
        stat(g.accuracy + "%", "accuracy") +
        stat(st, "day streak") +
        stat(S.attempts.filter(function (a) { return a.type === "mock"; }).length, "mocks taken") +
      "</section>" +

      (next ? '<section class="panel continue-panel">' +
        '<div><p class="eyebrow">Next up · Day ' + next.day + " · " + esc(next.date) + "</p>" +
        "<h2>" + esc(next.title) + "</h2><p class=\"muted\">" + esc(next.focus) + "</p></div>" +
        '<a class="btn btn-primary" href="study.html">Open day ' + next.day + "</a></section>" : "") +

      '<section class="panel">' +
        '<div class="panel-head"><h2>Subject progress</h2><a href="progress.html">Details →</a></div>' +
        '<div class="bars">' + subjects.map(function (s) {
          return '<div class="bar-row"><span class="bar-name">' + esc(s.name) + "</span>" +
            '<span class="bar"><i style="width:' + pct(s.seen, s.total) + '%"></i></span>' +
            '<span class="bar-val">' + s.seen + "/" + s.total + " · " + s.acc + "%</span></div>";
        }).join("") + "</div>" +
      "</section>" +

      '<section class="grid-2">' +
        '<div class="panel"><div class="panel-head"><h2>Quick actions</h2></div>' +
          '<div class="action-list">' +
            '<a href="practice.html?bank=math&n=10"><b>10 maths questions</b><span>Percentage, profit & loss, ratio</span></a>' +
            '<a href="practice.html?bank=gk&n=10"><b>10 banking GK questions</b><span>Rates, regulators, DBBL</span></a>' +
            '<a href="exam.html?mock=mock2"><b>45-minute mock</b><span>50 questions, auto-marked</span></a>' +
            '<a href="practice.html?weak=1"><b>Practise my mistakes</b><span>Built from your wrong answers</span></a>' +
          "</div>" +
        "</div>" +
        '<div class="panel"><div class="panel-head"><h2>Recent activity</h2></div>' +
          (recent ? '<ul class="recent">' + recent + "</ul>" : '<p class="muted">No attempts yet. Your first practice set will appear here.</p>') +
        "</div>" +
      "</section>" +

      '<section class="panel facts-panel">' +
        '<div class="panel-head"><h2>The exam, in one box</h2><a href="exam-brief.html">Full brief →</a></div>' +
        '<div class="fact-grid">' +
          fact("Date", "20 November 2026") + fact("Time", "10:00 AM") +
          fact("Format", "MCQ + Written") + fact("Posts", "MTO · AO · TCO") +
          fact("Probation pay", "BDT 26,000") + fact("Confirmed pay", "BDT 41,410") +
          fact("Repo rate", "9.50%") + fact("Inflation", "8.34%") +
        "</div>" +
      "</section>";
  }

  function stat(v, label) {
    return '<div class="stat"><b>' + v + "</b><span>" + label + "</span></div>";
  }

  function fact(k, v) {
    return "<div><span>" + esc(k) + "</span><b>" + esc(v) + "</b></div>";
  }

  /* ---------------- study ---------------- */

  function viewStudy(el) {
    var done = PLAN.filter(function (d) { return S.study[d.day]; }).length;
    var next = nextStudyDay();

    el.innerHTML =
      '<section class="page-hero">' +
        '<p class="eyebrow">Guided path</p>' +
        "<h1>12 days to the exam</h1>" +
        '<p class="lede">One focus per day, with the exact practice set linked. Tick a day when you finish it — the app remembers.</p>' +
        '<div class="study-progress"><span class="bar"><i style="width:' + pct(done, 12) + '%"></i></span>' +
        "<b>" + done + " / 12 days complete</b></div>" +
      "</section>" +

      '<section class="timeline">' +
      PLAN.map(function (d) {
        var isDone = !!S.study[d.day];
        var isNext = next && next.day === d.day;
        return '<article class="day' + (isDone ? " done" : "") + (isNext ? " next" : "") + '">' +
          '<div class="day-marker"><span>' + d.day + "</span></div>" +
          '<div class="day-body">' +
            '<header><div><p class="day-date">' + esc(d.date) + (isNext ? " · next up" : "") + "</p>" +
            "<h2>" + esc(d.title) + "</h2><p class=\"muted\">" + esc(d.focus) + "</p></div>" +
            '<button class="btn btn-small ' + (isDone ? "btn-ghost" : "btn-soft") + '" data-day="' + d.day + '">' +
            (isDone ? "Completed ✓" : "Mark done") + "</button></header>" +
            '<ul class="tasks">' + d.tasks.map(function (t) {
              return '<li><a href="' + t.href + '">' + esc(t.t) + " →</a></li>";
            }).join("") + "</ul>" +
          "</div></article>";
      }).join("") +
      "</section>" +

      '<section class="panel">' +
        '<div class="panel-head"><h2>Short on time?</h2></div>' +
        '<p class="muted">If you have only three days, do: formula sheet + Math Q1–Q45 + all English rules; then Mock 1 and its review; then Mock 2 + the last-48-hours sheet. The full fallback plans are in the study-plan page.</p>' +
        '<a class="btn btn-ghost" href="study-plan.html">Read the fallback plans</a>' +
      "</section>";

    el.querySelectorAll("[data-day]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var day = btn.getAttribute("data-day");
        if (S.study[day]) delete S.study[day];
        else S.study[day] = true;
        writeState();
        viewStudy(el);
      });
    });
  }

  /* ---------------- practice ---------------- */

  var P = { queue: [], i: 0, answers: {}, mode: "instant", label: "", start: 0, timer: null, flags: {}, lookup: false };

  function viewPractice(el) {
    var params = new URLSearchParams(location.search);

    if (params.get("q")) {
      var q = D.byId[params.get("q")];
      if (q) { startQuiz([q], "instant", "Single question", true); return; }
    }
    if (S.session && S.session.type === "practice" && !params.get("restart")) {
      renderResume(el, S.session);
      return;
    }
    if (params.get("bank")) {
      var bank = D.banks.filter(function (b) { return b.id === params.get("bank"); })[0];
      if (bank) {
        var from = parseInt(params.get("from") || "0", 10);
        var to = parseInt(params.get("to") || "0", 10);
        var n = parseInt(params.get("n") || "0", 10);
        var qs = bank.questions.slice();
        if (from || to) qs = qs.filter(function (x) { return x.n >= (from || 1) && x.n <= (to || 999); });
        if (n) qs = qs.slice(0, n);
        if (qs.length) {
          startQuiz(qs, params.get("mode") === "exam" ? "exam" : "instant", bank.name);
          return;
        }
      }
    }
    if (params.get("weak")) {
      var wrong = weakQuestions(20);
      if (wrong.length) { startQuiz(wrong, "instant", "Your mistakes"); return; }
    }

    renderPracticeSetup(el);
  }

  function weakQuestions(limit) {
    var wrong = {}, seen = {};
    S.attempts.slice().reverse().forEach(function (a) {
      Object.keys(a.answers || {}).forEach(function (id) {
        var q = D.byId[id];
        if (!q) return;
        seen[id] = true;
        if (q.ans !== a.answers[id]) wrong[id] = true;
        else delete wrong[id];
      });
    });
    var ids = Object.keys(wrong);
    if (!ids.length) return [];
    var qs = ids.map(function (id) { return D.byId[id]; }).filter(Boolean);
    for (var i = qs.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = qs[i]; qs[i] = qs[j]; qs[j] = t;
    }
    return qs.slice(0, limit || 20);
  }

  function renderPracticeSetup(el) {
    var cards = D.banks.map(function (b) {
      var ids = {};
      var ok = 0, total = 0;
      S.attempts.forEach(function (a) {
        Object.keys(a.answers || {}).forEach(function (id) {
          if (id.indexOf(b.id + ":") !== 0) return;
          ids[id] = true;
          var q = D.byId[id];
          if (!q) return;
          total++;
          if (q.ans === a.answers[id]) ok++;
        });
      });
      return '<div class="subject-card">' +
        '<div class="subject-head"><h3>' + esc(b.name) + "</h3><span class=\"chip\">" + b.questions.length + " Q</span></div>" +
        '<div class="mini-bar"><i style="width:' + pct(Object.keys(ids).length, b.questions.length) + '%"></i></div>' +
        '<p class="muted small">' + Object.keys(ids).length + " answered · " + pct(ok, total) + "% accuracy</p>" +
        '<div class="subject-actions">' +
          '<button class="btn btn-small btn-soft" data-bank="' + b.id + '" data-n="10">10 questions</button>' +
          '<button class="btn btn-small btn-ghost" data-bank="' + b.id + '" data-n="20">20</button>' +
          '<button class="btn btn-small btn-ghost" data-bank="' + b.id + '" data-n="0">All ' + b.questions.length + "</button>" +
        "</div></div>";
    }).join("");

    var topicsByBank = {};
    D.banks.forEach(function (b) {
      var set = new Set();
      b.questions.forEach(function (q) { set.add(q.topic); });
      topicsByBank[b.id] = Array.from(set).sort();
    });

    var mathFocus = [
      { key: "math:core", label: "Core Arithmetic", topics: ["Percentage", "Profit & Loss", "Ratio", "Average", "Partnership", "Age"] },
      { key: "math:adv", label: "Advanced Math", topics: ["Time & Work", "Pipes", "Speed", "Trains", "Boats", "Interest", "Mixture", "Sets", "Geometry", "Series"] },
    ];
    var englishFocus = [
      { key: "eng:grammar", label: "Grammar Rules", topics: ["Grammar", "Preposition", "Article", "Tense", "Voice", "Narration", "Subject-Verb", "Conditional", "Parallelism", "Modifier"] },
      { key: "eng:vocab", label: "Vocabulary & Usage", topics: ["Vocabulary", "Idiom", "Phrase", "Synonym", "Antonym", "Spelling", "Word Choice"] },
      { key: "eng:comp", label: "Comprehension", topics: ["Comprehension", "Cloze", "Passage"] },
    ];

    function focusHtml(focus, bankId) {
      return focus.map(function (f) {
        var count = D.banks.filter(function (b) { return b.id === bankId; })[0].questions.filter(function (q) {
          return f.topics.some(function (t) { return q.topic.toLowerCase().indexOf(t.toLowerCase()) !== -1; });
        }).length;
        return '<button class="btn btn-small btn-soft" data-focus="' + f.key + '" data-bank="' + bankId + '" data-topics="' + esc(JSON.stringify(f.topics)) + '">' +
          f.label + ' <span class="chip">' + count + ' Q</span></button>';
      }).join(" ");
    }

    el.innerHTML =
      '<section class="page-hero">' +
        '<p class="eyebrow">Practice</p>' +
        "<h1>Test yourself, one question at a time</h1>" +
        '<p class="lede">Instant feedback with the worked explanation. Answers are saved so your weak topics build up automatically.</p>' +
      "</section>" +
      '<div class="mode-row">' +
        '<label class="switch"><input type="checkbox" id="examMode"><span>Exam style — hide feedback until the end</span></label>' +
        '<a class="btn btn-small btn-ghost" href="practice.html?weak=1">Practise my mistakes</a>' +
      "</div>" +
      '<section class="subject-grid">' + cards + "</section>" +
      '<section class="panel subject-focus">' +
        '<div class="panel-head"><h2>Study by Subject — Focused Drills</h2></div>' +
        '<p class="muted small">Pick a focus area. Questions are filtered by topic. Your weak topics are highlighted on the progress page.</p>' +
        '<div class="focus-tabs" role="tablist">' +
          '<button class="focus-tab active" role="tab" data-focus-tab="math">Mathematics</button>' +
          '<button class="focus-tab" role="tab" data-focus-tab="english">English</button>' +
          '<button class="focus-tab" role="tab" data-focus-tab="others">Other Subjects</button>' +
        '</div>' +
        '<div class="focus-panels">' +
          '<div class="focus-panel active" data-focus-panel="math">' +
            '<p class="focus-desc">Maths is the differentiator. Drill the exact topic you need.</p>' +
            '<div class="focus-btns">' + focusHtml(mathFocus, "math") + '</div>' +
            '<div class="topic-list" id="mathTopics"></div>' +
          '</div>' +
          '<div class="focus-panel" data-focus-panel="english">' +
            '<p class="focus-desc">English rules carry the most marks per minute. Master the patterns.</p>' +
            '<div class="focus-btns">' + focusHtml(englishFocus, "english") + '</div>' +
            '<div class="topic-list" id="englishTopics"></div>' +
          '</div>' +
          '<div class="focus-panel" data-focus-panel="others">' +
            '<p class="focus-desc">Quick drills for the remaining subjects.</p>' +
            '<div class="focus-btns">' +
              D.banks.filter(function (b) { return b.id !== "math" && b.id !== "english"; }).map(function (b) {
                return '<button class="btn btn-small btn-soft" data-bank="' + b.id + '" data-n="10">' + b.name + ' (10)</button>' +
                  '<button class="btn btn-small btn-ghost" data-bank="' + b.id + '" data-n="20">' + b.name + ' (20)</button>';
              }).join(" ") +
            '</div>' +
          '</div>' +
        '</div>' +
      "</section>" +
      '<section class="panel">' +
        '<div class="panel-head"><h2>Mixed set</h2></div>' +
        '<p class="muted">Twenty questions drawn from every subject — the closest thing to the real paper’s variety.</p>' +
        '<button class="btn btn-primary" id="mixedBtn">Start 20 mixed questions</button>' +
      "</section>";

    var examMode = el.querySelector("#examMode");
    function mode() { return examMode && examMode.checked ? "exam" : "instant"; }

    el.querySelectorAll("[data-bank]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-bank");
        var n = parseInt(btn.getAttribute("data-n"), 10);
        var bank = D.banks.filter(function (b) { return b.id === id; })[0];
        var qs = bank.questions.slice();
        if (n) qs = qs.slice(0, n);
        startQuiz(qs, mode(), bank.name);
      });
    });

    var mixed = el.querySelector("#mixedBtn");
    if (mixed) mixed.addEventListener("click", function () {
      var pool = allQuestions().slice();
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      startQuiz(pool.slice(0, 20), mode(), "Mixed practice");
    });

    el.querySelectorAll(".focus-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-focus-tab");
        el.querySelectorAll(".focus-tab").forEach(function (t) { t.classList.remove("active"); });
        el.querySelectorAll(".focus-panel").forEach(function (p) { p.classList.remove("active"); });
        tab.classList.add("active");
        var panel = el.querySelector('[data-focus-panel="' + target + '"]');
        if (panel) panel.classList.add("active");
        if (target === "math") renderTopicList("math", el.querySelector("#mathTopics"));
        if (target === "english") renderTopicList("english", el.querySelector("#englishTopics"));
      });
    });

    el.querySelectorAll("[data-focus]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var bankId = btn.getAttribute("data-bank");
        var topics = JSON.parse(btn.getAttribute("data-topics") || "[]");
        var bank = D.banks.filter(function (b) { return b.id === bankId; })[0];
        var qs = bank.questions.filter(function (q) {
          return topics.some(function (t) { return q.topic.toLowerCase().indexOf(t.toLowerCase()) !== -1; });
        });
        if (qs.length) startQuiz(qs, mode(), btn.textContent.trim().split(" ")[0] + " drill");
      });
    });

    function renderTopicList(bankId, container) {
      if (!container || container.innerHTML.trim()) return;
      var topics = topicsByBank[bankId];
      var stats = {};
      S.attempts.forEach(function (a) {
        Object.keys(a.answers || {}).forEach(function (id) {
          if (id.indexOf(bankId + ":") !== 0) return;
          var q = D.byId[id];
          if (!q) return;
          if (!stats[q.topic]) stats[q.topic] = { ok: 0, total: 0 };
          stats[q.topic].total++;
          if (q.ans === a.answers[id]) stats[q.topic].ok++;
        });
      });
      var bank = D.banks.filter(function (b) { return b.id === bankId; })[0];
      container.innerHTML = '<p class="muted small">All topics in ' + bankId + ' — click to practise (weak topics first)</p>' +
        '<div class="topic-chips">' + topics.map(function (t) {
          var st = stats[t] || { ok: 0, total: 0 };
          var totalInBank = bank ? bank.questions.filter(function (q) { return q.topic === t; }).length : 0;
          var acc = st.total ? Math.round(st.ok * 100 / st.total) : 0;
          var cls = "topic-chip" + (st.total && acc < 60 ? " weak" : "") + (st.total && acc >= 80 ? " strong" : "");
          return '<button class="' + cls + '" data-bank="' + bankId + '" data-topic="' + esc(t) + '">' +
            esc(t) + ' <span class="chip">' + st.total + '/' + totalInBank + '</span>' +
            (st.total ? ' <span class="acc">' + acc + '%</span>' : '') + '</button>';
        }).join(" ") + '</div>';
      container.querySelectorAll("[data-topic]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var bankId = btn.getAttribute("data-bank");
          var topic = btn.getAttribute("data-topic");
          var bank = D.banks.filter(function (b) { return b.id === bankId; })[0];
          var qs = bank.questions.filter(function (q) { return q.topic === topic; });
          if (qs.length) startQuiz(qs, mode(), topic);
        });
      });
    }

    if (el.querySelector("#mathTopics")) renderTopicList("math", el.querySelector("#mathTopics"));
  }

  function renderResume(el, session) {
    el.innerHTML =
      '<section class="panel resume">' +
        "<h1>Resume your practice?</h1>" +
        '<p class="muted">' + esc(session.label) + " — question " + (session.i + 1) + " of " + session.ids.length + ".</p>" +
        '<div class="hero-actions"><button class="btn btn-primary" id="resumeBtn">Resume</button>' +
        '<button class="btn btn-ghost" id="discardBtn">Start fresh</button></div>' +
      "</section>";
    el.querySelector("#resumeBtn").addEventListener("click", function () {
      var qs = session.ids.map(function (id) { return D.byId[id]; }).filter(Boolean);
      P = {
        queue: qs, i: session.i || 0, answers: session.answers || {},
        mode: session.mode || "instant", label: session.label,
        start: session.start || Date.now(), timer: null, flags: {}, lookup: false
      };
      renderQuiz(el);
    });
    el.querySelector("#discardBtn").addEventListener("click", function () {
      S.session = null; writeState(); renderPracticeSetup(el);
    });
  }

  function startQuiz(questions, mode, label, lookup) {
    P = {
      queue: questions, i: 0, answers: {}, mode: mode || "instant",
      label: label || "Practice", start: Date.now(), timer: null, flags: {},
      lookup: !!lookup
    };
    S.session = {
      type: "practice", ids: questions.map(function (q) { return q.id; }),
      i: 0, answers: {}, mode: P.mode, label: P.label, start: P.start
    };
    writeState();
    renderQuiz(document.getElementById("view"));
  }

  function renderQuiz(el) {
    var q = P.queue[P.i];
    if (!q) { finishQuiz(el); return; }
    var chosen = P.answers[q.id];
    var answered = chosen != null;
    var showFeedback = P.mode === "instant" && answered;
    var letters = Object.keys(q.opts);

    el.innerHTML =
      '<div class="quiz-top">' +
        '<div><p class="eyebrow">' + esc(P.label) + "</p>" +
        '<div class="quiz-count">Question ' + (P.i + 1) + " of " + P.queue.length + "</div></div>" +
        '<div class="quiz-meta"><span class="chip">' + esc(q.topic) + '</span><span id="quizClock" class="clock">0:00</span></div>' +
      "</div>" +
      '<div class="quiz-progress"><i style="width:' + pct(P.i, P.queue.length) + '%"></i></div>' +
      '<article class="question-card">' +
        '<p class="q-text">' + esc(q.q) + "</p>" +
        '<div class="options">' + letters.map(function (L) {
          var cls = "option";
          if (showFeedback && L === q.ans) cls += " correct";
          if (showFeedback && L === chosen && L !== q.ans) cls += " wrong";
          if (!showFeedback && L === chosen) cls += " selected";
          return '<button class="' + cls + '" data-opt="' + L + '"' + (answered ? " disabled" : "") + ">" +
            '<span class="opt-key">' + esc(L) + "</span><span class=\"opt-text\">" + esc(q.opts[L]) + "</span></button>";
        }).join("") + "</div>" +
      "</article>" +
      '<div id="feedback" class="feedback">' + (showFeedback ? feedbackHtml(q, chosen) : "") + "</div>" +
      '<div class="quiz-actions">' +
        '<button class="btn btn-ghost" id="prevBtn"' + (P.i === 0 ? " disabled" : "") + ">← Back</button>" +
        (answered || P.mode === "exam"
          ? '<button class="btn btn-primary" id="nextBtn">' + (P.i + 1 === P.queue.length ? "Finish" : "Next →") + "</button>"
          : '<span class="hint">Pick an answer</span>') +
      "</div>";

    el.querySelectorAll("[data-opt]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (P.answers[q.id] != null) return;
        P.answers[q.id] = btn.getAttribute("data-opt");
        S.session.answers = P.answers;
        writeState();
        renderQuiz(el);
      });
    });

    var next = el.querySelector("#nextBtn");
    if (next) next.addEventListener("click", function () {
      if (P.i + 1 >= P.queue.length) finishQuiz(el);
      else { P.i++; S.session.i = P.i; writeState(); renderQuiz(el); }
    });
    var prev = el.querySelector("#prevBtn");
    if (prev) prev.addEventListener("click", function () {
      if (P.i > 0) { P.i--; S.session.i = P.i; writeState(); renderQuiz(el); }
    });

    startClock(el, P.start, false);
  }

  function extractShortcut(exp) {
    if (!exp) return null;
    var m = exp.match(/Shortcut[:\s]+([^.]+(?:\.[^.]+)?)/i);
    if (m) return m[1].trim();
    var m2 = exp.match(/(?:^|[\.\?\!])\s*(?:Rule|Trick|Tip|Key|Formula)[:\s]+([^.]+(?:\.[^.]+)?)/i);
    if (m2) return m2[1].trim();
    return null;
  }

  function feedbackHtml(q, chosen) {
    var ok = chosen === q.ans;
    var shortcut = extractShortcut(q.exp);
    return '<div class="feedback-box ' + (ok ? "ok" : "bad") + '">' +
      '<p class="fb-title">' + (ok ? "Correct" : "Not quite") + "</p>" +
      (ok ? "" : '<p class="fb-answer">Correct answer: <b>' + esc(q.ans) + ") " + esc(q.opts[q.ans]) + "</b></p>") +
      (shortcut ? '<div class="fb-shortcut"><span class="sc-label">⚡ Shortcut</span><span class="sc-text">' + esc(shortcut) + "</span></div>" : "") +
      '<p class="fb-exp">' + esc(q.exp || "No explanation was written for this one — re-read the rule or formula in the reference notes.") + "</p>" +
      "</div>";
  }

  function startClock(el, start, countdown) {
    var node = el.querySelector("#quizClock");
    if (!node) return;
    if (P.timer) clearInterval(P.timer);
    P.timer = setInterval(function () {
      var sec = (Date.now() - start) / 1000;
      node.textContent = fmtTime(sec);
    }, 1000);
  }

  function finishQuiz(el) {
    if (P.timer) clearInterval(P.timer);
    var ok = 0, total = 0, wrong = [];
    P.queue.forEach(function (q) {
      if (P.answers[q.id] == null) return;
      total++;
      if (P.answers[q.id] === q.ans) ok++;
      else wrong.push(q);
    });
    var secs = Math.round((Date.now() - P.start) / 1000);
    saveAttempt({
      type: "practice", label: P.label, total: P.queue.length,
      correct: ok, answered: total, seconds: secs, answers: P.answers,
      ids: P.queue.map(function (q) { return q.id; })
    });
    P.timer = null;

    el.innerHTML =
      '<section class="result-hero">' + ring(pct(ok, total || 1), 132, 12) +
        '<div><p class="eyebrow">' + esc(P.label) + "</p>" +
        "<h1>" + ok + " / " + total + " correct</h1>" +
        '<p class="muted">' + fmtTime(secs) + " · " + pct(ok, total || 1) + "% · saved to your progress</p>" +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary" href="practice.html?restart=1">New set</a>' +
          (wrong.length ? '<button class="btn btn-ghost" id="retryWrong">Retry ' + wrong.length + " wrong</button>" : "") +
          '<a class="btn btn-ghost" href="progress.html">See progress</a>' +
        "</div></div>" +
      "</section>" +
      '<section class="panel"><div class="panel-head"><h2>Review</h2></div>' +
        '<div class="review-list">' + P.queue.map(function (q) {
          var chosen = P.answers[q.id];
          var good = chosen === q.ans;
          return '<details class="review ' + (good ? "good" : "bad") + '">' +
            "<summary><span class=\"badge\">" + (good ? "✓" : "✕") + "</span>" +
            "<span>" + esc(q.q) + "</span></summary>" +
            '<div class="review-body">' +
              '<p>Your answer: <b>' + (chosen ? esc(chosen) + ") " + esc(q.opts[chosen]) : "not answered") + "</b></p>" +
              '<p>Correct: <b>' + esc(q.ans) + ") " + esc(q.opts[q.ans]) + "</b></p>" +
              '<p class="muted">' + esc(q.exp || "No explanation written.") + "</p>" +
            "</div></details>";
        }).join("") + "</div>" +
      "</section>";

    var retry = el.querySelector("#retryWrong");
    if (retry) retry.addEventListener("click", function () { startQuiz(wrong, "instant", "Retry"); });
  }

  /* ---------------- exam ---------------- */

  var E = { mock: null, i: 0, answers: {}, flags: {}, start: 0, end: 0, timer: null };

  function viewExam(el) {
    var params = new URLSearchParams(location.search);
    if (S.session && S.session.type === "mock" && !params.get("restart")) {
      renderExamResume(el, S.session);
      return;
    }
    var wanted = params.get("mock");
    if (wanted) {
      var m = D.mocks.filter(function (x) { return x.id === wanted; })[0];
      if (m) { startExam(m); return; }
    }
    renderExamSetup(el);
  }

  function renderExamSetup(el) {
    var cards = D.mocks.map(function (m) {
      var last = S.attempts.filter(function (a) { return a.mockId === m.id; })[0];
      return '<article class="mock-card">' +
        '<div class="mock-top"><span class="chip">' + m.questions.length + " questions</span>" +
        '<span class="chip">' + m.minutes + " minutes</span></div>" +
        "<h2>" + esc(m.name) + "</h2>" +
        '<p class="muted">' + (m.id === "mock1"
          ? "The full paper: English, maths, analytical, GK and ICT. Do this on Day 10."
          : "The short paper. Use it on Day 7 to find your weak sections early.") + "</p>" +
        '<p class="small">' + (last
          ? "Last attempt: <b>" + last.correct + "/" + last.total + "</b> · " + pct(last.correct, last.total) + "%"
          : "No attempt yet") + "</p>" +
        '<a class="btn btn-primary" href="exam.html?mock=' + m.id + '">Start ' + esc(m.name) + "</a>" +
      "</article>";
    }).join("");

    el.innerHTML =
      '<section class="page-hero"><p class="eyebrow">Mock exams</p>' +
        "<h1>Sit the real thing</h1>" +
        '<p class="lede">Timed, auto-marked, with a question palette and a full review. Your score is saved.</p>' +
      "</section>" +
      '<section class="mock-grid">' + cards + "</section>" +
      '<section class="panel"><div class="panel-head"><h2>Exam-hall rules</h2></div>' +
        '<ul class="clean"><li>No calculator, phone or smart watch.</li>' +
        "<li>The timer auto-submits at zero — answer everything.</li>" +
        "<li>Flag a question and come back; never spend more than a minute on one.</li>" +
        "<li>Unanswered questions are marked wrong, exactly like a real OMR sheet.</li></ul>" +
        '<a class="btn btn-ghost" href="exam-brief.html">Read the exam brief</a></section>';
  }

  function renderExamResume(el, session) {
    el.innerHTML =
      '<section class="panel resume"><h1>Resume ' + esc(session.label) + "?</h1>" +
        '<p class="muted">Question ' + (session.i + 1) + " of " + session.ids.length +
        ". The clock kept running — you have " + fmtTime(Math.max(0, (session.end - Date.now()) / 1000)) + " left.</p>" +
        '<div class="hero-actions"><button class="btn btn-primary" id="resumeExam">Resume</button>' +
        '<button class="btn btn-ghost" id="discardExam">Discard</button></div></section>';
    el.querySelector("#resumeExam").addEventListener("click", function () {
      var m = D.mocks.filter(function (x) { return x.id === session.mockId; })[0];
      E = {
        mock: m, i: session.i || 0, answers: session.answers || {},
        flags: session.flags || {}, start: session.start,
        end: session.end, timer: null
      };
      renderExamRunner(el);
    });
    el.querySelector("#discardExam").addEventListener("click", function () {
      S.session = null; writeState(); renderExamSetup(el);
    });
  }

  function startExam(m) {
    var end = Date.now() + m.minutes * 60000;
    E = { mock: m, i: 0, answers: {}, flags: {}, start: Date.now(), end: end, timer: null };
    S.session = {
      type: "mock", mockId: m.id, ids: m.questions.map(function (q) { return q.id; }),
      i: 0, answers: {}, flags: {}, label: m.name, start: E.start, end: end
    };
    writeState();
    renderExamRunner(document.getElementById("view"));
  }

  function renderExamRunner(el) {
    var m = E.mock;
    var q = m.questions[E.i];
    var letters = Object.keys(q.opts);
    var left = Math.max(0, (E.end - Date.now()) / 1000);
    if (left <= 0) { submitExam(el); return; }

    var palette = m.questions.map(function (x, idx) {
      var cls = "pal";
      if (E.answers[x.id] != null) cls += " answered";
      if (E.flags[x.id]) cls += " flagged";
      if (idx === E.i) cls += " current";
      return '<button class="' + cls + '" data-goto="' + idx + '">' + (idx + 1) + "</button>";
    }).join("");

    el.innerHTML =
      '<div class="exam-top"><div><p class="eyebrow">' + esc(m.name) + "</p>" +
        '<div class="quiz-count">Question ' + (E.i + 1) + " of " + m.questions.length + "</div></div>" +
        '<div class="exam-timer" id="examTimer">' + fmtTime(left) + "</div></div>" +
      '<div class="exam-grid">' +
        '<aside class="palette"><p class="pal-label">Questions</p><div class="pal-grid">' + palette + "</div>" +
          '<button class="btn btn-primary btn-block" id="submitBtn">Submit paper</button>' +
          '<p class="small muted">' + Object.keys(E.answers).length + " answered · " + Object.keys(E.flags).length + " flagged</p>" +
        "</aside>" +
        '<div class="exam-main">' +
          '<article class="question-card">' +
            '<div class="q-head"><span class="chip">' + esc(q.topic) + '</span>' +
              '<button class="flag-btn' + (E.flags[q.id] ? " on" : "") + '" id="flagBtn">⚑ Flag</button></div>' +
            '<p class="q-text">' + esc(q.q) + "</p>" +
            '<div class="options">' + letters.map(function (L) {
              return '<button class="option' + (E.answers[q.id] === L ? " selected" : "") + '" data-opt="' + L + '">' +
                '<span class="opt-key">' + esc(L) + '</span><span class="opt-text">' + esc(q.opts[L]) + "</span></button>";
            }).join("") + "</div>" +
          "</article>" +
          '<div class="quiz-actions"><button class="btn btn-ghost" id="prevBtn"' + (E.i === 0 ? " disabled" : "") + ">← Back</button>" +
            '<button class="btn btn-primary" id="nextBtn">' + (E.i + 1 === m.questions.length ? "Review & submit" : "Next →") + "</button></div>" +
        "</div>" +
      "</div>";

    el.querySelectorAll("[data-opt]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        E.answers[q.id] = btn.getAttribute("data-opt");
        S.session.answers = E.answers;
        writeState();
        renderExamRunner(el);
      });
    });
    el.querySelectorAll("[data-goto]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        E.i = parseInt(btn.getAttribute("data-goto"), 10);
        S.session.i = E.i;
        writeState();
        renderExamRunner(el);
      });
    });
    el.querySelector("#prevBtn").addEventListener("click", function () {
      if (E.i > 0) { E.i--; S.session.i = E.i; writeState(); renderExamRunner(el); }
    });
    el.querySelector("#nextBtn").addEventListener("click", function () {
      if (E.i + 1 >= m.questions.length) confirmSubmit(el);
      else { E.i++; S.session.i = E.i; writeState(); renderExamRunner(el); }
    });
    el.querySelector("#flagBtn").addEventListener("click", function () {
      if (E.flags[q.id]) delete E.flags[q.id];
      else E.flags[q.id] = true;
      S.session.flags = E.flags;
      writeState();
      renderExamRunner(el);
    });
    el.querySelector("#submitBtn").addEventListener("click", function () { confirmSubmit(el); });

    if (E.timer) clearInterval(E.timer);
    E.timer = setInterval(function () {
      var node = document.getElementById("examTimer");
      var s = Math.max(0, (E.end - Date.now()) / 1000);
      if (node) node.textContent = fmtTime(s);
      if (s <= 0) { clearInterval(E.timer); E.timer = null; submitExam(el); }
    }, 1000);
  }

  function confirmSubmit(el) {
    var answered = Object.keys(E.answers).length;
    var total = E.mock.questions.length;
    if (answered < total && !window.confirm("You have answered " + answered + " of " + total + ". Unanswered questions score zero. Submit anyway?")) return;
    submitExam(el);
  }

  function submitExam(el) {
    if (E.timer) clearInterval(E.timer);
    E.timer = null;
    var ok = 0;
    E.mock.questions.forEach(function (q) { if (E.answers[q.id] === q.ans) ok++; });
    var secs = Math.round((Date.now() - E.start) / 1000);
    saveAttempt({
      type: "mock", mockId: E.mock.id, label: E.mock.name,
      total: E.mock.questions.length, correct: ok, answered: Object.keys(E.answers).length,
      seconds: secs, answers: E.answers, ids: E.mock.questions.map(function (q) { return q.id; })
    });
    renderExamResult(el, E.mock, E.answers, ok, secs);
  }

  function renderExamResult(el, m, answers, ok, secs) {
    var sections = {};
    m.questions.forEach(function (q) {
      if (!sections[q.topic]) sections[q.topic] = { ok: 0, total: 0 };
      sections[q.topic].total++;
      if (answers[q.id] === q.ans) sections[q.topic].ok++;
    });

    el.innerHTML =
      '<section class="result-hero">' + ring(pct(ok, m.questions.length), 140, 12) +
        '<div><p class="eyebrow">' + esc(m.name) + "</p>" +
        "<h1>" + ok + " / " + m.questions.length + "</h1>" +
        '<p class="muted">' + fmtTime(secs) + " · " + pct(ok, m.questions.length) + "% · saved</p>" +
        '<div class="hero-actions"><a class="btn btn-primary" href="exam.html?mock=' + m.id + '&restart=1">Retake</a>' +
        '<a class="btn btn-ghost" href="progress.html">Progress</a></div></div></section>' +
      '<section class="panel"><div class="panel-head"><h2>Section breakdown</h2></div>' +
        '<div class="bars">' + Object.keys(sections).map(function (k) {
          var s = sections[k];
          return '<div class="bar-row"><span class="bar-name">' + esc(k) + "</span>" +
            '<span class="bar"><i style="width:' + pct(s.ok, s.total) + '%"></i></span>' +
            '<span class="bar-val">' + s.ok + "/" + s.total + "</span></div>";
        }).join("") + "</div></section>" +
      '<section class="panel"><div class="panel-head"><h2>Review every question</h2></div>' +
        '<div class="review-list">' + m.questions.map(function (q) {
          var chosen = answers[q.id];
          var good = chosen === q.ans;
          return '<details class="review ' + (good ? "good" : "bad") + '">' +
            "<summary><span class=\"badge\">" + (good ? "✓" : "✕") + "</span><span>" + q.n + ". " + esc(q.q) + "</span></summary>" +
            '<div class="review-body"><p>Your answer: <b>' + (chosen ? esc(chosen) + ") " + esc(q.opts[chosen]) : "not answered") + "</b></p>" +
            '<p>Correct: <b>' + esc(q.ans) + ") " + esc(q.opts[q.ans]) + "</b></p>" +
            '<p class="muted">' + esc(q.exp || "No explanation written.") + "</p></div></details>";
        }).join("") + "</div></section>";
  }

  /* ---------------- progress ---------------- */

  function viewProgress(el) {
    var g = globalStats();
    var ready = readiness();
    var topics = topicStats();
    var weak = topics.filter(function (t) { return t.total >= 3 && t.acc < 70; }).slice(0, 6);
    var strong = topics.filter(function (t) { return t.total >= 3 && t.acc >= 80; }).slice(-4).reverse();

    var history = S.attempts.map(function (a, idx) {
      var c = correctness(a);
      return '<tr><td>' + fmtDate(a.at) + "</td><td>" + esc(a.label) + "</td>" +
        '<td><span class="pill ' + (a.type === "mock" ? "pill-mock" : "") + '">' + a.type + "</span></td>" +
        "<td><b>" + c.ok + "/" + c.total + "</b></td>" +
        "<td>" + pct(c.ok, c.total) + "%</td><td>" + fmtTime(a.seconds || 0) + "</td>" +
        '<td><button class="link-btn" data-review="' + idx + '">Review</button></td></tr>';
    }).join("");

    el.innerHTML =
      '<section class="page-hero"><p class="eyebrow">Progress</p><h1>Your readiness</h1>' +
        '<p class="lede">Readiness combines accuracy with how much of the 430-question bank you have actually covered.</p></section>' +
      '<section class="progress-top">' +
        '<div class="panel center">' + ring(ready, 132, 12) + '<p class="ring-caption">Readiness</p></div>' +
        '<div class="panel"><div class="stat-row tight">' +
          stat(g.answered, "unique questions") + stat(g.accuracy + "%", "accuracy") +
          stat(g.attempts, "sets completed") + stat(streak(), "day streak") +
        "</div></div>" +
      "</section>" +
      (weak.length ? '<section class="panel"><div class="panel-head"><h2>Weak topics</h2>' +
        '<a href="practice.html?weak=1">Practise these →</a></div><div class="topic-grid">' +
        weak.map(function (t) {
          return '<div class="topic ' + (t.acc < 50 ? "weak" : "mid") + '"><span>' + esc(t.topic) + "</span>" +
            "<b>" + t.acc + "%</b><small>" + esc(t.bank) + " · " + t.ok + "/" + t.total + "</small></div>";
        }).join("") + "</div></section>" : "") +
      (strong.length ? '<section class="panel"><div class="panel-head"><h2>Strong topics</h2></div><div class="topic-grid">' +
        strong.map(function (t) {
          return '<div class="topic strong"><span>' + esc(t.topic) + "</span><b>" + t.acc + "%</b>" +
            "<small>" + esc(t.bank) + " · " + t.ok + "/" + t.total + "</small></div>";
        }).join("") + "</div></section>" : "") +
      '<section class="panel"><div class="panel-head"><h2>History</h2>' +
        '<button class="link-btn danger" id="resetBtn">Reset all data</button></div>' +
        (S.attempts.length
          ? '<div class="table-wrap"><table class="history"><thead><tr><th>When</th><th>Set</th><th>Type</th><th>Score</th><th>%</th><th>Time</th><th></th></tr></thead><tbody>' + history + "</tbody></table></div>"
          : '<p class="muted">No attempts yet. Start with a 10-question practice set.</p>') +
      "</section>" +
      '<div id="reviewModal" class="modal" hidden><div class="modal-card"><div class="modal-head">' +
        '<h2>Review</h2><button class="icon-btn" id="closeReview">✕</button></div><div id="reviewBody"></div></div></div>';

    el.querySelectorAll("[data-review]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var a = S.attempts[parseInt(btn.getAttribute("data-review"), 10)];
        var body = document.getElementById("reviewBody");
        body.innerHTML = (a.ids || Object.keys(a.answers)).map(function (id) {
          var q = D.byId[id];
          if (!q) return "";
          var chosen = a.answers[id];
          var good = chosen === q.ans;
          return '<div class="review-line ' + (good ? "good" : "bad") + '">' +
            '<p><b>' + (good ? "✓" : "✕") + "</b> " + esc(q.q) + "</p>" +
            '<p class="small">You: ' + (chosen ? esc(chosen) + ") " + esc(q.opts[chosen]) : "—") +
            " · Correct: " + esc(q.ans) + ") " + esc(q.opts[q.ans]) + "</p></div>";
        }).join("");
        document.getElementById("reviewModal").hidden = false;
      });
    });
    var close = el.querySelector("#closeReview");
    if (close) close.addEventListener("click", function () { document.getElementById("reviewModal").hidden = true; });
    var reset = el.querySelector("#resetBtn");
    if (reset) reset.addEventListener("click", function () {
      if (!window.confirm("Delete all attempts and study progress? This cannot be undone.")) return;
      S = { attempts: [], study: {}, session: null };
      writeState();
      viewProgress(el);
    });
  }

  /* ---------------- library ---------------- */

  function viewLibrary(el) {
    fetch("assets/data/library.json")
      .then(function (r) { return r.json(); })
      .then(function (items) {
        var groups = [];
        items.forEach(function (i) { if (groups.indexOf(i.group) === -1) groups.push(i.group); });
        el.innerHTML =
          '<section class="page-hero"><p class="eyebrow">Library</p><h1>Everything, as a reading page</h1>' +
            '<p class="lede">The full notes behind the practice sets. Every page is also downloadable as Markdown.</p></section>' +
          groups.map(function (g) {
            return "<h2 class=\"group-title\">" + esc(g) + "</h2><div class=\"cards\">" +
              items.filter(function (i) { return i.group === g; }).map(function (i) {
                return '<a class="card" href="' + i.slug + '.html"><span class="card-icon">' + i.icon + "</span>" +
                  '<span class="card-group">' + esc(i.group) + "</span><h3>" + esc(i.title) + "</h3>" +
                  "<p>" + esc(i.blurb) + '</p><span class="card-go">Open →</span></a>';
              }).join("") + "</div>";
          }).join("") +
          '<section class="panel"><div class="panel-head"><h2>Downloads & past papers</h2></div>' +
            '<div class="hero-actions"><a class="btn btn-ghost" href="past-papers.html">18 scanned past papers</a>' +
            '<a class="btn btn-ghost" href="downloads.html">Markdown downloads</a></div></section>';
      });
  }

  /* ---------------- search page ---------------- */

  function viewSearch(el) {
    var params = new URLSearchParams(location.search);
    var q = params.get("q") || "";

    el.innerHTML =
      '<section class="page-hero"><p class="eyebrow">Search</p><h1>Find anything</h1>' +
        '<input class="big-search" id="bigQ" type="search" placeholder="Try “profit”, “repo rate”, “seating”, “viva”…" value="' + esc(q) + '">' +
      "</section><div id=\"searchResults\"></div>";

    var input = el.querySelector("#bigQ");
    var out = el.querySelector("#searchResults");

    function run() {
      var query = input.value.trim().toLowerCase();
      if (!query) { out.innerHTML = '<p class="muted">Type at least one word.</p>'; return; }
      if (!SEARCH.index) {
        out.innerHTML = '<p class="muted">Loading index…</p>';
        fetch("assets/data/search.json").then(function (r) { return r.json(); }).then(function (d) {
          SEARCH.index = d; run();
        });
        return;
      }
      var hits = findHits(SEARCH.index, query);
      if (!hits.length) { out.innerHTML = '<p class="muted">No results for “' + esc(input.value) + '”.</p>'; return; }
      out.innerHTML = '<p class="muted">' + hits.length + " results</p>" +
        '<div class="search-list">' + hits.slice(0, 120).map(function (e) {
          return '<a class="search-item" href="' + esc(e.u) + '"><span class="kind ' + esc(e.k) + '">' + esc(e.k) + "</span>" +
            '<span class="search-text">' + esc(e.t) + "</span><span class=\"search-group\">" + esc(e.g) + "</span></a>";
        }).join("") + "</div>";
    }

    input.addEventListener("input", run);
    if (q) run();
    else out.innerHTML = '<p class="muted">Type a word above, or press / anywhere on the site.</p>';
  }

  /* ---------------- boot ---------------- */

  var VIEWS = {
    dashboard: viewDashboard, study: viewStudy, practice: viewPractice,
    exam: viewExam, progress: viewProgress, library: viewLibrary, search: viewSearch
  };

  function boot() {
    initChrome();
    var el = document.getElementById("view");
    if (!el) return;
    var page = el.getAttribute("data-page");
    if (!VIEWS[page]) return;

    loadData().then(function () {
      VIEWS[page](el);
    }).catch(function () {
      el.innerHTML = '<section class="panel"><h1>Could not load the question bank</h1>' +
        '<p class="muted">Check your connection and reload. The reading pages still work without it.</p></section>';
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
