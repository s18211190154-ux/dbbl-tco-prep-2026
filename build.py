#!/usr/bin/env python3
"""Build the static DBBL TCO Prep 2026 site from content/*.md.

Run from the repository root:  python build.py
Output is written next to this file (GitHub Pages serves it directly).
"""
from pathlib import Path
from string import Template
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


def render(path):
    raw = path.read_text(encoding="utf-8")
    title, body_md = extract(raw)
    body_md = preprocess(body_md)
    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists", "attr_list"])
    body = md.convert(body_md)
    body = rewrite_links(body)
    toc = []
    flatten_toc(md.toc_tokens, toc)
    return title, body, toc


def plain(text, limit=160):
    t = re.sub(r"<[^>]+>", " ", text)
    t = re.sub(r"[#*`>_\[\]]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:limit].rstrip() + ("…" if len(t) > limit else "")


def build_nav(active):
    groups = []
    for _f, slug, label, group, _b, _i in PAGES:
        if group not in groups:
            groups.append(group)

    parts = ['<a class="nav-home%s" href="index.html">🏠 <span>Home</span></a>' %
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


PAGE_TMPL = Template("""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$title · DBBL TCO Prep 2026</title>
<meta name="description" content="$desc">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<script>(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open navigation" aria-expanded="false">☰</button>
  <a class="brand" href="index.html"><span class="brand-mark">DB</span><span class="brand-text">DBBL TCO <b>2026</b></span></a>
  <div class="search">
    <input id="q" type="search" placeholder="Search 430 questions and notes…" autocomplete="off" aria-label="Search">
    <div class="search-results" id="results" hidden></div>
  </div>
  <div class="top-actions">
    <span class="exam-pill" title="Exam date">20 Nov · 10:00</span>
    <button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode">◐</button>
  </div>
</header>
<div class="scrim" id="scrim"></div>
<div class="layout">
  <aside class="sidebar" id="sidebar">
    <nav aria-label="Sections">$nav</nav>
  </aside>
  <main id="main" class="content">
    <div class="page-head">
      <p class="eyebrow">$group</p>
      <h1>$title</h1>
    </div>
    $toc
    $body
    $pager
  </main>
</div>
<footer class="footer">
  <p><strong>Unofficial study material.</strong> Not affiliated with, endorsed by, or connected to Dutch-Bangla Bank PLC. Always verify exam details against your admit card.</p>
  <p>Built from the research pack · <a href="$repo" target="_blank" rel="noopener">View source on GitHub</a></p>
</footer>
<script src="assets/app.js"></script>
</body>
</html>
""")


INDEX_TMPL = Template("""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DBBL TCO Prep 2026 — 430 solved questions</title>
<meta name="description" content="Complete preparation pack for the Dutch-Bangla Bank Trainee Cash Officer exam on 20 November 2026: 430 solved questions, two mock tests, 18 real past-paper scans.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<script>(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();</script>
</head>
<body class="home">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open navigation" aria-expanded="false">☰</button>
  <a class="brand" href="index.html"><span class="brand-mark">DB</span><span class="brand-text">DBBL TCO <b>2026</b></span></a>
  <div class="search">
    <input id="q" type="search" placeholder="Search 430 questions and notes…" autocomplete="off" aria-label="Search">
    <div class="search-results" id="results" hidden></div>
  </div>
  <div class="top-actions">
    <span class="exam-pill" title="Exam date">20 Nov · 10:00</span>
    <button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode">◐</button>
  </div>
</header>
<div class="scrim" id="scrim"></div>
<main id="main">
  <section class="hero">
    <div class="hero-inner">
      <p class="eyebrow">Dutch-Bangla Bank PLC · Trainee Cash Officer</p>
      <h1>Everything for the <span class="hl">20 November 2026</span> TCO exam.</h1>
      <p class="lede">430 solved questions, two timed mocks, the verified 2026 banking numbers, and 18 pages of genuine DBBL past papers — organised so you can start in the next five minutes.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="exam-brief.html">Start with the exam brief</a>
        <a class="btn btn-ghost" href="study-plan.html">See the 12-day plan</a>
      </div>
      <div class="countdown" id="countdown" data-target="2026-11-20T10:00:00+06:00">
        <div><b id="cd-d">–</b><span>days</span></div>
        <div><b id="cd-h">–</b><span>hours</span></div>
        <div><b id="cd-m">–</b><span>minutes</span></div>
        <div><b id="cd-s">–</b><span>seconds</span></div>
      </div>
    </div>
  </section>

  <section class="wrap stats">
    <div class="stat"><b>430</b><span>solved questions</span></div>
    <div class="stat"><b>18</b><span>real past-paper scans</span></div>
    <div class="stat"><b>2</b><span>timed mock tests</span></div>
    <div class="stat"><b>1</b><span>page formula sheet</span></div>
  </section>

  <section class="wrap">
    <h2 class="section-title">Start here</h2>
    <div class="path">
      <a class="path-step" href="exam-brief.html">
        <span class="step-n">1</span>
        <h3>Know the paper</h3>
        <p>Confirmed facts, the likely pattern, and the exam-hall timing plan.</p>
      </a>
      <a class="path-step" href="math-question-bank.html">
        <span class="step-n">2</span>
        <h3>Fix the maths</h3>
        <p>Maths is the differentiator. 60 problems with full working.</p>
      </a>
      <a class="path-step" href="mock-test-1.html">
        <span class="step-n">3</span>
        <h3>Sit a mock</h3>
        <p>100 questions in 90 minutes, then mark it against the key.</p>
      </a>
    </div>
  </section>

  <section class="wrap">
    <h2 class="section-title">All sections</h2>
    <div class="cards">$cards</div>
  </section>

  <section class="wrap facts">
    <h2 class="section-title">The exam, in one box</h2>
    <div class="fact-grid">
      <div><span>Date</span><b>20 November 2026</b></div>
      <div><span>Time</span><b>10:00 AM</b></div>
      <div><span>Format</span><b>MCQ + Written</b></div>
      <div><span>Posts</span><b>MTO · AO · TCO (same slot)</b></div>
      <div><span>Probation pay</span><b>BDT 26,000 / month</b></div>
      <div><span>Confirmed pay</span><b>BDT 41,410 / month</b></div>
      <div><span>Posting</span><b>Anywhere in Bangladesh</b></div>
      <div><span>Repo rate</span><b>9.50%</b></div>
    </div>
    <p class="note">DBBL publishes no syllabus or marks distribution. Every weight in this pack is inferred from the 2019 and 2017 papers and is labelled as an assumption. <a href="research-brief.html">Read the research brief →</a></p>
  </section>

  <section class="wrap cta">
    <div class="cta-box">
      <h2>Two mocks. One honest score.</h2>
      <p>Do Mock 1 under exam conditions, then log every miss in the mistake tracker. Your error profile is worth more than another chapter of notes.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="mock-test-1.html">Open Mock Test 1</a>
        <a class="btn btn-ghost" href="downloads.html">Download the markdown files</a>
      </div>
    </div>
  </section>
</main>
<footer class="footer">
  <p><strong>Unofficial study material.</strong> Not affiliated with, endorsed by, or connected to Dutch-Bangla Bank PLC. Always verify exam details against your admit card.</p>
  <p>Built from the research pack · <a href="$repo" target="_blank" rel="noopener">View source on GitHub</a></p>
</footer>
<script src="assets/app.js"></script>
</body>
</html>
""")


def build_index():
    cards = []
    for _f, slug, label, group, blurb, icon in PAGES:
        if slug == "prep-pack-readme":
            continue
        cards.append(
            '<a class="card" href="%s.html"><span class="card-icon">%s</span>'
            '<span class="card-group">%s</span><h3>%s</h3><p>%s</p>'
            '<span class="card-go">Open →</span></a>' % (slug, icon, group, label, blurb)
        )
    cards.append(
        '<a class="card" href="past-papers.html"><span class="card-icon">📄</span>'
        '<span class="card-group">Reference</span><h3>Past Papers (scanned)</h3>'
        '<p>18 pages of solved DBBL PO papers from 2019 and 2017.</p>'
        '<span class="card-go">Open →</span></a>'
    )
    (ROOT / "index.html").write_text(
        INDEX_TMPL.substitute(cards="\n".join(cards), repo=REPO_URL), encoding="utf-8")


def build_page(fname, slug, label, group, blurb, icon):
    title, body, toc = render(CONTENT / fname)
    TITLE_BY_SLUG[slug] = title
    html_out = PAGE_TMPL.substitute(
        title=title,
        desc=blurb,
        group=group,
        nav=build_nav(slug),
        toc=build_toc(toc),
        body=body,
        pager=build_pager(slug),
        repo=REPO_URL,
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

    body = ("<div class=\"page-head\"><p class=\"eyebrow\">Reference</p><h1>Past Papers — 18 Scanned Pages</h1></div>"
            "<p>Two genuine DBBL Probationary Officer papers, solved. The 2019 paper was 100 marks in 90 minutes; "
            "the 2017 paper was 90 marks in 60 minutes. Both had a 50-mark MCQ part and a 50-mark descriptive part. "
            "Use them to see the <em>shape</em> of the paper, not to memorise answers.</p>"
            + "".join(blocks) +
            '<nav class="pager"><a class="pager-link prev" href="research-brief.html"><span>← Previous</span>Research Brief</a>'
            '<a class="pager-link next" href="downloads.html"><span>Next →</span>Downloads</a></nav>')

    html_out = PAGE_TMPL.substitute(
        title="Past Papers — 18 Scanned Pages",
        desc="Scanned and solved DBBL PO papers from 2019 and 2017.",
        group="Reference",
        nav=build_nav("past-papers"),
        toc="",
        body=body,
        pager="",
        repo=REPO_URL,
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

    body = ('<div class="page-head"><p class="eyebrow">Reference</p><h1>Downloads</h1></div>'
            '<p>Every page on this site is also available as plain Markdown — useful if you want to print it, '
            'edit it, or read it offline. The mistake tracker is a CSV you can open in Excel or Google Sheets.</p>'
            '<div class="table-wrap"><table><thead><tr><th>File</th><th>Size</th><th></th></tr></thead>'
            '<tbody>%s</tbody></table></div>'
            '<p class="note">The scanned past papers are images; open the <a href="past-papers.html">Past Papers</a> page to view or save them.</p>'
            '<nav class="pager"><a class="pager-link prev" href="past-papers.html"><span>← Previous</span>Past Papers</a><span></span></nav>'
            % "".join(rows))

    html_out = PAGE_TMPL.substitute(
        title="Downloads",
        desc="Download every study file as Markdown or CSV.",
        group="Reference",
        nav=build_nav("downloads"),
        toc="",
        body=body,
        pager="",
        repo=REPO_URL,
    )
    (ROOT / "downloads.html").write_text(html_out, encoding="utf-8")


def build_search():
    entries = []
    for _f, slug, label, group, _b, _i in PAGES:
        entries.append({"t": TITLE_BY_SLUG.get(slug, label), "u": slug + ".html", "g": group, "k": "page"})
        _title, _body, toc = render(CONTENT / _f)
        for t in toc:
            if t["level"] > 3:
                continue
            entries.append({"t": t["name"], "u": "%s.html#%s" % (slug, t["id"]),
                            "g": TITLE_BY_SLUG.get(slug, label), "k": "section"})
    entries.append({"t": "Past Papers (18 scans)", "u": "past-papers.html", "g": "Reference", "k": "page"})
    entries.append({"t": "Downloads", "u": "downloads.html", "g": "Reference", "k": "page"})
    (ASSETS / "search.json").write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")


def build_404():
    html_out = PAGE_TMPL.substitute(
        title="Page not found",
        desc="That page does not exist.",
        group="Error 404",
        nav=build_nav(""),
        toc="",
        body='<p>That page does not exist. Try the <a href="index.html">home page</a> or the search box above.</p>',
        pager="",
        repo=REPO_URL,
    )
    (ROOT / "404.html").write_text(html_out, encoding="utf-8")


def main():
    for fname, slug, label, group, blurb, icon in PAGES:
        build_page(fname, slug, label, group, blurb, icon)
    build_index()
    build_past_papers()
    build_downloads()
    build_search()
    build_404()
    print("Built %d pages + index, past-papers, downloads, 404" % len(PAGES))


if __name__ == "__main__":
    main()
