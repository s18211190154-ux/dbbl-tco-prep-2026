# DBBL TCO Prep 2026

A complete, self-contained study site for the **Dutch-Bangla Bank PLC Trainee Cash Officer** exam on **20 November 2026**.

**Live site:** https://s18211190154-ux.github.io/dbbl-tco-prep-2026/

## What is inside

- **430 solved questions** across Maths, English, Bangla, General Knowledge, ICT and Analytical ability.
- **Two timed mock tests** (100 Q / 90 min and 50 Q / 45 min) with full answer keys and explanations.
- **18 scanned pages** of genuine DBBL past papers (PO 2019 and PO 2017), solved.
- **Verified 2026 banking data** from Bangladesh Bank: repo 9.50%, SLF 11.00%, SDF 7.50%, CRR 4%, SLR 13%, inflation 8.34%, reserves ~USD 36bn.
- **Written-part models** — paragraph, essay, argument, formal email, leave application, precise writing, and three fully worked written-maths.
- **Viva preparation** with model answers.
- **Downloads** of every page as plain Markdown, plus a CSV mistake tracker.

## Important caveats

DBBL publishes **no syllabus and no marks distribution** for the TCO written test. Every subject weighting on this site is inferred from the 2019 and 2017 papers and is labelled as an assumption. Whether Bangla is included, and whether negative marking applies, are unconfirmed. Unverified 2026 current affairs were deliberately excluded; only macro-financial facts were independently checked against Bangladesh Bank sources.

This is unofficial study material. It is not affiliated with Dutch-Bangla Bank PLC.

## Structure

```
.
├── index.html              landing page (built)
├── *.html                  one page per study file (built)
├── past-papers.html        18-scan gallery with lightbox (built)
├── downloads.html          Markdown/CSV downloads (built)
├── content/                source Markdown + mistake-tracker.csv
├── assets/
│   ├── style.css
│   ├── app.js
│   ├── search.json         generated search index
│   └── papers/             18 past-paper scans
└── build.py                static site generator
```

## Rebuild

Requires Python 3 and `markdown`:

```bash
pip install markdown
python build.py
```

The build is deterministic: it reads `content/*.md`, rewrites internal links, and writes the HTML pages at the repository root. GitHub Pages serves the root of the `main` branch (`.nojekyll` is present so Jekyll does not interfere).

## Source

The research brief behind the content, including sources and confidence levels, is on the site at `research-brief.html` and in `content/Research-Brief.md`.
