# DBBL TCO Prep 2026

A complete study app for the **Dutch-Bangla Bank PLC Trainee Cash Officer** exam on **20 November 2026** — guided study, interactive practice, timed mocks and progress tracking, all in one static site.

**Live site:** https://s18211190154-ux.github.io/dbbl-tco-prep-2026/

## What is inside

- **Dashboard** — exam countdown, readiness score, subject coverage, next study day and recent activity.
- **12-day guided study plan** — one focus per day, with every task linked to the exact practice set or reading page. Tick days off and the plan remembers.
- **430 interactive questions** across Maths, English, Bangla, General Knowledge, ICT and Analytical ability. Instant marking, worked explanations, and wrong answers saved for later drilling.
- **Two timed mocks** (100 Q / 90 min and 50 Q / 45 min) with a question palette, flagging, auto-submit, section breakdown and full review.
- **Progress page** — readiness score, weak and strong topics, streak, and the full history of every attempt with a per-question review.
- **Full-text search** across all 430 questions, every heading and every note.
- **Reading library** — the complete Markdown pack rendered as pages, each with a one-click practice CTA.
- **18 scanned pages** of genuine DBBL past papers (PO 2019 and PO 2017), solved.
- **Verified 2026 banking data** from Bangladesh Bank: repo 9.50%, SLF 11.00%, SDF 7.50%, CRR 4%, SLR 13%, inflation 8.34%, reserves ~USD 36bn.
- **Written-part models** — paragraph, essay, argument, formal email, leave application, precise writing, and three fully worked written-maths.
- **Viva preparation** with model answers.
- **Downloads** of every page as plain Markdown, plus a CSV mistake tracker.

Progress is stored in `localStorage` under `tco.v1`; nothing leaves the browser.

## Important caveats

DBBL publishes **no syllabus and no marks distribution** for the TCO written test. Every subject weighting on this site is inferred from the 2019 and 2017 papers and is labelled as an assumption. Whether Bangla is included, and whether negative marking applies, are unconfirmed. Unverified 2026 current affairs were deliberately excluded; only macro-financial facts were independently checked against Bangladesh Bank sources.

This is unofficial study material. It is not affiliated with Dutch-Bangla Bank PLC.

## Structure

```
.
├── index.html              dashboard (app)
├── study.html              guided 12-day plan (app)
├── practice.html           practice engine (app)
├── exam.html               timed mocks (app)
├── progress.html           readiness + history (app)
├── library.html            reading library index (app)
├── search.html             full-text search (app)
├── *.html                  one reading page per study file (built)
├── past-papers.html        18-scan gallery with lightbox (built)
├── downloads.html          Markdown/CSV downloads (built)
├── content/                source Markdown + mistake-tracker.csv
├── assets/
│   ├── style.css
│   ├── app.js              all app logic (vanilla JS, no dependencies)
│   ├── data/
│   │   ├── questions.json  430 parsed questions
│   │   ├── library.json    library index
│   │   └── search.json     search index (pages + headings + questions)
│   └── papers/             18 past-paper scans
├── tools/
│   └── extract_questions.py  Markdown → questions.json
└── build.py                static site generator
```

## Rebuild

Requires Python 3 and `markdown`:

```bash
pip install markdown
python tools/extract_questions.py   # regenerate assets/data/questions.json
python build.py                     # regenerate every HTML page + JSON index
```

The build is deterministic: it reads `content/*.md`, rewrites internal links, and writes the HTML pages at the repository root. GitHub Pages serves the root of the `main` branch (`.nojekyll` is present so Jekyll does not interfere).

## Source

The research brief behind the content, including sources and confidence levels, is on the site at `research-brief.html` and in `content/Research-Brief.md`.
