#!/usr/bin/env python3
"""Build the static DBBL TCO Prep 2026 site from content/*.md.

Run from the repository root:  python build.py
Output is written next to this file (GitHub Pages serves it directly).

The site has two kinds of pages:
  * app pages   - rendered client-side by assets/app.js (dashboard, study,
                  practice, exam, progress, library, search)
  * reading pages - the Markdown library, rendered here
Both share the same top bar, mobile tab bar and "More" sheet.
"""
from pathlib import Path
from string import Template
from urllib.parse import quote
import json
import re

import markdown

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
ASSETS = ROOT / "assets"
REPO_URL = "https://github.com/s18211190154-ux/dbbl-tco-prep-2026"

# (filename, slug, nav label, group, blurb, icon)
PAGES = [
    ("01-Exam-Brief.md", "exam-brief", "Exam Brief", "Start Here",
     "What is confirmed, what is guessed, and how to survive the hall.", "🎯"),
    ("02-Study-Plan-12-Days.md", "study-plan", "12-Day Study Plan", "Start Here",
     "Day-by-day plan to 20 November, plus 3-day and 1-day fallbacks.", "🗓️"),
    ("00-Prep-Pack-README.md", "prep-pack-readme", "Pack Overview", "Start Here",
     "How the pack is organised and the 60-second strategy.", "📦"),
    ("Math-Formula-Sheet.md", "math-formula-sheet", "Formula Sheet", "Mathematics",
     "Every formula you need, on one page.", "🧮"),
    ("Math-Question-Bank.md", "math-question-bank", "60 Solved Problems", "Mathematics",
     "Percentage to probability, each with full working.", "✏️"),
    ("English-Grammar-Rules.md", "english-grammar-rules", "25 Grammar Rules", "English",
     "The rules that cover most DBBL English MCQs.", "📐"),
    ("English-Question-Bank.md", "english-question-bank", "60 Solved MCQs", "English",
     "Each answer tied back to a numbered rule.", "🔤"),
    ("Bangla-Question-Bank.md", "bangla-question-bank", "40 Solved MCQs", "Bangla",
     "সন্ধি, সমাস, কারক, বাগধারা, বানান ও আরও।", "🇧🇩"),
    ("Banking-GK-Notes.md", "banking-gk-notes", "Banking & Economy Notes", "General Knowledge",
     "Rates, regulators, DBBL facts and verified 2026 macro data.", "🏦"),
    ("GK-Question-Bank.md", "gk-question-bank", "60 Solved MCQs", "General Knowledge",
     "Weighted toward banking and Bangladesh affairs.", "🌏"),
    ("ICT-Question-Bank.md", "ict-question-bank", "30 Solved MCQs", "ICT",
     "The cheapest marks in the paper.", "💻"),
    ("Analytical-Question-Bank.md", "analytical-question-bank", "30 Solved Questions", "Analytical",
     "Series, coding, blood relations, seating, syllogism.", "🧩"),
    ("Written-Part-Guide.md", "written-part-guide", "Written Part Guide", "Written",
     "Structures and timing for the descriptive section.", "📝"),
    ("Model-Answers.md", "model-answers", "10 Model Answers", "Written",
     "Paragraph, essay, argument, email and worked written math.", "🖋️"),
    ("Mock-Test-1.md", "mock-test-1", "Mock Test 1 (100 Q)", "Mock Tests",
     "Full paper, 90 minutes.", "🧪"),
    ("Mock-Test-1-Answer-Key.md", "mock-test-1-answer-key", "Mock 1 — Answer Key", "Mock Tests",
     "Full key with explanations for the tricky items.", "✅"),
    ("Mock-Test-2.md", "mock-test-2", "Mock Test 2 (50 Q)", "Mock Tests",
     "Short, harder paper, 45 minutes.", "🧪"),
    ("Mock-Test-2-Answer-Key.md", "mock-test-2-answer-key", "Mock 2 — Answer Key", "Mock Tests",
     "Full key plus the five costliest mistakes.", "✅"),
    ("Last-48-Hours.md", "last-48-hours", "Last 48 Hours", "Revision",
     "The only sheet you need on 19 November.", "⏳"),
    ("Viva-Questions.md", "viva-questions", "Viva Questions", "Revision",
     "Interview questions with model answers.", "🎤"),
    ("Research-Brief.md", "research-brief", "Research Brief", "Reference",
     "Sources, confidence levels and open questions.", "🔎"),
]

SLUG_BY_STEM = {Path(f).stem: slug for f, slug, *_ in PAGES}
SLUG_BY_STEM["2026-11-08-dbbl-tco-exam"] = "research-brief"
SLUG_BY_STEM["README"] = "index"

TITLE_BY_SLUG = {}
GROUP_BY_SLUG = {}
LABEL_BY_SLUG = {}
BLURB_BY_SLUG = {}
ICON_BY_SLUG = {}
for _f, _s, _l, _g, _b, _i in PAGES:
    LABEL_BY_SLUG[_s] = _l
    GROUP_BY_SLUG[_s] = _g
    BLURB_BY_SLUG[_s] = _b
    ICON_BY_SLUG[_s] = _i

# app pages: (file stem, data-page value, nav label, title, description, icon)
APP_PAGES = [
    ("index", "dashboard", "Dashboard", "Dashboard",
     "Your DBBL TCO prep dashboard: readiness, next study day, subject progress and quick practice.", "⌂"),
    ("study", "study", "Study", "12-Day Study Plan",
     "A guided day-by-day path to the 20 November DBBL TCO exam, with every task linked.", "▤"),
    ("practice", "practice", "Practice", "Practice Questions",
     "Practise all 430 DBBL TCO questions with instant feedback and worked explanations.", "✎"),
    ("exam", "exam", "Exam", "Mock Exams",
     "Two timed, auto-marked DBBL TCO mock papers with a question palette and full review.", "⏱"),
    ("progress", "progress", "Progress", "Your Progress",
     "Readiness score, weak topics and the full history of every practice set and mock.", "◔"),
    ("library", "library", "Library", "Library",
     "Every reading page in the prep pack, grouped by subject.", "▥"),
    ("search", "search", "Search", "Search",
     "Search all 430 questions, every note and every section of the prep pack.", "⌕"),
]

APP_BY_STEM = {a[0]: a for a in APP_PAGES}

# slug -> (href, headline, blurb) practice call-to-action on reading pages
PRACTICE_CTA = {
    "math-question-bank": ("practice.html?bank=math", "Practise these 60 problems",
                           "Instant marking, worked explanations, and your weak topics tracked automatically."),
    "math-formula-sheet": ("practice.html?bank=math&n=10", "Test the formulas",
                           "Ten maths questions drawn from the sheet you just read."),
    "english-question-bank": ("practice.html?bank=english", "Practise these 60 MCQs",
                              "Every miss is saved so you can drill it again later."),
    "english-grammar-rules": ("practice.html?bank=english&n=10", "Test the rules",
                              "Ten English questions that use the rules on this page."),
    "bangla-question-bank": ("practice.html?bank=bangla", "Practise these 40 MCQs",
                             "সন্ধি, সমাস, কারক ও বাগধারা — with instant feedback."),
    "banking-gk-notes": ("practice.html?bank=gk&n=10", "Test the numbers",
                         "Ten banking GK questions on rates, regulators and DBBL facts."),
    "gk-question-bank": ("practice.html?bank=gk", "Practise these 60 MCQs",
                         "Banking and Bangladesh affairs, auto-marked."),
    "ict-question-bank": ("practice.html?bank=ict", "Practise these 30 MCQs",
                          "The cheapest marks in the paper — lock them in."),
    "analytical-question-bank": ("practice.html?bank=analytical", "Practise these 30 questions",
                                 "Series, coding, relations and seating, with explanations."),
    "mock-test-1": ("exam.html?mock=mock1", "Sit Mock Test 1 properly",
                    "100 questions, 90 minutes, auto-marked with a section breakdown."),
    "mock-test-1-answer-key": ("exam.html?mock=mock1", "Sit it, then compare",
                               "Take the timed paper and let the app mark it for you."),
    "mock-test-2": ("exam.html?mock=mock2", "Sit Mock Test 2 properly",
                    "50 questions, 45 minutes, auto-marked with a section breakdown."),
    "mock-test-2-answer-key": ("exam.html?mock=mock2", "Sit it, then compare",
                               "Take the timed paper and let the app mark it for you."),
    "written-part-guide": ("practice.html?bank=english&n=10", "Warm up with 10 English MCQs",
                           "Then write one answer by hand against the clock."),
    "model-answers": ("practice.html?bank=english&n=10", "Warm up with 10 English MCQs",
                      "Then write your own version before reading the model again."),
}
DEFAULT_CTA = ("practice.html", "Test yourself on this",
               "430 questions with instant feedback, explanations and progress tracking.")


def extract(text):
    lines = text.split("\n")
    title = None
    body = []
    for ln in lines:
        if title is None and ln.startswith("# "):
            title = ln[2:].strip()
            continue
        body.append(ln)
    return (title or "Untitled"), "\n".join(body)


def preprocess(text):
    text = re.sub(r'^(\s*)[-*] \[ \] ', r'\1- <input type="checkbox" class="task"> ', text, flags=re.M)
    text = re.sub(r'^(\s*)[-*] \[[xX]\] ', r'\1- <input type="checkbox" class="task" checked> ', text, flags=re.M)
    return text


def rewrite_links(html_text):
    def repl(m):
        href = m.group(1)
        if href.startswith(("http://", "https://", "mailto:", "#", "tel:")):
            return m.group(0)
        base, sep, anchor = href.partition("#")
        low = base.lower()
        suffix = ("#" + anchor) if sep else ""
        if low.endswith(".md"):
            stem = Path(base).stem
            slug = SLUG_BY_STEM.get(stem)
            if slug:
                return '<a href="%s.html%s"' % (slug, suffix)
            return m.group(0)
        if "mistake-tracker.csv" in low:
            return '<a href="content/mistake-tracker.csv%s"' % suffix
        if "00-past-papers-scanned" in low:
            return '<a href="past-papers.html%s"' % suffix
        return m.group(0)

    return re.sub(r'<a href="([^"]+)"', repl, html_text)


def flatten_toc(tokens, out):
    for t in tokens:
        out.append(t)
        flatten_toc(t.get("children", []), out)


RENDER_CACHE = {}


def render(path):
    key = str(path)
    if key in RENDER_CACHE:
        return RENDER_CACHE[key]
    raw = path.read_text(encoding="utf-8")
    title, body_md = extract(raw)
    body_md = preprocess(body_md)
    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists", "attr_list"])
    body = md.convert(body_md)
    body = rewrite_links(body)
    toc = []
    flatten_toc(md.toc_tokens, toc)
    RENDER_CACHE[key] = (title, body, toc)
    return RENDER_CACHE[key]


def plain(text, limit=160):
    t = re.sub(r"<[^>]+>", " ", text)
    t = re.sub(r"[#*`>_\[\]]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:limit].rstrip() + ("…" if len(t) > limit else "")


# ---------- shared chrome ----------

ICONS = {
    "home": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/></svg>',
    "study": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/></svg>',
    "practice": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    "exam": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    "more": '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
}


def topbar(active):
    links = []
    for stem, _page, label, _t, _d, _i in APP_PAGES:
        if stem == "search":
            continue
        cls = ' class="active"' if stem == active else ""
        links.append('<a data-nav href="%s.html"%s>%s</a>' % (stem, cls, label))
    return """<header class="topbar">
  <a class="brand" href="index.html"><span class="brand-mark">DB</span><span class="brand-text">DBBL TCO <b>2026</b></span></a>
  <nav class="top-nav" aria-label="Primary">%s</nav>
  <div class="search">
    <input id="q" type="search" placeholder="Search 430 questions and notes…" autocomplete="off" aria-label="Search">
    <div class="search-results" id="results" hidden></div>
  </div>
  <div class="top-actions">
    <span class="exam-pill" title="Exam date">20 Nov · 10:00</span>
    <button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode">◐</button>
  </div>
</header>""" % "\n    ".join(links)


def build_nav(active):
    groups = []
    for _f, slug, label, group, _b, _i in PAGES:
        if group not in groups:
            groups.append(group)

    parts = ['<a class="nav-home%s" href="index.html">⌂ <span>Dashboard</span></a>' %
             (" active" if active == "index" else "")]
    for g in groups:
        parts.append('<div class="nav-group"><p class="nav-label">%s</p><ul>' % g)
        for _f, slug, label, group, _b, _i in PAGES:
            if group != g:
                continue
            cls = ' class="active"' if slug == active else ""
            parts.append('<li><a href="%s.html"%s>%s</a></li>' % (slug, cls, label))
        parts.append("</ul></div>")

    parts.append('<div class="nav-group"><p class="nav-label">More</p><ul>'
                 '<li><a href="past-papers.html"%s>Past Papers (18 scans)</a></li>'
                 '<li><a href="downloads.html"%s>Downloads</a></li>'
                 '<li><a href="%s" target="_blank" rel="noopener">GitHub repo ↗</a></li>'
                 '</ul></div>' % (
                     ' class="active"' if active == "past-papers" else "",
                     ' class="active"' if active == "downloads" else "",
                     REPO_URL))
    return "\n".join(parts)


def sheet_links():
    groups = []
    for _f, slug, label, group, _b, _i in PAGES:
        if group not in groups:
            groups.append(group)

    parts = ['<div class="sheet-grid">',
             '<div class="sheet-col"><p class="nav-label">Study app</p><ul>',
             '<li><a href="progress.html">Progress &amp; history</a></li>',
             '<li><a href="search.html">Search everything</a></li>',
             '<li><a href="library.html">Full library</a></li>',
             '<li><a href="past-papers.html">Past papers (18 scans)</a></li>',
             '<li><a href="downloads.html">Markdown downloads</a></li>',
             '<li><a href="%s" target="_blank" rel="noopener">GitHub repo ↗</a></li>'
             '</ul></div>' % REPO_URL]
    for g in groups:
        parts.append('<div class="sheet-col"><p class="nav-label">%s</p><ul>' % g)
        for _f, slug, label, group, _b, _i in PAGES:
            if group == g:
                parts.append('<li><a href="%s.html">%s</a></li>' % (slug, label))
        parts.append("</ul></div>")
    parts.append("</div>")
    return "\n".join(parts)


def tabbar(active):
    items = [
        ("index", "home", "Home"),
        ("study", "study", "Study"),
        ("practice", "practice", "Practice"),
        ("exam", "exam", "Exam"),
    ]
    out = []
    for stem, ic, label in items:
        cls = ' class="active"' if stem == active else ""
        out.append('<a data-nav href="%s.html"%s><span class="ti">%s</span>%s</a>' %
                   (stem, cls, ICONS[ic], label))
    out.append('<button id="moreBtn" aria-expanded="false" aria-controls="sheet">'
               '<span class="ti">%s</span>More</button>' % ICONS["more"])
    return """<nav class="tabbar" aria-label="Quick navigation">
  %s
</nav>
<div class="sheet-scrim" id="sheetScrim"></div>
<div class="sheet" id="sheet" role="dialog" aria-label="More pages">
  <div class="sheet-head"><b>More</b><button class="icon-btn" id="sheetClose" aria-label="Close">✕</button></div>
  %s
</div>""" % ("\n  ".join(out), sheet_links())


FOOTER = """<footer class="footer">
  <p><strong>Unofficial study material.</strong> Not affiliated with, endorsed by, or connected to Dutch-Bangla Bank PLC. Always verify exam details against your admit card.</p>
  <p>Built from the research pack · <a href="%s" target="_blank" rel="noopener">View source on GitHub</a></p>
</footer>""" % REPO_URL


def head(title, desc, extra=""):
    return """<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s · DBBL TCO Prep 2026</title>
<meta name="description" content="%s">
<meta name="theme-color" content="#0f6b4f">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<script>(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();</script>
%s</head>""" % (title, desc, extra)


APP_TMPL = Template("""$head
<body class="app-page">
<a class="skip" href="#main">Skip to content</a>
$topbar
<main id="main" class="app-main">
  <div id="view" data-page="$page">$fallback</div>
</main>
$tabbar
$footer
<script src="assets/app.js"></script>
</body>
</html>
""")


DOC_TMPL = Template("""$head
<body class="doc-page">
<a class="skip" href="#main">Skip to content</a>
$topbar
<div class="layout">
  <aside class="sidebar" id="sidebar">
    <nav aria-label="Library">$nav</nav>
  </aside>
  <main id="main" class="content">
    <div class="page-head">
      <p class="eyebrow">$group</p>
      <h1>$title</h1>
    </div>
    $cta
    $toc
    $body
    $pager
  </main>
</div>
$tabbar
$footer
<script src="assets/app.js"></script>
</body>
</html>
""")


def build_toc(toc):
    items = [t for t in toc if t["level"] == 2]
    if len(items) < 3:
        return ""
    lis = "".join('<li><a href="#%s">%s</a></li>' % (t["id"], t["name"]) for t in items)
    return ('<details class="toc"><summary>On this page</summary>'
            '<ul>%s</ul></details>' % lis)


def build_pager(slug):
    idx = next(i for i, p in enumerate(PAGES) if p[1] == slug)
    out = ['<nav class="pager" aria-label="Page navigation">']
    if idx > 0:
        prev = PAGES[idx - 1]
        out.append('<a class="pager-link prev" href="%s.html"><span>← Previous</span>%s</a>' % (prev[1], prev[2]))
    else:
        out.append("<span></span>")
    if idx < len(PAGES) - 1:
        nxt = PAGES[idx + 1]
        out.append('<a class="pager-link next" href="%s.html"><span>Next →</span>%s</a>' % (nxt[1], nxt[2]))
    out.append("</nav>")
    return "".join(out)


def build_practice_cta(slug):
    href, headline, blurb = PRACTICE_CTA.get(slug, DEFAULT_CTA)
    return ('<aside class="practice-cta"><div><p class="eyebrow">Practice</p>'
            '<b>%s</b><p>%s</p></div>'
            '<a class="btn btn-primary" href="%s">Start →</a></aside>' % (headline, blurb, href))


DASH_FALLBACK = """<section class="dash-hero">
  <div class="dash-hero-copy">
    <p class="eyebrow">Exam in 12 days · 20 November 2026, 10:00 AM</p>
    <h1>Let’s get you exam-ready.</h1>
    <p class="lede">430 solved questions, two timed mocks and a 12-day guided path. Loading your progress…</p>
  </div>
  <div class="readiness"><div class="skeleton-ring"></div></div>
</section>"""


def build_app_page(stem):
    _stem, page, _label, title, desc, _icon = APP_BY_STEM[stem]
    fallback = DASH_FALLBACK if stem == "index" else '<div class="loading">Loading…</div>'
    html_out = APP_TMPL.substitute(
        head=head(title, desc),
        topbar=topbar(stem),
        page=page,
        fallback=fallback,
        tabbar=tabbar(stem),
        footer=FOOTER,
    )
    (ROOT / (stem + ".html")).write_text(html_out, encoding="utf-8")


def build_page(fname, slug, label, group, blurb, icon):
    title, body, toc = render(CONTENT / fname)
    TITLE_BY_SLUG[slug] = title
    html_out = DOC_TMPL.substitute(
        head=head(title, blurb),
        topbar=topbar("library"),
        nav=build_nav(slug),
        group=group,
        title=title,
        cta=build_practice_cta(slug),
        toc=build_toc(toc),
        body=body,
        pager=build_pager(slug),
        tabbar=tabbar(""),
        footer=FOOTER,
    )
    (ROOT / (slug + ".html")).write_text(html_out, encoding="utf-8")


def build_past_papers():
    imgs = sorted((ASSETS / "papers").glob("*.jpg"))
    years = {}
    for img in imgs:
        m = re.search(r"(20\d\d)", img.name)
        year = m.group(1) if m else "Other"
        years.setdefault(year, []).append(img)

    blocks = []
    for year in sorted(years, reverse=True):
        items = years[year]
        figs = []
        for i, img in enumerate(items, 1):
            figs.append(
                '<figure class="paper"><button class="paper-open" data-src="assets/papers/%s" data-caption="%s — page %d">'
                '<img src="assets/papers/%s" alt="DBBL %s paper page %d" loading="lazy">'
                '</button><figcaption>Page %02d</figcaption></figure>' % (
                    img.name, year, i, img.name, year, i, i)
            )
        blocks.append(
            '<h2>%s paper <span class="muted">(%d pages)</span></h2>'
            '<p class="muted">Click any page to enlarge. These are solved scans, so the answers are visible on the sheet.</p>'
            '<div class="papers">%s</div>' % (year, len(items), "".join(figs))
        )

    body = ("<p>Two genuine DBBL Probationary Officer papers, solved. The 2019 paper was 100 marks in 90 minutes; "
            "the 2017 paper was 90 marks in 60 minutes. Both had a 50-mark MCQ part and a 50-mark descriptive part. "
            "Use them to see the <em>shape</em> of the paper, not to memorise answers.</p>"
            + "".join(blocks) +
            '<nav class="pager"><a class="pager-link prev" href="research-brief.html"><span>← Previous</span>Research Brief</a>'
            '<a class="pager-link next" href="downloads.html"><span>Next →</span>Downloads</a></nav>')

    html_out = DOC_TMPL.substitute(
        head=head("Past Papers — 18 Scanned Pages", "Scanned and solved DBBL PO papers from 2019 and 2017."),
        topbar=topbar("library"),
        nav=build_nav("past-papers"),
        group="Reference",
        title="Past Papers — 18 Scanned Pages",
        cta="",
        toc="",
        body=body,
        pager="",
        tabbar=tabbar(""),
        footer=FOOTER,
    )
    (ROOT / "past-papers.html").write_text(html_out, encoding="utf-8")


def build_downloads():
    rows = []
    files = sorted([p for p in CONTENT.iterdir() if p.is_file()], key=lambda p: p.name.lower())
    for p in files:
        kb = max(1, round(p.stat().st_size / 1024))
        rows.append(
            '<tr><td><code>%s</code></td><td class="muted">%d KB</td>'
            '<td><a class="dl" href="content/%s" download>Download ↓</a></td></tr>' % (p.name, kb, p.name)
        )

    body = ('<p>Every page on this site is also available as plain Markdown — useful if you want to print it, '
            'edit it, or read it offline. The mistake tracker is a CSV you can open in Excel or Google Sheets.</p>'
            '<div class="table-wrap"><table><thead><tr><th>File</th><th>Size</th><th></th></tr></thead>'
            '<tbody>%s</tbody></table></div>'
            '<p class="note">The scanned past papers are images; open the <a href="past-papers.html">Past Papers</a> page to view or save them.</p>'
            '<nav class="pager"><a class="pager-link prev" href="past-papers.html"><span>← Previous</span>Past Papers</a><span></span></nav>'
            % "".join(rows))

    html_out = DOC_TMPL.substitute(
        head=head("Downloads", "Download every study file as Markdown or CSV."),
        topbar=topbar("library"),
        nav=build_nav("downloads"),
        group="Reference",
        title="Downloads",
        cta="",
        toc="",
        body=body,
        pager="",
        tabbar=tabbar(""),
        footer=FOOTER,
    )
    (ROOT / "downloads.html").write_text(html_out, encoding="utf-8")


def build_library_json():
    items = []
    for _f, slug, label, group, blurb, icon in PAGES:
        items.append({"slug": slug, "title": TITLE_BY_SLUG.get(slug, label),
                      "group": group, "blurb": blurb, "icon": icon})
    items.append({"slug": "past-papers", "title": "Past Papers — 18 Scanned Pages",
                  "group": "Reference", "blurb": "Two genuine DBBL PO papers, solved and scanned.",
                  "icon": "📄"})
    items.append({"slug": "downloads", "title": "Downloads",
                  "group": "Reference", "blurb": "Every study file as Markdown or CSV.",
                  "icon": "⬇️"})
    (ASSETS / "data" / "library.json").write_text(
        json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build_search():
    entries = []
    for stem, _page, label, title, _d, _i in APP_PAGES:
        entries.append({"t": title, "u": stem + ".html", "g": "Study app", "k": "page"})

    for _f, slug, label, group, _b, _i in PAGES:
        entries.append({"t": TITLE_BY_SLUG.get(slug, label), "u": slug + ".html",
                        "g": group, "k": "page"})
        _title, _body, toc = render(CONTENT / _f)
        for t in toc:
            if t["level"] > 3:
                continue
            entries.append({"t": t["name"], "u": "%s.html#%s" % (slug, t["id"]),
                            "g": TITLE_BY_SLUG.get(slug, label), "k": "section"})

    entries.append({"t": "Past Papers (18 scans)", "u": "past-papers.html", "g": "Reference", "k": "page"})
    entries.append({"t": "Downloads", "u": "downloads.html", "g": "Reference", "k": "page"})

    qfile = ASSETS / "data" / "questions.json"
    if qfile.exists():
        data = json.loads(qfile.read_text(encoding="utf-8"))
        for bank in data["banks"] + data["mocks"]:
            for q in bank["questions"]:
                entries.append({
                    "t": q["q"],
                    "u": "practice.html?q=" + quote(q["id"], safe=""),
                    "g": "%s · %s" % (bank["name"], q["topic"]),
                    "k": "question",
                })
    else:
        print("WARNING: assets/data/questions.json missing — search index has no questions")

    (ASSETS / "data" / "search.json").write_text(
        json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(entries)


def build_404():
    html_out = APP_TMPL.substitute(
        head=head("Page not found", "That page does not exist."),
        topbar=topbar(""),
        page="",
        fallback='<section class="panel notfound"><h1>Page not found</h1>'
                 '<p class="muted">That page does not exist. Try the dashboard or the search box above.</p>'
                 '<div class="hero-actions"><a class="btn btn-primary" href="index.html">Go to dashboard</a>'
                 '<a class="btn btn-ghost" href="search.html">Search the site</a></div></section>',
        tabbar=tabbar(""),
        footer=FOOTER,
    )
    (ROOT / "404.html").write_text(html_out, encoding="utf-8")


def main():
    for fname, slug, label, group, blurb, icon in PAGES:
        build_page(fname, slug, label, group, blurb, icon)
    for stem, _page, _label, _t, _d, _i in APP_PAGES:
        build_app_page(stem)
    build_past_papers()
    build_downloads()
    build_library_json()
    count = build_search()
    build_404()
    print("Built %d reading pages + %d app pages + past-papers + downloads + 404" %
          (len(PAGES), len(APP_PAGES)))
    print("Search index: %d entries" % count)


if __name__ == "__main__":
    main()
